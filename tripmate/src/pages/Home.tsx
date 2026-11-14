import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { cachedGet } from '../services/api';
import type { Trip } from '../types';
import type { AuthUser } from '../context/AuthContext';
import TripCard from '../components/TripCard';
import HeroSearch from '../components/HeroSearch';
import { wikiSrcSet } from '../services/images';
import { trendingNow, seasonOf, monthName } from '../services/seasonalTrending';
import { Avatar, SectionHeader, Skeleton, EmptyState, ErrorState, cn } from '../components/ui-bits';
import { Bell, Compass, UserPlus, Check, X, Star, Plus } from 'lucide-react';
import { getSocket } from '../services/socket';





/* ── Notifications (real: GET /api/notifications + live socket push) ───────── */
type NotificationType = 'NEW_REQUEST' | 'REQUEST_APPROVED' | 'REQUEST_DECLINED' | 'REVIEW_RECEIVED';
interface AppNotification {
  id: string;
  type: NotificationType;
  text: string;
  link: string; // in-app path to open
  read: boolean;
  createdAt: string;
}
const NOTI_META: Record<NotificationType, { Icon: typeof UserPlus; bg: string; fg: string }> = {
  NEW_REQUEST: { Icon: UserPlus, bg: 'bg-blue-50', fg: 'text-blue-600' },
  REQUEST_APPROVED: { Icon: Check, bg: 'bg-blue-50', fg: 'text-blue-600' },
  REQUEST_DECLINED: { Icon: X, bg: 'bg-[#F3F3F3]', fg: 'text-[#6A6A6A]' },
  REVIEW_RECEIVED: { Icon: Star, bg: 'bg-[#F3F3F3]', fg: 'text-[#222222]' },
};

// "just now", "5m ago", "3h ago", "2d ago", then a date.
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type ViewState = 'loading' | 'error' | 'empty' | 'ready';

/* ═══════════════════════════════════════════════════════════════════════════════
   HOME FEED  (Discover screen)
   ═══════════════════════════════════════════════════════════════════════════════ */
export interface FeedFilters {
  category: string | null;
  q: string;
  minBudget: string;
  maxBudget: string;
  startDate: string;
  endDate: string;
}

function HomeFeed({
  trips,
  view,
  onRetry,
  onPost,
  currentUserId,
  user,
  filters,
  setFilters,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  trips: Trip[];
  view: ViewState;
  onRetry: () => void;
  onPost: () => void;
  currentUserId: string;
  user: AuthUser | null;
  filters: FeedFilters;
  setFilters: React.Dispatch<React.SetStateAction<FeedFilters>>;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const { q: searchQuery } = filters;
  const setSearchQuery = (q: string) => setFilters((f) => ({ ...f, q }));
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const isSearching = searchQuery.trim().length > 0;
  const trending = useMemo(() => trendingNow(), []); // re-ranked from today's date on every visit
  const season = seasonOf();
  const filteredTrips = trips;

  return (
    <div className="pb-28 lg:pb-10">
      {/* Greeting + notifications */}
      <header className="flex items-center justify-between gap-4 mb-5 sm:mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={user?.avatar ?? null} name={user?.name ?? 'Traveller'} size={46} />
          <div className="leading-tight min-w-0">
            <p className="text-[#6A6A6A]" style={{ fontSize: 13 }}>
              {greeting()},
            </p>
            <p className="text-[#222222] truncate" style={{ fontSize: 18, fontWeight: 600 }}>
              {firstName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onPost}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Post a trip
          </button>
          <NotificationsBell />
        </div>
      </header>

      {/* Search: one bar (place | dates | budget) */}
      <HeroSearch filters={filters} setFilters={setFilters} trips={trips} places={trending.map((d) => d.search)} />

      {view === 'loading' && <HomeSkeleton />}
      {view === 'error' && <ErrorState onRetry={onRetry} />}
      {view === 'empty' && (
        <EmptyState
          icon={<Compass size={34} />}
          title="No trips yet"
          subtitle="Be the first to start a group. Post a trip and gather your tribe."
          action="Post a trip"
          onAction={onPost}
        />
      )}

      {view === 'ready' && (
        <>
          {/* Trending destinations: hidden while searching. Tap one to search it. */}
          {!isSearching && (
            <section className="mb-9 sm:mb-12">
              <SectionHeader title={`Trending this ${season}`} />
              <p className="text-[#6A6A6A] text-sm -mt-3 mb-4 sm:mb-5">Best places to go in {monthName()}. Tap one to see the groups heading there.</p>
              <div className="flex lg:grid lg:grid-cols-6 gap-3 overflow-x-auto scrollbar-none pb-1">
                {trending.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => setSearchQuery(d.search)}
                    className="relative shrink-0 w-32 sm:w-36 lg:w-auto aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100"
                  >
                    <img
                      src={d.image}
                      srcSet={wikiSrcSet(d.image)}
                      sizes="(min-width: 1024px) 180px, 144px"
                      alt=""
                      width={400}
                      height={300}
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute bottom-2 left-2 bg-white/95 text-[#222222] rounded-full px-2.5 py-1 text-xs font-medium">
                      {d.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Groups forming now (real data), always visible */}
          <section className="mb-10 sm:mb-12">
            <SectionHeader title={isSearching ? `Results for "${searchQuery.trim()}"` : 'Groups Forming Now'} />
            {filteredTrips.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#222222] font-semibold">
                  {isSearching ? `No trips found for "${searchQuery.trim()}".` : 'No trips match this vibe.'}
                </p>
                <p className="text-[#6A6A6A] text-sm mt-1">Be the first to post one!</p>
                <button
                  onClick={onPost}
                  className="mt-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
                >
                  Post a trip
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-3 sm:gap-x-6 gap-y-7 sm:gap-y-10">
                  {filteredTrips.map((t, i) => (
                    <TripCard key={t.id} trip={t} currentUserId={currentUserId} priority={i < 2} />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-7">
                    <button
                      type="button"
                      onClick={onLoadMore}
                      disabled={loadingMore}
                      className="rounded-full border border-[#DDDDDD] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-60 text-[#6A6A6A] px-6 py-2.5 transition-colors"
                      style={{ fontSize: 14, fontWeight: 600 }}
                    >
                      {loadingMore ? 'Loading…' : 'Load more trips'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ── Notifications bell + dropdown ──────────────────────────────────────────── */
function NotificationsBell() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    api
      .get<{ items: AppNotification[]; unread: number }>('/notifications')
      .then(({ data }) => {
        setNotifications(data.items);
        setUnread(data.unread);
      })
      .catch((error) => console.error('[Notifications] fetch failed', error));
  }, []);

  // New notifications arrive live while the page is open.
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const onNotification = (n: AppNotification) => {
      setNotifications((prev) => [n, ...prev].slice(0, 30));
      setUnread((u) => u + 1);
    };
    socket.on('notification', onNotification);
    return () => {
      socket.off('notification', onNotification);
    };
  }, [token]);

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await api.post('/notifications/read-all');
    } catch (error) {
      console.error('[Notifications] mark read failed', error);
    }
  };

  const openNotification = (n: AppNotification) => {
    setOpen(false);
    navigate(n.link);
  };

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 160);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const shown = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        className="relative w-11 h-11 rounded-full bg-white border border-[#DDDDDD] flex items-center justify-center text-[#6A6A6A] hover:text-[#2563EB] transition-colors"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* backdrop: dims on phones, invisible click-away on larger screens */}
          <div className={cn('fixed inset-0 z-40')} onClick={close} />
          <div
            role="dialog"
            aria-label="Notifications"
            className={cn(
              'z-50 bg-white flex flex-col overflow-hidden',
              'absolute right-0 top-full mt-3 w-[min(24rem,calc(100vw-2rem))] max-h-[min(34rem,calc(100dvh-9rem))] rounded-2xl border border-[#DDDDDD] shadow-[0_16px_48px_rgba(15,23,42,0.18)]',
              closing ? 'noti-out' : 'noti-in',
            )}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-[#222222] text-lg font-bold">Notifications</h2>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button type="button" onClick={markAllRead} className="text-[#2563EB] text-[13px] font-medium rounded-full px-2.5 py-1.5 hover:bg-[#EFF6FF] transition-colors">
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={close} aria-label="Close notifications" className="w-8 h-8 rounded-full flex items-center justify-center text-[#6A6A6A] hover:bg-[#F7F7F7]">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-3">
              {(['all', 'unread'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn('rounded-full px-3.5 py-1.5 text-[13px] border transition-colors', tab === t ? 'bg-[#222222] border-[#222222] text-white' : 'border-[#DDDDDD] text-[#222222] hover:border-[#222222]')}
                >
                  {t === 'all' ? 'All' : `Unread${unread ? ` · ${unread}` : ''}`}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain border-t border-[#EBEBEB] px-2 py-2">
              {shown.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10 px-6">
                  <span className="w-12 h-12 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#6A6A6A] mb-3">
                    <Bell size={20} />
                  </span>
                  <p className="text-[#222222] text-sm font-medium">{tab === 'unread' ? 'Nothing unread' : "You're all caught up"}</p>
                  <p className="text-[#6A6A6A] text-[13px] mt-1">New requests and reviews will show up here.</p>
                </div>
              ) : (
                shown.map((n) => <NotificationRow key={n.id} n={n} onOpen={() => openNotification(n)} />)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationRow({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
  const meta = NOTI_META[n.type];
  const Icon = meta.Icon;
  return (
    <button type="button" onClick={onOpen} className="w-full text-left flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-[#F7F7F7] active:bg-[#F7F7F7] transition-colors">
      <span className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', meta.bg)}>
        <Icon size={17} className={meta.fg} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[#222222] text-[14px] leading-snug', !n.read && 'font-medium')}>{n.text}</p>
        <p className={cn('text-[12px] mt-1', n.read ? 'text-[#6A6A6A]' : 'text-[#2563EB]')}>{timeAgo(n.createdAt)}</p>
      </div>
      {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] shrink-0 mt-1.5" />}
    </button>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-10">
      <div>
        <Skeleton className="h-7 w-56 mb-2" />
        <Skeleton className="h-4 w-72 max-w-full mb-4" />
        <div className="flex gap-3 sm:gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="shrink-0 w-[150px] sm:w-[218px] aspect-[4/3] rounded-2xl" />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-7 w-48 mb-4" />
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-3 sm:gap-x-6 gap-y-7 sm:gap-y-10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[4/3] sm:aspect-[16/10] rounded-2xl" />
              <div className="pt-3 space-y-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-6 w-6 sm:w-24 rounded-full" />
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PAGE (data fetching, renders inside the routed AppShell)
   ═══════════════════════════════════════════════════════════════════════════════ */
type FeedPage = { trips: Trip[]; nextCursor: string | null };

const EMPTY_FILTERS: FeedFilters = { category: null, q: '', minBudget: '', maxBudget: '', startDate: '', endDate: '' };

function buildQuery(filters: FeedFilters, cursor: string | null): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.minBudget) params.set('minBudget', filters.minBudget);
  if (filters.maxBudget) params.set('maxBudget', filters.maxBudget);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cached] = useState(() => cachedGet<FeedPage>(`/trips?${buildQuery(EMPTY_FILTERS, null)}`));
  const [trips, setTrips] = useState<Trip[]>(cached?.trips ?? []);
  const [view, setView] = useState<ViewState>(cached ? (cached.trips.length ? 'ready' : 'empty') : 'loading');
  const [filters, setFilters] = useState<FeedFilters>(EMPTY_FILTERS);
  const [nextCursor, setNextCursor] = useState<string | null>(cached?.nextCursor ?? null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTrips = async (activeFilters: FeedFilters) => {
    const url = `/trips?${buildQuery(activeFilters, null)}`;
    const hit = cachedGet<FeedPage>(url);
    if (hit) {
      setTrips(hit.trips);
      setNextCursor(hit.nextCursor);
      setView(hit.trips.length ? 'ready' : 'empty');
    } else {
      setView('loading');
    }
    try {
      const { data } = await api.get<FeedPage>(url);
      setTrips(data.trips);
      setNextCursor(data.nextCursor);
      setView(data.trips.length === 0 ? 'empty' : 'ready');
    } catch {
      if (!hit) setView('error'); // keep showing cached trips if the refresh fails
    }
  };

  // Re-fetch whenever a filter changes, debounced so typing doesn't fire a request per keystroke.
  // No debounce for the unfiltered feed (first load / cleared filters).
  useEffect(() => {
    const t = window.setTimeout(() => fetchTrips(filters), filters === EMPTY_FILTERS ? 0 : 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get<FeedPage>(`/trips?${buildQuery(filters, nextCursor)}`);
      setTrips((prev) => [...prev, ...data.trips]);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error('[Home] load more failed', error);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <HomeFeed
      trips={trips}
      view={view}
      onRetry={() => fetchTrips(filters)}
      onPost={() => navigate('/post')}
      currentUserId={user?.id ?? ''}
      user={user}
      filters={filters}
      setFilters={setFilters}
      hasMore={nextCursor !== null}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
    />
  );
}
