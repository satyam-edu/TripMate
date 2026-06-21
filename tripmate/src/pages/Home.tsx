import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Trip } from '../types';
import type { AuthUser } from '../context/AuthContext';
import TripCard from '../components/TripCard';
import { Avatar, Pill, SectionHeader, Skeleton, EmptyState, ErrorState, cn } from '../components/ui-bits';
import { Search, Bell, Compass, UserPlus, Check, MessageCircle, X } from 'lucide-react';

/* ── Categories (client-side filter over trip.tags) ─────────────────────────── */
const CATEGORIES = ['Mountains', 'Beaches', 'Culture', 'Adventure', 'Wildlife', 'Road Trip'] as const;

/* ── Mock content (no API yet — same as prior Home) ─────────────────────────── */
const TRENDING: { name: string; image: string }[] = [
  { name: 'Goa', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=200&h=200&fit=crop&auto=format' },
  { name: 'Manali', image: 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b?w=200&h=200&fit=crop&auto=format' },
  { name: 'Spiti', image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=200&h=200&fit=crop&auto=format' },
  { name: 'Kerala', image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=200&h=200&fit=crop&auto=format' },
  { name: 'Hampi', image: 'https://images.unsplash.com/photo-1600100397608-f010c1aefebc?w=200&h=200&fit=crop&auto=format' },
  { name: 'Ladakh', image: 'https://images.unsplash.com/photo-1581791534721-e599df4417f7?w=200&h=200&fit=crop&auto=format' },
];



const HERO_IMG = 'https://images.unsplash.com/photo-1581791534721-e599df4417f7?w=1400&h=500&fit=crop&auto=format';

/* ── Notifications (mock shell) ─────────────────────────────────────────────── */
type NotificationType = 'NEW_REQUEST' | 'ACCEPTED' | 'MESSAGE';
interface AppNotification {
  id: string;
  type: NotificationType;
  text: string;
  time: string;
  read: boolean;
}
const INITIAL_NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', type: 'NEW_REQUEST', text: 'Rohan requested to join Spiti Valley', time: '2m ago', read: false },
  { id: 'n2', type: 'ACCEPTED', text: 'Your request for Goa Coastline was accepted!', time: '1h ago', read: false },
  { id: 'n3', type: 'MESSAGE', text: 'New message in Manali & Kasol group', time: '3h ago', read: true },
];
const NOTI_META: Record<NotificationType, { Icon: typeof UserPlus; bg: string; fg: string }> = {
  NEW_REQUEST: { Icon: UserPlus, bg: 'bg-blue-50', fg: 'text-blue-600' },
  ACCEPTED: { Icon: Check, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  MESSAGE: { Icon: MessageCircle, bg: 'bg-violet-50', fg: 'text-violet-600' },
};

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
function HomeFeed({
  trips,
  view,
  onRetry,
  onPost,
  currentUserId,
  user,
}: {
  trips: Trip[];
  view: ViewState;
  onRetry: () => void;
  onPost: () => void;
  currentUserId: string;
  user: AuthUser | null;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const isSearching = searchQuery.trim().length > 0;

  const clearSearch = () => {
    setSearchQuery('');
    // Refocus the visible input
    if (window.innerWidth >= 1024) {
      searchInputRef.current?.focus();
    } else {
      mobileSearchInputRef.current?.focus();
    }
  };

  // Combined client-side filter: category pill + case-insensitive smart search.
  const q = searchQuery.trim().toLowerCase();
  const filteredTrips = trips.filter((t) => {
    const matchesCategory = !category || t.tags.includes(category);
    const matchesSearch =
      !q ||
      t.destination.toLowerCase().includes(q) ||
      t.country.toLowerCase().includes(q) ||
      (t.description?.toLowerCase().includes(q) ?? false) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

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

      {/* Hero — hidden while searching */}
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
          {/* Category pills — hidden while searching */}
          {!isSearching && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-7 -mx-1 px-1">
              {CATEGORIES.map((c) => (
                <Pill key={c} active={category === c} onClick={() => setCategory((prev) => (prev === c ? null : c))}>
                  {c}
                </Pill>
              ))}
            </div>
          )}

          {/* Trending destinations — hidden while searching */}
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

          {/* Groups forming now (real data) — always visible */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredTrips.map((t) => (
                  <TripCard key={t.id} trip={t} currentUserId={currentUserId} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ── Notifications bell + dropdown shell ────────────────────────────────────── */
function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const unread = notifications.filter((n) => !n.read).length;
  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative w-11 h-11 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:text-[#2563EB] transition-colors"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unread}
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
                notifications.map((n) => <NotificationRow key={n.id} n={n} />)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationRow({ n }: { n: AppNotification }) {
  const meta = NOTI_META[n.type];
  const Icon = meta.Icon;
  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0', !n.read && 'bg-blue-50/60')}>
      <span className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', meta.bg)}>
        <Icon size={16} className={meta.fg} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[#334155] text-[13px] leading-snug">{n.text}</p>
        <p className="text-[#94A3B8] text-[11px] mt-0.5">{n.time}</p>
      </div>
      {!n.read && <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0 mt-1.5" />}
    </div>
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
   PAGE (data fetching — renders inside the routed AppShell)
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [view, setView] = useState<ViewState>('loading');

  const fetchTrips = async () => {
    setView('loading');
    try {
      const { data } = await api.get<Trip[]>('/trips');
      setTrips(data);
      setView(data.length === 0 ? 'empty' : 'ready');
    } catch {
      setView('error');
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  return (
    <HomeFeed
      trips={trips}
      view={view}
      onRetry={fetchTrips}
      onPost={() => navigate('/post')}
      currentUserId={user?.id ?? ''}
      user={user}
    />
  );
}
