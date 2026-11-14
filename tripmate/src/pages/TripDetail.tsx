import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Check,
  Link2,
  MessageCircle,
  Share2,
  Star,
  Users,
  Wallet,
} from 'lucide-react';
import api, { apiErrorMessage, cachedGet } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Avatar, CoverImg, ErrorState, Skeleton, cn, formatBudget, formatDateRange, tripPath, TEXT_STRONG, TEXT_SOFT } from '../components/ui-bits';

/* ── Types (match GET /api/trips/:id) ───────────────────────────────────────── */
interface Person {
  id: string;
  name: string;
  avatar: string | null;
}

interface TripDetailData {
  id: string;
  slug: string | null;
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
  womenOnly: boolean;
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
  const { id } = useParams<{ id: string }>(); // a slug or, for older links, the trip id
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cachedTrip] = useState(() => cachedGet<TripDetailData>(`/trips/${id}`));
  const [view, setView] = useState<ViewState>(cachedTrip ? 'ready' : 'loading');
  const [trip, setTrip] = useState<TripDetailData | null>(cachedTrip ?? null);
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
        // Older plain-id links get the readable URL (same page, no reload).
        if (window.location.pathname !== tripPath(data)) navigate(tripPath(data), { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        // A failed refresh keeps the cached trip on screen; a 404 means it's really gone.
        setView((v) => (err?.response?.status === 404 ? 'notfound' : v === 'ready' ? v : 'error'));
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey, navigate]);

  if (view === 'loading') return <DetailSkeleton />;
  if (view === 'error') return <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />;
  if (view === 'notfound' || !trip) {
    return (
      <div className="text-center py-20">
        <p className="text-[#222222] text-lg font-semibold">This trip doesn't exist anymore.</p>
        <p className="text-[#6A6A6A] text-sm mt-1">The host may have deleted it.</p>
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
  const canJoinWomenOnly = !trip.womenOnly || user?.gender === 'Woman';
  const spotsFilled = trip.members.length + 1; // host takes a spot
  const isFull = spotsFilled >= trip.maxGuests;
  const hasStarted = new Date(trip.startDate) <= new Date();
  const hasEnded = new Date(trip.endDate) <= new Date();
  const status = trip.myRequest?.status;
  const hostFirst = trip.host.name.split(' ')[0];

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

  const spotsLeft = trip.maxGuests - spotsFilled;
  const subtitle = [trip.country, ...trip.tags.slice(0, 4), trip.womenOnly ? 'Women only' : null].filter(Boolean).join(' · ');

  return (
    <div className="pb-28 lg:pb-10 max-w-5xl mx-auto">
      {/* Back */}
      <button
        type="button"
        onClick={() => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate('/'))}
        className={cn('mb-5 inline-flex items-center gap-1.5 text-sm font-semibold hover:text-[#222222] transition-colors', TEXT_SOFT)}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* ── Title ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h1 className={cn('text-2xl sm:text-[28px] font-semibold leading-tight break-words', TEXT_STRONG)}>{trip.destination}</h1>
          <p className={cn('text-sm mt-1', TEXT_SOFT)}>{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void share()}
          className={cn('shrink-0 mt-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold underline underline-offset-4 hover:bg-slate-100 transition-colors', TEXT_STRONG)}
        >
          {copied ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
          {copied ? 'Link copied' : 'Share'}
        </button>
      </div>

      {/* ── Cover ───────────────────────────────────────────────────────────── */}
      <div className="h-56 sm:h-[26rem] rounded-2xl overflow-hidden bg-slate-100">
        <CoverImg src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover" />
      </div>

      <div className="grid gap-x-16 lg:grid-cols-[1fr_360px] items-start">
        {/* ── Left: plain sections divided by thin lines ────────────────────── */}
        <div>
          {/* Hosted by */}
          <section className={cn(SECTION, 'flex items-center justify-between gap-4')}>
            <div className="min-w-0">
              <h2 className={cn('text-[22px] font-semibold leading-snug', TEXT_STRONG)}>Hosted by {trip.host.name}</h2>
              <p className={cn('text-sm mt-0.5', TEXT_SOFT)}>
                {trip.host.location ?? 'Host'}
              </p>
            </div>
            <Link to={`/users/${trip.hostId}`} aria-label={`${trip.host.name}'s profile`} className="shrink-0">
              <Avatar src={trip.host.avatar} name={trip.host.name} size={56} />
            </Link>
          </section>

          {/* Key facts */}
          <section className={cn(SECTION, 'space-y-6')}>
            <Fact icon={<Calendar size={24} strokeWidth={1.5} />} title={formatDateRange(trip.startDate, trip.endDate)} sub="Trip dates" />
            <Fact icon={<Wallet size={24} strokeWidth={1.5} />} title={formatBudget(trip.budget)} sub="Budget" />
            <Fact
              icon={<Users size={24} strokeWidth={1.5} />}
              title={`${spotsFilled} of ${trip.maxGuests} spots filled`}
              sub={isFull ? 'This trip is full' : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}
            />
          </section>

          {/* About */}
          <section className={SECTION}>
            <h2 className={cn('text-[22px] font-semibold leading-snug mb-4', TEXT_STRONG)}>About this trip</h2>
            <p className={cn('text-base leading-relaxed whitespace-pre-wrap', TEXT_STRONG)}>
              {trip.description ||
                (isHost
                  ? "You haven't added a description yet. Add one with \"Edit trip in Profile\" so travellers know the plan."
                  : `${hostFirst} hasn't added a description yet. Send them a message to ask about the plan.`)}
            </p>
          </section>

          {/* Who's going */}
          <section className={SECTION}>
            <h2 className={cn('text-[22px] font-semibold leading-snug mb-5', TEXT_STRONG)}>
              Who's going <span className={cn('font-normal', TEXT_SOFT)}>· {spotsFilled}</span>
            </h2>
            <ul className="space-y-4">
              <PersonRow person={trip.host} note="Host" />
              {trip.members.map((m) => (
                <PersonRow key={m.id} person={m} note={m.id === user?.id ? 'You' : undefined} />
              ))}
            </ul>
          </section>

          {/* Meet your host (only when they've filled something in) */}
          {(trip.host.bio || trip.host.socialHandle) && (
            <section className={SECTION}>
              <h2 className={cn('text-[22px] font-semibold leading-snug mb-4', TEXT_STRONG)}>Meet your host</h2>
              {trip.host.bio && <p className={cn('text-base leading-relaxed', TEXT_STRONG)}>{trip.host.bio}</p>}
              {trip.host.socialHandle && (
                <a
                  href={normalizeUrl(trip.host.socialHandle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('inline-flex items-center gap-1.5 mt-4 text-sm font-semibold underline underline-offset-4', TEXT_STRONG)}
                >
                  <Link2 size={14} /> Social profile
                </a>
              )}
            </section>
          )}

          {hasEnded && (isHost || status === 'APPROVED') && <ReviewSection tripId={trip.id} />}
        </div>

        {/* ── Right: the one boxed card (like Airbnb's reserve card) ─────────── */}
        <div className="lg:sticky lg:top-6 mt-8 lg:mt-8">
          <section className="rounded-2xl border border-[#DDDDDD] p-6 bg-white shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
            {isHost ? (
              <>
                <h2 className={cn('text-[22px] font-semibold leading-snug', TEXT_STRONG)}>This is your trip</h2>
                <p className={cn('text-sm mt-1', TEXT_SOFT)}>Manage requests and edit details from your dashboard.</p>
                <div className="flex flex-col gap-2 mt-5">
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
                <Link to={`/chats?tab=groups&chatId=${trip.id}`} className={cn(primaryBtn, 'mt-4 w-full')}>
                  <MessageCircle size={16} /> Open group chat
                </Link>
              </>
            ) : status === 'PENDING' ? (
              <>
                <StatusPill tone="blue">Request sent · waiting for {hostFirst}</StatusPill>
                <Link to={`/chats?tab=inquiries&chatId=${trip.myRequest!.id}`} className={cn(primaryBtn, 'mt-4 w-full')}>
                  <MessageCircle size={16} /> Message {hostFirst}
                </Link>
              </>
            ) : status === 'REJECTED' ? (
              <StatusPill tone="red">Your request was declined</StatusPill>
            ) : hasStarted ? (
              <StatusPill tone="grey">This trip has already started</StatusPill>
            ) : isFull ? (
              <StatusPill tone="grey">This trip is full</StatusPill>
            ) : !canJoinWomenOnly ? (
              <StatusPill tone="grey">This trip is only open to women</StatusPill>
            ) : (
              <>
                <h2 className={cn('text-[22px] font-semibold leading-snug', TEXT_STRONG)}>Want to join?</h2>
                <p className={cn('text-sm mt-1', TEXT_SOFT)}>Say hi to {hostFirst}. A good note helps your chances.</p>
                <textarea
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="e.g. I've done two Himalayan treks and would love to join!"
                  className="mt-4 w-full rounded-lg border border-[#B0B0B0] bg-white p-3 text-sm text-[#222222] placeholder:text-[#6A6A6A] outline-none focus:border-[#222222] focus:ring-1 focus:ring-[#222222] resize-none"
                />
                {joinError && <p className="text-red-500 text-sm mt-2">{joinError}</p>}
                <button type="button" onClick={() => void join()} disabled={joining} className={cn(primaryBtn, 'mt-4 w-full')}>
                  {joining ? 'Sending…' : 'Request to join'}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Small pieces ───────────────────────────────────────────────────────────── */
const SECTION = 'py-8 border-b border-[#DDDDDD]';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors';
const secondaryBtn =
  'inline-flex items-center justify-center rounded-full border border-[#222222] hover:bg-slate-50 px-5 py-2.5 text-sm font-semibold text-[#222222] transition-colors';

function Fact({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className={cn('shrink-0 mt-0.5', TEXT_STRONG)}>{icon}</span>
      <div className="min-w-0">
        <p className={cn('text-base font-semibold leading-snug', TEXT_STRONG)}>{title}</p>
        <p className={cn('text-sm', TEXT_SOFT)}>{sub}</p>
      </div>
    </div>
  );
}

function PersonRow({ person, note }: { person: Person; note?: string }) {
  return (
    <li className="flex items-center gap-4">
      <Avatar src={person.avatar} name={person.name} size={48} />
      <span className={cn('text-base font-semibold truncate', TEXT_STRONG)}>{person.name}</span>
      {note && <span className={cn('ml-auto shrink-0 text-sm', TEXT_SOFT)}>{note}</span>}
    </li>
  );
}

function StatusPill({ tone, children }: { tone: 'green' | 'blue' | 'red' | 'grey'; children: React.ReactNode }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-600',
    grey: 'bg-slate-100 text-[#6A6A6A]',
  };
  return <p className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', tones[tone])}>{children}</p>;
}

/* ── Rate your trip: shown once the trip has ended, to the host and approved travellers ── */
interface ReviewPerson {
  id: string;
  name: string;
  avatar: string | null;
}
interface GivenReview {
  id: string;
  revieweeId: string;
  rating: number;
  text: string | null;
  reviewee: ReviewPerson;
}
interface ReviewState {
  eligible: boolean;
  pending: ReviewPerson[];
  given: GivenReview[];
}

function ReviewSection({ tripId }: { tripId: string }) {
  const [state, setState] = useState<ReviewState | null>(null);
  const [rating, setRating] = useState<Record<string, number>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editText, setEditText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const startEdit = (review: GivenReview) => {
    setEditingId(review.id);
    setEditRating(review.rating);
    setEditText(review.text ?? '');
    setError(null);
  };

  const saveEdit = async (reviewId: string) => {
    if (editRating < 1) {
      setError('Pick a star rating first.');
      return;
    }
    setSubmitting(reviewId);
    setError(null);
    try {
      await api.patch(`/trips/${tripId}/reviews/${reviewId}`, { rating: editRating, text: editText.trim() });
      setEditingId(null);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save your changes. Please try again.'));
    } finally {
      setSubmitting(null);
    }
  };

  const removeReview = async (reviewId: string) => {
    setDeletingId(reviewId);
    setError(null);
    try {
      await api.delete(`/trips/${tripId}/reviews/${reviewId}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete your review. Please try again.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className={SECTION}>
      <h2 className={cn('text-[22px] font-semibold leading-snug mb-1', TEXT_STRONG)}>Rate your trip</h2>
      <p className={cn('text-sm mb-5', TEXT_SOFT)}>Help other travellers know who to trust.</p>

      {state.pending.length === 0 && state.given.length === 0 && (
        <p className="text-[#6A6A6A] text-sm">Nothing to review. You were on this trip alone.</p>
      )}

      {state.pending.map((person) => (
        <div key={person.id} className="flex items-start gap-3 py-3 border-t border-[#EBEBEB] first:border-0 first:pt-0">
          <Avatar src={person.avatar} name={person.name} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-[#222222] font-semibold text-[15px] truncate">{person.name}</p>
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
              className="mt-2 w-full rounded-xl border border-[#DDDDDD] bg-slate-50 p-2.5 text-sm text-[#222222] placeholder:text-[#6A6A6A] outline-none focus:border-blue-600 resize-none"
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

      {state.given.map((review) => (
        <div key={review.id} className="flex items-start gap-3 py-3 border-t border-[#EBEBEB]">
          <Avatar src={review.reviewee.avatar} name={review.reviewee.name} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-[#222222] font-semibold text-[15px] truncate">{review.reviewee.name}</p>
            {editingId === review.id ? (
              <>
                <StarPicker value={editRating} onChange={setEditRating} />
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Optional note about travelling with them…"
                  className="mt-2 w-full rounded-xl border border-[#DDDDDD] bg-slate-50 p-2.5 text-sm text-[#222222] placeholder:text-[#6A6A6A] outline-none focus:border-blue-600 resize-none"
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => void saveEdit(review.id)}
                    disabled={submitting === review.id}
                    className="rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-1.5 transition-colors"
                  >
                    {submitting === review.id ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-[#6A6A6A] hover:text-[#222222] text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <StarPicker value={review.rating} onChange={() => {}} />
                {review.text && <p className="text-[#6A6A6A] text-sm mt-1">{review.text}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => startEdit(review)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeReview(review.id)}
                    disabled={deletingId === review.id}
                    className="text-red-500 hover:text-red-600 disabled:opacity-60 text-sm font-semibold"
                  >
                    {deletingId === review.id ? 'Removing…' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ))}

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
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-56 sm:h-[26rem] rounded-2xl" />
      <Skeleton className="h-6 w-52 mt-8" />
      <Skeleton className="h-20" />
    </div>
  );
}
