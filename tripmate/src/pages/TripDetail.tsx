import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Check,
  Link2,
  MapPin,
  MessageCircle,
  Share2,
  Star,
  Users,
  Wallet,
} from 'lucide-react';
import api, { apiErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Avatar, ErrorState, Skeleton, cn, formatBudget, formatDateRange, tagColor } from '../components/ui-bits';

/* ── Types (match GET /api/trips/:id) ───────────────────────────────────────── */
interface Person {
  id: string;
  name: string;
  avatar: string | null;
}

interface TripDetailData {
  id: string;
  hostId: string;
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  budget: number;
  maxGuests: number;
  tags: string[];
  coverImage: string | null;
  description: string | null;
  host: Person & { bio: string | null; location: string | null; socialHandle: string | null };
  members: Person[]; // approved travellers (host not included)
  myRequest: { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' } | null;
}

type ViewState = 'loading' | 'notfound' | 'error' | 'ready';

const normalizeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

/* ═══════════════════════════════════════════════════════════════════════════════
   TRIP DETAIL  (/trips/:id, shareable link)
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewState>('loading');
  const [trip, setTrip] = useState<TripDetailData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [pitch, setPitch] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<TripDetailData>(`/trips/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        setTrip(data);
        setView('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setView(err?.response?.status === 404 ? 'notfound' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (view === 'loading') return <DetailSkeleton />;
  if (view === 'error') return <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />;
  if (view === 'notfound' || !trip) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-900 text-lg font-bold">This trip doesn't exist anymore.</p>
        <p className="text-slate-500 text-sm mt-1">The host may have deleted it.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          Explore trips
        </button>
      </div>
    );
  }

  const isHost = user?.id === trip.hostId;
  const spotsFilled = trip.members.length + 1; // host takes a spot
  const isFull = spotsFilled >= trip.maxGuests;
  const hasStarted = new Date(trip.startDate) <= new Date();
  const hasEnded = new Date(trip.endDate) <= new Date();
  const status = trip.myRequest?.status;
  const hostFirst = trip.host.name.split(' ')[0];
  const cover =
    trip.coverImage ||
    `https://loremflickr.com/1200/600/${encodeURIComponent(trip.destination.split(',')[0]?.trim() ?? 'travel')}/travel`;

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${trip.destination} trip on TripMate`, url });
      } catch {
        // user closed the share sheet
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const join = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      const { data } = await api.post<{ id: string }>('/requests', { tripId: trip.id, message: pitch.trim() || undefined });
      setTrip({ ...trip, myRequest: { id: data.id, status: 'PENDING' } });
      setPitch('');
    } catch (err) {
      setJoinError(apiErrorMessage(err, 'Could not send your request. Please try again.'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="pb-28 lg:pb-10 max-w-5xl mx-auto">
      {/* Back */}
      <button
        type="button"
        onClick={() => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate('/'))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* ── Cover ───────────────────────────────────────────────────────────── */}
      <div className="relative h-56 sm:h-72 rounded-3xl overflow-hidden bg-slate-100">
        <img src={cover} alt={trip.destination} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
        <button
          type="button"
          onClick={() => void share()}
          className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-white/95 hover:bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow transition-colors"
        >
          {copied ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
          {copied ? 'Link copied' : 'Share'}
        </button>
        <div className="absolute bottom-5 left-5 right-5 flex flex-col-reverse sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-white text-3xl sm:text-4xl font-extrabold tracking-tight truncate">{trip.destination}</h1>
            <p className="text-white/80 flex items-center gap-1 text-sm mt-1">
              <MapPin size={14} /> {trip.country}
            </p>
          </div>
          {/* Categories: below the title on phones, bottom-right corner of the cover from sm+ */}
          {trip.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:justify-end sm:max-w-[50%] sm:shrink-0">
              {trip.tags.slice(0, 4).map((t) => (
                <span key={t} className={cn('rounded-full px-3 py-1 text-xs font-semibold text-white', tagColor(t))}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Key facts ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        <Fact icon={<Calendar size={18} />} label="Dates" value={formatDateRange(trip.startDate, trip.endDate)} />
        <Fact icon={<Wallet size={18} />} label="Budget" value={formatBudget(trip.budget)} />
        <Fact icon={<Users size={18} />} label="Spots" value={`${spotsFilled}/${trip.maxGuests} filled`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] mt-6 items-start">
        {/* ── Left: about + who's going ─────────────────────────────────────── */}
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-3xl p-5">
            <h2 className="text-slate-900 font-bold text-lg mb-2">About this trip</h2>
            <p className="text-slate-600 text-[15px] leading-relaxed whitespace-pre-wrap">
              {trip.description ||
                (isHost
                  ? "You haven't added a description yet. Add one with \"Edit trip in Profile\" so travellers know the plan."
                  : `${hostFirst} hasn't added a description yet. Send them a message to ask about the plan.`)}
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-5">
            <h2 className="text-slate-900 font-bold text-lg mb-3">
              Who's going <span className="text-slate-400 font-semibold">· {spotsFilled}</span>
            </h2>
            <ul className="space-y-3">
              <PersonRow person={trip.host} note="Host" />
              {trip.members.map((m) => (
                <PersonRow key={m.id} person={m} note={m.id === user?.id ? 'You' : undefined} />
              ))}
            </ul>
            {!isFull && (
              <p className="text-slate-400 text-sm mt-3">
                {trip.maxGuests - spotsFilled} {trip.maxGuests - spotsFilled === 1 ? 'spot' : 'spots'} left
              </p>
            )}
          </section>

          {hasEnded && (isHost || status === 'APPROVED') && <ReviewSection tripId={trip.id} />}
        </div>

        {/* ── Right: action + host ──────────────────────────────────────────── */}
        <div className="space-y-6 lg:sticky lg:top-6">
          <section className="bg-white border border-slate-200 rounded-3xl p-5">
            {isHost ? (
              <>
                <p className="text-slate-900 font-bold">This is your trip</p>
                <p className="text-slate-500 text-sm mt-1">Manage requests and edit details from your dashboard.</p>
                <div className="flex flex-col gap-2 mt-4">
                  <Link to={`/chats?tab=groups&chatId=${trip.id}`} className={primaryBtn}>
                    <MessageCircle size={16} /> Open group chat
                  </Link>
                  <Link to="/requests" className={secondaryBtn}>
                    View join requests
                  </Link>
                  <Link to="/profile" className={secondaryBtn}>
                    Edit trip in Profile
                  </Link>
                </div>
              </>
            ) : status === 'APPROVED' ? (
              <>
                <StatusPill tone="green">You're going 🎉</StatusPill>
                <Link to={`/chats?tab=groups&chatId=${trip.id}`} className={cn(primaryBtn, 'mt-4')}>
                  <MessageCircle size={16} /> Open group chat
                </Link>
              </>
            ) : status === 'PENDING' ? (
              <>
                <StatusPill tone="blue">Request sent · waiting for {hostFirst}</StatusPill>
                <Link to={`/chats?tab=inquiries&chatId=${trip.myRequest!.id}`} className={cn(primaryBtn, 'mt-4')}>
                  <MessageCircle size={16} /> Message {hostFirst}
                </Link>
              </>
            ) : status === 'REJECTED' ? (
              <StatusPill tone="red">Your request was declined</StatusPill>
            ) : hasStarted ? (
              <StatusPill tone="grey">This trip has already started</StatusPill>
            ) : isFull ? (
              <StatusPill tone="grey">This trip is full</StatusPill>
            ) : (
              <>
                <p className="text-slate-900 font-bold">Want to join?</p>
                <p className="text-slate-500 text-sm mt-1">Say hi to {hostFirst}. A good note helps your chances.</p>
                <textarea
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="e.g. I've done two Himalayan treks and would love to join!"
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 resize-none"
                />
                {joinError && <p className="text-red-500 text-sm mt-2">{joinError}</p>}
                <button type="button" onClick={() => void join()} disabled={joining} className={cn(primaryBtn, 'mt-3 w-full')}>
                  {joining ? 'Sending…' : 'Request to join'}
                </button>
              </>
            )}
          </section>

          {/* Host card */}
          <section className="bg-white border border-slate-200 rounded-3xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Hosted by</p>
            <Link to={`/users/${trip.hostId}`} className="flex items-center gap-3 group">
              <Avatar src={trip.host.avatar} name={trip.host.name} size={52} />
              <div className="min-w-0">
                <p className="text-slate-900 font-bold truncate group-hover:text-blue-600 transition-colors">{trip.host.name}</p>
                {trip.host.location && (
                  <p className="text-slate-500 text-sm flex items-center gap-1 truncate">
                    <MapPin size={13} /> {trip.host.location}
                  </p>
                )}
              </div>
            </Link>
            {trip.host.bio && <p className="text-slate-600 text-sm mt-3 leading-relaxed">{trip.host.bio}</p>}
            {trip.host.socialHandle && (
              <a
                href={normalizeUrl(trip.host.socialHandle)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                <Link2 size={14} /> Social profile
              </a>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Small pieces ───────────────────────────────────────────────────────────── */
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors';
const secondaryBtn =
  'inline-flex items-center justify-center rounded-full border border-slate-200 hover:border-blue-600 hover:text-blue-600 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors';

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-blue-600">
        {icon}
        <span className="text-xs font-semibold text-slate-400">{label}</span>
      </div>
      <p className="text-slate-900 font-bold text-sm sm:text-base mt-1 truncate">{value}</p>
    </div>
  );
}

function PersonRow({ person, note }: { person: Person; note?: string }) {
  return (
    <li className="flex items-center gap-3">
      <Avatar src={person.avatar} name={person.name} size={40} />
      <span className="text-slate-900 font-semibold text-[15px] truncate">{person.name}</span>
      {note && (
        <span className="ml-auto shrink-0 rounded-full bg-blue-50 text-blue-600 px-2.5 py-0.5 text-xs font-semibold">
          {note}
        </span>
      )}
    </li>
  );
}

function StatusPill({ tone, children }: { tone: 'green' | 'blue' | 'red' | 'grey'; children: React.ReactNode }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-600',
    grey: 'bg-slate-100 text-slate-600',
  };
  return <p className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', tones[tone])}>{children}</p>;
}

/* ── Rate your trip: shown once the trip has ended, to the host and approved travellers ── */
interface ReviewPerson {
  id: string;
  name: string;
  avatar: string | null;
}
interface ReviewState {
  eligible: boolean;
  pending: ReviewPerson[];
  given: { revieweeId: string; rating: number; text: string | null }[];
}

function ReviewSection({ tripId }: { tripId: string }) {
  const [state, setState] = useState<ReviewState | null>(null);
  const [rating, setRating] = useState<Record<string, number>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .get<ReviewState>(`/trips/${tripId}/reviews`)
      .then(({ data }) => setState(data))
      .catch((err) => console.error('[ReviewSection] load failed', err));
  };
  useEffect(load, [tripId]);

  if (!state?.eligible) return null;

  const submit = async (person: ReviewPerson) => {
    const stars = rating[person.id] ?? 0;
    if (stars < 1) {
      setError('Pick a star rating first.');
      return;
    }
    setSubmitting(person.id);
    setError(null);
    try {
      await api.post(`/trips/${tripId}/reviews`, { revieweeId: person.id, rating: stars, text: text[person.id]?.trim() });
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save your review. Please try again.'));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-3xl p-5">
      <h2 className="text-slate-900 font-bold text-lg mb-1">Rate your trip</h2>
      <p className="text-slate-500 text-sm mb-4">Help other travellers know who to trust.</p>

      {state.pending.length === 0 && state.given.length === 0 && (
        <p className="text-slate-400 text-sm">Nothing to review — you were on this trip alone.</p>
      )}

      {state.pending.map((person) => (
        <div key={person.id} className="flex items-start gap-3 py-3 border-t border-slate-100 first:border-0 first:pt-0">
          <Avatar src={person.avatar} name={person.name} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 font-semibold text-[15px] truncate">{person.name}</p>
            <StarPicker
              value={rating[person.id] ?? 0}
              onChange={(v) => setRating((r) => ({ ...r, [person.id]: v }))}
            />
            <textarea
              value={text[person.id] ?? ''}
              onChange={(e) => setText((t) => ({ ...t, [person.id]: e.target.value }))}
              rows={2}
              maxLength={500}
              placeholder="Optional note about travelling with them…"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 resize-none"
            />
            <button
              type="button"
              onClick={() => void submit(person)}
              disabled={submitting === person.id}
              className="mt-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-1.5 transition-colors"
            >
              {submitting === person.id ? 'Saving…' : 'Submit review'}
            </button>
          </div>
        </div>
      ))}

      {state.given.length > 0 && (
        <p className="text-emerald-600 text-sm font-semibold mt-1">
          {state.pending.length === 0 ? 'You reviewed everyone on this trip. Thanks!' : `${state.given.length} review(s) submitted.`}
        </p>
      )}

      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </section>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5 mt-1.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          className="text-amber-400 hover:scale-110 transition-transform"
        >
          <Star size={20} fill={n <= value ? 'currentColor' : 'none'} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-56 sm:h-72 rounded-3xl" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}
