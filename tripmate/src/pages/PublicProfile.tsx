import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BadgeCheck, Calendar, Compass, Link2, MapPin, Star, Wallet } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Avatar, ErrorState, Skeleton, cn, formatBudget, formatDateRange, tagColor } from '../components/ui-bits';

/* ── Types (match GET /api/users/:id — private fields already stripped server-side) ── */
interface PublicTrip {
  id: string;
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  budget: number;
  tags: string[];
  coverImage: string | null;
}

interface PublicUser {
  id: string;
  name: string;
  avatar: string | null;
  coverImage: string | null;
  bio: string | null;
  location: string | null;
  socialHandle: string | null;
  tags: string[];
  createdAt: string;
  trips: PublicTrip[];
  avgRating: number | null;
  reviews: {
    id: string;
    rating: number;
    text: string | null;
    createdAt: string;
    trip: { id: string; destination: string };
    reviewer: { id: string; name: string; avatar: string | null };
  }[];
}

type ViewState = 'loading' | 'notfound' | 'error' | 'ready';

const COVER = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&h=400&fit=crop&auto=format';
const normalizeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const memberSince = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

/* ═══════════════════════════════════════════════════════════════════════════════
   PUBLIC PROFILE  (/users/:id — anyone's read-only profile, before you join their trip)
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();

  const [view, setView] = useState<ViewState>('loading');
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (id === me?.id) return; // redirected below, to the editable version
    let cancelled = false;
    setView('loading');
    api
      .get<PublicUser>(`/users/${id}`)
      .then(({ data }) => {
        if (!cancelled) {
          setProfile(data);
          setView('ready');
        }
      })
      .catch((err) => {
        if (!cancelled) setView(err?.response?.status === 404 ? 'notfound' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [id, me?.id, reloadKey]);

  // Your own profile is the editable one.
  if (id === me?.id) return <Navigate to="/profile" replace />;

  if (view === 'loading') return <ProfileSkeleton />;
  if (view === 'error') return <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />;
  if (view === 'notfound' || !profile) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-900 text-lg font-bold">This traveller couldn't be found.</p>
        <Link
          to="/"
          className="inline-block mt-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          Explore trips
        </Link>
      </div>
    );
  }

  const upcoming = profile.trips.filter((t) => new Date(t.startDate) >= new Date());

  return (
    <div className="pb-28 lg:pb-10 max-w-4xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative">
        <div className="h-40 sm:h-52 rounded-3xl overflow-hidden bg-slate-100">
          <img src={profile.coverImage || COVER} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute -bottom-8 left-5">
          <span className="block ring-4 ring-white rounded-full">
            <Avatar src={profile.avatar} name={profile.name} size={88} />
          </span>
        </div>
      </div>

      <div className="mt-12 px-1">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight truncate">{profile.name}</h1>
          <span title="Verified via Google" className="text-blue-600 shrink-0">
            <BadgeCheck size={20} />
          </span>
        </div>
        <p className="text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-1">
          {profile.avgRating !== null && (
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <Star size={14} className="text-amber-400" fill="currentColor" />
              {profile.avgRating} <span className="text-slate-400 font-normal">({profile.reviews.length})</span>
            </span>
          )}
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin size={14} className="text-slate-400" /> {profile.location}
            </span>
          )}
          <span>On TripMate since {memberSince(profile.createdAt)}</span>
        </p>

        {profile.bio && <p className="text-slate-600 text-sm mt-4 leading-relaxed">{profile.bio}</p>}

        {profile.socialHandle && (
          <a
            href={normalizeUrl(profile.socialHandle)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-slate-700 border border-slate-200 rounded-full px-3.5 py-1.5 hover:border-blue-600 hover:text-blue-600 transition-colors"
          >
            <Link2 size={16} /> Social profile
          </a>
        )}

        {profile.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {profile.tags.map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-[13px] font-semibold">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Reviews ─────────────────────────────────────────────────────────── */}
      {profile.reviews.length > 0 && (
        <div className="mt-8 px-1">
          <h2 className="text-slate-900 font-bold text-lg mb-4">
            Reviews <span className="ml-1.5 text-slate-400 font-semibold">{profile.reviews.length}</span>
          </h2>
          <div className="space-y-3">
            {profile.reviews.map((r) => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <Avatar src={r.reviewer.avatar} name={r.reviewer.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-900 font-semibold text-sm truncate">{r.reviewer.name}</p>
                    <p className="text-slate-400 text-xs truncate">{r.trip.destination}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0 text-amber-400">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={13} fill={i < r.rating ? 'currentColor' : 'none'} strokeWidth={1.75} />
                    ))}
                  </div>
                </div>
                {r.text && <p className="text-slate-600 text-sm mt-2 leading-relaxed">{r.text}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hosted trips ────────────────────────────────────────────────────── */}
      <div className="mt-8 px-1">
        <h2 className="text-slate-900 font-bold text-lg mb-4">
          Trips hosted by {profile.name.split(' ')[0]}
          <span className="ml-1.5 text-slate-400 font-semibold">{profile.trips.length}</span>
        </h2>

        {profile.trips.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
              <Compass size={30} />
            </div>
            <p className="text-slate-900 font-bold">Hasn't hosted a trip yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {profile.trips.map((t) => (
              <PublicTripCard key={t.id} trip={t} isPast={!upcoming.includes(t)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Trip card (read-only — links to the full trip page to join) ────────────── */
function PublicTripCard({ trip, isPast }: { trip: PublicTrip; isPast: boolean }) {
  const coverUrl =
    trip.coverImage || `https://loremflickr.com/600/400/${encodeURIComponent(trip.destination.split(',')[0]?.trim() ?? 'travel')}/travel`;
  const tag = trip.tags[0];

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_36px_rgba(15,23,42,0.10)] transition-shadow"
    >
      <div className="relative">
        <div className="aspect-[16/10] bg-slate-100">
          <img
            src={coverUrl}
            alt={trip.destination}
            className={cn('w-full h-full object-cover', isPast && 'grayscale-[40%] opacity-80')}
            loading="lazy"
          />
        </div>
        {tag && (
          <span className={cn('absolute top-3 left-3 text-white rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm', tagColor(tag))}>
            {tag}
          </span>
        )}
        {isPast && (
          <span className="absolute top-3 right-3 bg-white/95 text-slate-500 rounded-full px-3 py-1 text-[11px] font-semibold">
            Past trip
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1.5 text-slate-900 min-w-0 mb-1">
          <MapPin size={16} className="text-blue-600 shrink-0" />
          <span className="text-[17px] font-bold truncate">{trip.destination}</span>
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
    </Link>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto">
      <Skeleton className="h-40 sm:h-52 rounded-3xl" />
      <div className="mt-12 px-1 space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
