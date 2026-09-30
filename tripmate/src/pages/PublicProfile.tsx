import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BadgeCheck, Calendar, Compass, Flag, Link2, MapPin, MoreVertical, ShieldOff, Star, UserX, Wallet, X } from 'lucide-react';
import api, { apiErrorMessage } from '../services/api';
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
  blockedByMe: boolean;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggleBlock = async () => {
    if (!profile) return;
    const next = !profile.blockedByMe;
    if (next && !window.confirm(`Block ${profile.name}? They won't be able to message you or see your trips, and you won't see theirs.`)) return;
    setBlocking(true);
    setActionError(null);
    try {
      if (next) await api.post(`/users/${profile.id}/block`);
      else await api.delete(`/users/${profile.id}/block`);
      setProfile({ ...profile, blockedByMe: next });
      setMenuOpen(false);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setBlocking(false);
    }
  };

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
          <Avatar src={profile.avatar} name={profile.name} size={88} ring ringWidth={4} />
        </div>
      </div>

      <div className="mt-12 px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight truncate">{profile.name}</h1>
            <span title="Verified via Google" className="text-blue-600 shrink-0">
              <BadgeCheck size={20} />
            </span>
          </div>

          {/* Safety menu: report / block */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More options"
              className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
            >
              <MoreVertical size={17} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.16)] z-50 overflow-hidden py-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setReportOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Flag size={15} /> Report {profile.name.split(' ')[0]}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleBlock()}
                    disabled={blocking}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors"
                  >
                    {profile.blockedByMe ? <ShieldOff size={15} /> : <UserX size={15} />}
                    {profile.blockedByMe ? `Unblock ${profile.name.split(' ')[0]}` : `Block ${profile.name.split(' ')[0]}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {profile.blockedByMe && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold px-3 py-1">
            <ShieldOff size={12} /> You've blocked this person
          </p>
        )}
        {actionError && <p className="text-red-500 text-sm mt-2">{actionError}</p>}
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

      {reportOpen && <ReportModal name={profile.name} userId={profile.id} onClose={() => setReportOpen(false)} />}

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

/* ── Report modal ──────────────────────────────────────────────────────────── */
const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment or abuse' },
  { value: 'FAKE_PROFILE', label: 'Fake profile' },
  { value: 'SAFETY_CONCERN', label: 'Safety concern' },
  { value: 'OTHER', label: 'Something else' },
];

function ReportModal({ name, userId, onClose }: { name: string; userId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!reason) {
      setError('Please choose a reason.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.post(`/users/${userId}/report`, { reason, details: details.trim() || undefined });
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send your report. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-slate-900">{sent ? 'Report sent' : `Report ${name}`}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <p className="text-slate-600 text-sm mt-3">
            Thanks — we've received your report and will look into it. You don't need to do anything else.
          </p>
        ) : (
          <>
            <p className="text-slate-500 text-sm mt-1 mb-4">This is sent privately; {name.split(' ')[0]} won't be notified.</p>

            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 cursor-pointer hover:border-blue-600 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-blue-600"
                  />
                  {r.label}
                </label>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Anything else that would help us understand (optional)"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 resize-none"
            />

            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={sending}
                className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {sending ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
