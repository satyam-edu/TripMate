import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Calendar, Wallet, Users, Compass, BadgeCheck, Link2, Pencil, X, LogOut } from 'lucide-react';
import api from '../services/api';
import type { Trip } from '../types';
import { useAuth } from '../context/AuthContext';
import { Avatar, Skeleton, tagColor, formatDateRange, formatBudget, cn } from '../components/ui-bits';

const COVER = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&h=400&fit=crop&auto=format';

const VIBE_OPTIONS = [
  'Mountains', 'Beaches', 'Culture', 'Adventure', 'Wildlife', 'Road Trip',
  'Trekking', 'Photography', 'Food & Cafés', 'Nightlife', 'Relaxation', 'Slow travel',
];

type ProfileTab = 'hosted' | 'joined';
type ViewState = 'loading' | 'error' | 'ready';

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
function socialLabel(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) return 'Instagram';
  if (u.includes('linkedin.com')) return 'LinkedIn';
  return 'Profile';
}

// Inline brand SVGs (monochrome via currentColor → stays soft/consistent with the pill).
function SocialIcon({ url, size = 16 }: { url: string; size?: number }) {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 1.802c-2.67 0-2.986.01-4.04.058-.976.045-1.505.207-1.858.344-.466.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.048 1.055-.058 1.37-.058 4.041 0 2.67.01 2.986.058 4.04.045.977.207 1.505.344 1.858.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058 2.67 0 2.987-.01 4.04-.058.977-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041 0-2.67-.01-2.986-.058-4.04-.045-.977-.207-1.505-.344-1.858a3.097 3.097 0 0 0-.748-1.15 3.098 3.098 0 0 0-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.055-.048-1.37-.058-4.041-.058zm0 3.063a5.135 5.135 0 1 1 0 10.27 5.135 5.135 0 0 1 0-10.27zm0 8.468a3.333 3.333 0 1 0 0-6.666 3.333 3.333 0 0 0 0 6.666zm6.538-8.671a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" />
      </svg>
    );
  }
  if (u.includes('linkedin.com')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    );
  }
  return <Link2 size={size} />;
}

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Tab is synced to the URL (?tab=hosted | ?tab=joined).
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ProfileTab = searchParams.get('tab') === 'joined' ? 'joined' : 'hosted';
  const setTab = (t: ProfileTab) => setSearchParams({ tab: t });

  // Edit modal is deep-linked via ?modal=editProfile (preserves ?tab).
  const isEditOpen = searchParams.get('modal') === 'editProfile';
  const openEdit = () =>
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('modal', 'editProfile');
      return p;
    });
  const closeEdit = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      navigate(-1);
    } else {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete('modal');
          return p;
        },
        { replace: true },
      );
    }
  };

  const [hosted, setHosted] = useState<Trip[]>([]);
  const [joined, setJoined] = useState<Trip[]>([]);
  const [view, setView] = useState<ViewState>('loading');

  const fetchTrips = async () => {
    setView('loading');
    try {
      const [hostedRes, joinedRes] = await Promise.all([
        api.get<Trip[]>('/trips/hosted'),
        api.get<Trip[]>('/trips/joined'),
      ]);
      setHosted(hostedRes.data);
      setJoined(joinedRes.data);
      setView('ready');
    } catch (error) {
      console.error('[Profile] fetch failed', error);
      setView('error');
    }
  };

  useEffect(() => {
    void fetchTrips();
  }, []);

  const name = user?.name ?? 'Traveller';
  const vibes = user?.tags?.length ? user.tags : ['Mountains', 'Photography', 'Slow travel'];
  const list = tab === 'hosted' ? hosted : joined;

  const TABS: { id: ProfileTab; label: string; count: number }[] = [
    { id: 'hosted', label: 'Hosted Trips', count: hosted.length },
    { id: 'joined', label: 'Joined Trips', count: joined.length },
  ];

  const social = user?.socialHandle;

  return (
    <div className="pb-28 lg:pb-10 max-w-4xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative">
        <div className="h-40 sm:h-52 rounded-3xl overflow-hidden bg-slate-100">
          <img src={COVER} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute -bottom-8 left-5">
          <span className="block ring-4 ring-white rounded-full">
            <Avatar src={user?.avatar ?? null} name={name} size={88} />
          </span>
        </div>
      </div>

      <div className="mt-12 px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight truncate">{name}</h1>
              {/* Trust signal: Google-verified identity */}
              <span title="Verified via Google" className="text-blue-600 shrink-0">
                <BadgeCheck size={20} />
              </span>
            </div>
            <p className="text-slate-500 flex items-center gap-1 text-sm mt-1">
              <MapPin size={14} className="text-slate-400" /> {user?.location ?? 'Traveler'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openEdit}
              className="flex items-center gap-2 border border-blue-200 text-blue-600 rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-blue-50 transition-colors"
            >
              <Pencil size={15} /> Edit Profile
            </button>
            {/* Mobile-only sign out — the sidebar handles logout on desktop (lg+) */}
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="flex lg:hidden items-center justify-center w-10 h-10 border border-slate-200 text-slate-500 rounded-full hover:border-red-500 hover:text-red-500 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <p className="text-slate-600 text-sm mt-4 leading-relaxed">
          {user?.bio ?? 'Adventurer at heart — here to find a travel tribe and explore India together.'}
        </p>

        {/* Trust signal: social proof link */}
        {social && (
          <a
            href={normalizeUrl(social)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-slate-700 border border-slate-200 rounded-full px-3.5 py-1.5 hover:border-blue-600 hover:text-blue-600 transition-colors"
          >
            <SocialIcon url={social} size={16} /> {socialLabel(social)}
          </a>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {vibes.map((v) => (
            <span key={v} className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-[13px] font-semibold">
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="mt-8 px-1">
        <div className="inline-flex bg-slate-100 rounded-full p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-semibold transition-colors',
                tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500',
              )}
            >
              {t.label}
              {view === 'ready' && <span className="ml-1.5 opacity-70">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="mt-5 px-1">
        {view === 'loading' && <TripGridSkeleton />}

        {view === 'error' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-slate-900 font-semibold">Couldn't load your trips.</p>
            <button
              onClick={fetchTrips}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {view === 'ready' &&
          (list.length === 0 ? (
            <EmptyState tab={tab} onCta={() => navigate(tab === 'hosted' ? '/post' : '/')} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {list.map((trip) => (
                <ProfileTripCard key={trip.id} trip={trip} kind={tab} />
              ))}
            </div>
          ))}
      </div>

      {/* ── Edit Profile modal ──────────────────────────────────────────────── */}
      {isEditOpen && <EditProfileModal onClose={closeEdit} onSaved={updateUser} />}
    </div>
  );
}

/* ── Edit Profile modal (Soft UI) ───────────────────────────────────────────── */
function EditProfileModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (partial: { bio: string | null; location: string | null; socialHandle: string | null; tags: string[] }) => void;
}) {
  const { user } = useAuth();
  const [location, setLocation] = useState(user?.location ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [social, setSocial] = useState(user?.socialHandle ?? '');
  const [vibes, setVibes] = useState<string[]>(user?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const toggleVibe = (v: string) =>
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    // Payload is structured for PATCH /api/users/me (real endpoint).
    const payload = {
      bio: bio.trim(),
      location: location.trim(),
      socialHandle: social.trim(),
      tags: vibes,
    };
    try {
      const { data } = await api.patch('/users/me', payload);
      onSaved({
        bio: data.bio ?? null,
        location: data.location ?? null,
        socialHandle: data.socialHandle ?? null,
        tags: data.tags ?? [],
      });
      onClose();
    } catch (err) {
      console.error('[Profile] save failed', err);
      setError('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-extrabold text-slate-900">Edit Profile</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Location */}
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Location</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Delhi, India"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 transition-colors"
        />

        {/* Bio */}
        <label className="block text-sm font-semibold text-slate-700 mt-4 mb-1.5">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder="Tell fellow travelers a little about you…"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 resize-none transition-colors"
        />
        <p className="text-right text-xs text-slate-400 mt-1">{bio.length}/280</p>

        {/* Social handle */}
        <label className="block text-sm font-semibold text-slate-700 mt-2 mb-1.5">
          Instagram / LinkedIn <span className="font-normal text-slate-400">(builds trust)</span>
        </label>
        <input
          value={social}
          onChange={(e) => setSocial(e.target.value)}
          placeholder="instagram.com/yourhandle"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 transition-colors"
        />

        {/* Vibes */}
        <label className="block text-sm font-semibold text-slate-700 mt-4 mb-2">Travel vibes</label>
        <div className="flex flex-wrap gap-2">
          {VIBE_OPTIONS.map((v) => {
            const on = vibes.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggleVibe(v)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[13px] font-semibold border transition-colors',
                  on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-600',
                )}
              >
                {v}
              </button>
            );
          })}
        </div>

        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Compact trip card (dashboard — no Join button) ─────────────────────────── */
function ProfileTripCard({ trip, kind }: { trip: Trip; kind: ProfileTab }) {
  const coverUrl =
    trip.coverImage ||
    `https://loremflickr.com/600/400/${encodeURIComponent(trip.destination.split(',')[0]?.trim() ?? 'travel')}/travel`;
  const tag = trip.tags[0];
  const spotsFilled = (trip._count?.requests ?? 0) + 1;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
      <div className="relative">
        <div className="aspect-[16/10] bg-slate-100">
          <img src={coverUrl} alt={trip.destination} className="w-full h-full object-cover" loading="lazy" />
        </div>
        {tag && (
          <span className={cn('absolute top-3 left-3 text-white rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm', tagColor(tag))}>
            {tag}
          </span>
        )}
        <span className="absolute top-3 right-3 bg-white/95 text-slate-900 rounded-full px-3 py-1 flex items-center gap-1 text-xs font-semibold">
          <Users size={12} className="text-blue-600" />
          {spotsFilled}/{trip.maxGuests}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 text-slate-900 min-w-0">
            <MapPin size={16} className="text-blue-600 shrink-0" />
            <span className="text-[17px] font-bold truncate">{trip.destination}</span>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              kind === 'hosted' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600',
            )}
          >
            {kind === 'hosted' ? 'Hosting' : 'Joined'}
          </span>
        </div>
        <p className="text-slate-400 text-[13px] mb-3">{trip.country}</p>
        <div className="flex items-center gap-4 text-slate-500 text-[13px]">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} /> {formatDateRange(trip.startDate, trip.endDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <Wallet size={14} /> {formatBudget(trip.budget)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────────── */
function EmptyState({ tab, onCta }: { tab: ProfileTab; onCta: () => void }) {
  const copy =
    tab === 'hosted'
      ? { title: "You aren't hosting any trips yet.", sub: 'Plan a trip and gather your travel tribe.', cta: 'Post a trip' }
      : { title: "You haven't joined any trips yet.", sub: 'Find a group heading where you want to go.', cta: 'Explore trips' };
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center flex flex-col items-center">
      <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
        <Compass size={30} />
      </div>
      <h3 className="text-slate-900 font-bold">{copy.title}</h3>
      <p className="text-slate-500 text-sm mt-1 max-w-xs">{copy.sub}</p>
      <button
        onClick={onCta}
        className="mt-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
      >
        {copy.cta}
      </button>
    </div>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────────────── */
function TripGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-3xl border border-slate-200 overflow-hidden">
          <Skeleton className="aspect-[16/10] rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}
