import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Trip } from '../types';
import type { AuthUser } from '../context/AuthContext';
import TripCard from '../components/TripCard';
import { Avatar, Pill, SectionHeader, Skeleton, EmptyState, ErrorState, cn } from '../components/ui-bits';
import { Search, Bell, Compass, UserPlus, Check, X, Star } from 'lucide-react';
import { getSocket } from '../services/socket';

/* ── Categories (sent to the server as the `category` filter) ───────────────── */
const CATEGORIES = ['Mountains', 'Beaches', 'Culture', 'Adventure', 'Wildlife', 'Road Trip'] as const;

/* ── Mock content (no API yet, same as prior Home) ─────────────────────────── */
const TRENDING: { name: string; image: string }[] = [
  { name: 'Goa', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=200&h=200&fit=crop&auto=format' },
  { name: 'Manali', image: 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b?w=200&h=200&fit=crop&auto=format' },
  { name: 'Spiti', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=200&h=200&fit=crop&auto=format' },
  { name: 'Kerala', image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=200&h=200&fit=crop&auto=format' },
  { name: 'Hampi', image: 'https://images.unsplash.com/photo-1600100397608-f010c1aefebc?w=200&h=200&fit=crop&auto=format' },
  { name: 'Ladakh', image: 'https://images.unsplash.com/photo-1581791534721-e599df4417f7?w=200&h=200&fit=crop&auto=format' },
];



const HERO_IMG = 'https://images.unsplash.com/photo-1581791534721-e599df4417f7?w=1400&h=500&fit=crop&auto=format';

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
  REQUEST_APPROVED: { Icon: Check, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  REQUEST_DECLINED: { Icon: X, bg: 'bg-red-50', fg: 'text-red-500' },
  REVIEW_RECEIVED: { Icon: Star, bg: 'bg-amber-50', fg: 'text-amber-600' },
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
  const { category, q: searchQuery, minBudget, maxBudget, startDate, endDate } = filters;
  const setCategory = (c: string | null) => setFilters((f) => ({ ...f, category: c }));
  const setSearchQuery = (q: string) => setFilters((f) => ({ ...f, q }));
  const [showFilters, setShowFilters] = useState(false);
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const isSearching = searchQuery.trim().length > 0;
  const hasMoreFilters = Boolean(minBudget || maxBudget || startDate || endDate);

  const clearSearch = () => {
    setSearchQuery('');
    // Refocus the visible input
    if (window.innerWidth >= 1024) {
      searchInputRef.current?.focus();
    } else {
      mobileSearchInputRef.current?.focus();
    }
  };

  const filteredTrips = trips;

  return (
    <div className="pb-28 lg:pb-10">
      {/* Personal header */}
      <header className="flex items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={user?.avatar ?? null} name={user?.name ?? 'Traveller'} size={46} />
          <div className="leading-tight min-w-0">
            <p className="text-[#94A3B8]" style={{ fontSize: 13 }}>
              {greeting()},
            </p>
            <p className="text-[#0F172A] truncate" style={{ fontSize: 18, fontWeight: 700 }}>
              {firstName}
            </p>
          </div>
        </div>

        {/* Desktop inline search */}
        <div className="hidden lg:flex flex-1 max-w-md items-center gap-2 bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3">
          <Search size={20} className="text-[#94A3B8]" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search destinations, trips, travelers…"
            className="flex-1 bg-transparent outline-none text-[#0F172A] placeholder:text-[#94A3B8]"
          />
          {isSearching && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="text-[#94A3B8] hover:text-[#0F172A] transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <NotificationsBell />
      </header>

      {/* Mobile search */}
      <div className="lg:hidden flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3 mb-6">
        <Search size={20} className="text-[#94A3B8]" />
        <input
          ref={mobileSearchInputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search destinations, trips…"
          className="flex-1 bg-transparent outline-none text-[#0F172A] placeholder:text-[#94A3B8]"
        />
        {isSearching && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="text-[#94A3B8] hover:text-[#0F172A] transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Hero: hidden while searching */}
      {!isSearching && (
        <div className="relative overflow-hidden rounded-3xl mb-7 bg-[#0F172A] lg:min-h-[220px] flex items-end">
          <img src={HERO_IMG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A]/85 via-[#0F172A]/40 to-transparent" />
          <div className="relative p-6 lg:p-9">
            <h1 className="tracking-tight leading-[1.08]" style={{ fontSize: 34, fontWeight: 800 }}>
              <span className="text-white">Where will you </span>
              <span className="text-[#93C5FD]">go next?</span>
            </h1>
            <p className="text-white/80 mt-2 max-w-md" style={{ fontSize: 15 }}>
              Discover groups forming now across India and join the journey.
            </p>
            <button
              onClick={onPost}
              className="mt-5 bg-white text-[#2563EB] rounded-full px-5 py-2.5 hover:bg-[#EFF6FF] transition-colors"
              style={{ fontSize: 14, fontWeight: 700 }}
            >
              Post a trip
            </button>
          </div>
        </div>
      )}

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
          {/* Category pills + budget/date filters: hidden while searching */}
          {!isSearching && (
            <div className="mb-7">
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
                {CATEGORIES.map((c) => (
                  <Pill key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                    {c}
                  </Pill>
                ))}
                <button
                  type="button"
                  onClick={() => setShowFilters((s) => !s)}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-full px-4 py-2 border transition-colors',
                    showFilters || hasMoreFilters
                      ? 'bg-[#2563EB] text-white border-[#2563EB]'
                      : 'bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB]',
                  )}
                  style={{ fontSize: 14, fontWeight: 600 }}
                >
                  Budget & dates{hasMoreFilters ? ' ·' : ''}
                </button>
              </div>

              {showFilters && (
                <div className="flex flex-wrap items-end gap-4 mt-3 bg-white border border-[#E2E8F0] rounded-2xl p-4">
                  <div>
                    <label className="block text-[#94A3B8] mb-1" style={{ fontSize: 12, fontWeight: 600 }}>
                      Budget (₹)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={minBudget}
                        onChange={(e) => setFilters((f) => ({ ...f, minBudget: e.target.value }))}
                        placeholder="Min"
                        className="w-24 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                      />
                      <span className="text-[#94A3B8]">–</span>
                      <input
                        type="number"
                        min={0}
                        value={maxBudget}
                        onChange={(e) => setFilters((f) => ({ ...f, maxBudget: e.target.value }))}
                        placeholder="Max"
                        className="w-24 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#94A3B8] mb-1" style={{ fontSize: 12, fontWeight: 600 }}>
                      Travel dates
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                        className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                      />
                      <span className="text-[#94A3B8]">–</span>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate || undefined}
                        onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                        className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  </div>
                  {hasMoreFilters && (
                    <button
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, minBudget: '', maxBudget: '', startDate: '', endDate: '' }))}
                      className="text-[#2563EB] hover:text-[#1D4ED8] text-sm font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Trending destinations: hidden while searching */}
          {!isSearching && (
            <section className="mb-8">
              <SectionHeader title="Trending Destinations" action="See All" />
              <div className="flex gap-5 overflow-x-auto scrollbar-none pb-1">
                {TRENDING.map((d) => (
                  <button key={d.name} className="flex flex-col items-center gap-2 shrink-0 group">
                    <span className="w-[72px] h-[72px] rounded-full overflow-hidden ring-2 ring-[#E2E8F0] group-hover:ring-[#2563EB] transition-all bg-[#F1F5F9]">
                      <img src={d.image} alt={d.name} className="w-full h-full object-cover" loading="lazy" />
                    </span>
                    <span className="text-[#64748B]" style={{ fontSize: 13, fontWeight: 600 }}>
                      {d.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Groups forming now (real data), always visible */}
          <section className="mb-9">
            <SectionHeader title={isSearching ? `Results for "${searchQuery.trim()}"` : 'Groups Forming Now'} />
            {filteredTrips.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#0F172A] font-semibold">
                  {isSearching ? `No trips found for "${searchQuery.trim()}".` : 'No trips match this vibe.'}
                </p>
                <p className="text-[#64748B] text-sm mt-1">Be the first to post one!</p>
                <button
                  onClick={onPost}
                  className="mt-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
                >
                  Post a trip
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredTrips.map((t) => (
                    <TripCard key={t.id} trip={t} currentUserId={currentUserId} />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-7">
                    <button
                      type="button"
                      onClick={onLoadMore}
                      disabled={loadingMore}
                      className="rounded-full border border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-60 text-[#64748B] px-6 py-2.5 transition-colors"
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

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        className="relative w-11 h-11 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#2563EB] transition-colors"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-outside backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.16)] z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-[#0F172A] font-bold text-sm">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[#2563EB] text-xs font-semibold hover:text-[#1D4ED8] transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-[#94A3B8] text-sm text-center py-8">You're all caught up 🎉</p>
              ) : (
                notifications.map((n) => <NotificationRow key={n.id} n={n} onOpen={() => openNotification(n)} />)
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
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors',
        !n.read && 'bg-blue-50/60',
      )}
    >
      <span className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', meta.bg)}>
        <Icon size={16} className={meta.fg} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[#334155] text-[13px] leading-snug">{n.text}</p>
        <p className="text-[#94A3B8] text-[11px] mt-0.5">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.read && <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0 mt-1.5" />}
    </button>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-6 w-44 mb-4" />
        <div className="flex gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="w-[72px] h-[72px] rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-[24px] border border-[#E2E8F0] overflow-hidden">
              <Skeleton className="aspect-[16/10] rounded-none" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-9 w-16 rounded-full" />
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [view, setView] = useState<ViewState>('loading');
  const [filters, setFilters] = useState<FeedFilters>(EMPTY_FILTERS);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTrips = async (activeFilters: FeedFilters) => {
    setView('loading');
    try {
      const { data } = await api.get<{ trips: Trip[]; nextCursor: string | null }>(`/trips?${buildQuery(activeFilters, null)}`);
      setTrips(data.trips);
      setNextCursor(data.nextCursor);
      setView(data.trips.length === 0 ? 'empty' : 'ready');
    } catch {
      setView('error');
    }
  };

  // Re-fetch whenever a filter changes, debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => fetchTrips(filters), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get<{ trips: Trip[]; nextCursor: string | null }>(`/trips?${buildQuery(filters, nextCursor)}`);
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
