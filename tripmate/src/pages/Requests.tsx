import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Inbox, MapPin, MessageCircle } from 'lucide-react';
import api, { apiErrorMessage } from '../services/api';
import { Avatar, Skeleton, EmptyState, ErrorState, cn } from '../components/ui-bits';

/* ── Types (match backend payloads) ─────────────────────────────────────────── */
interface ReceivedRequest {
  id: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null };
  trip: { id: string; destination: string; country: string; startDate: string };
}

interface SentRequest {
  id: string;
  status: string;
  createdAt: string;
  trip: {
    id: string;
    destination: string;
    country: string;
    startDate: string;
    coverImage: string | null;
    host: { id: string; name: string; avatar: string | null };
  };
}

type Tab = 'received' | 'sent';
type ViewState = 'loading' | 'error' | 'ready';

const statusStyle: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-600',
  APPROVED: 'bg-emerald-50 text-emerald-600',
  REJECTED: 'bg-red-50 text-red-500',
};
const statusLabel: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Declined',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   REQUESTS  (V2 design, real data, Accept/Decline wired to PATCH /requests/:id)
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function Requests() {
  // Tab is synced to the URL (?tab=received | ?tab=sent).
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab: Tab = searchParams.get('tab') === 'sent' ? 'sent' : 'received';
  const setTab = (t: Tab) => setSearchParams({ tab: t });

  const [view, setView] = useState<ViewState>('loading');
  const [received, setReceived] = useState<ReceivedRequest[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [acting, setActing] = useState<Record<string, boolean>>({});

  const fetchAll = async () => {
    setView('loading');
    try {
      const [receivedRes, sentRes] = await Promise.all([
        api.get<ReceivedRequest[]>('/requests/received'),
        api.get<SentRequest[]>('/requests/sent'),
      ]);
      setReceived(receivedRes.data);
      setSent(sentRes.data);
      setView('ready');
    } catch (error) {
      console.error('[Requests] fetch failed', error);
      setView('error');
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  // Accept → APPROVED, Decline → REJECTED. On success the row leaves the
  // pending list (and the trip's approved-spot count updates server-side).
  const handleAction = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setActing((a) => ({ ...a, [id]: true }));
    try {
      await api.patch(`/requests/${id}`, { status });
      setReceived((rows) => rows.filter((r) => r.id !== id));
    } catch (error) {
      console.error('[Requests] action failed', error);
      window.alert(apiErrorMessage(error, 'Something went wrong. Please try again.'));
      setActing((a) => ({ ...a, [id]: false }));
    }
  };

  // Requester withdraws a pending request, or leaves a trip they were approved for.
  const handleCancel = async (r: SentRequest) => {
    const question =
      r.status === 'APPROVED' ? `Leave the ${r.trip.destination} trip?` : `Cancel your request for ${r.trip.destination}?`;
    if (!window.confirm(question)) return;
    setActing((a) => ({ ...a, [r.id]: true }));
    try {
      await api.delete(`/requests/${r.id}`);
      setSent((rows) => rows.filter((x) => x.id !== r.id));
    } catch (error) {
      console.error('[Requests] cancel failed', error);
      window.alert(apiErrorMessage(error, 'Something went wrong. Please try again.'));
      setActing((a) => ({ ...a, [r.id]: false }));
    }
  };

  return (
    <div className="pb-28 lg:pb-10">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">Requests</h1>
      <p className="text-slate-500 mb-6 text-[15px]">
        Manage who's joining your trips and where you've asked to tag along.
      </p>

      {/* Toggle */}
      <div className="inline-flex bg-slate-100 rounded-full p-1 mb-6">
        {(['received', 'sent'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-full px-6 py-2 capitalize text-sm font-semibold transition-colors',
              tab === t ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {view === 'loading' && <RequestSkeleton />}
      {view === 'error' && <ErrorState onRetry={fetchAll} />}

      {view === 'ready' && tab === 'received' && (
        received.length === 0 ? (
          <EmptyState
            icon={<Inbox size={34} />}
            title="No requests yet"
            subtitle="When travelers ask to join your trips, they'll show up here."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {received.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-slate-200 rounded-3xl p-4 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-3 shadow-[0_4px_24px_rgba(15,23,42,0.04)]"
              >
                <Link to={`/users/${r.user.id}`} className="shrink-0">
                  <Avatar src={r.user.avatar} name={r.user.name} size={52} />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/users/${r.user.id}`} className="text-slate-900 text-[15px] font-bold truncate hover:text-blue-600 transition-colors block">
                    {r.user.name}
                  </Link>
                  <p className="text-slate-500 flex items-center gap-1 truncate text-[13px]">
                    <MapPin size={13} className="text-slate-400 shrink-0" />
                    wants to join {r.trip.destination}
                  </p>
                </div>
                {/* Phones: buttons drop to their own full-width row so the card never overflows. */}
                <div className="flex gap-2 w-full sm:w-auto sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/chats?tab=inquiries&chatId=${r.id}`)}
                    aria-label={`Message ${r.user.name}`}
                    title="Message"
                    className="w-9 h-9 shrink-0 flex items-center justify-center border border-slate-200 text-slate-500 rounded-full hover:border-blue-600 hover:text-blue-600 transition-colors"
                  >
                    <MessageCircle size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={acting[r.id]}
                    onClick={() => handleAction(r.id, 'REJECTED')}
                    className="flex-1 sm:flex-none border border-slate-200 text-slate-500 rounded-full px-4 py-2 text-[13px] font-semibold hover:border-red-500 hover:text-red-500 disabled:opacity-50 transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={acting[r.id]}
                    onClick={() => handleAction(r.id, 'APPROVED')}
                    className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-2 text-[13px] font-semibold disabled:opacity-50 transition-colors"
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {view === 'ready' && tab === 'sent' && (
        sent.length === 0 ? (
          <EmptyState
            icon={<Inbox size={34} />}
            title="No requests sent"
            subtitle="Browse trips on Home and tap Join to request a spot."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {sent.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-slate-200 rounded-3xl p-4 min-w-0 shadow-[0_4px_24px_rgba(15,23,42,0.04)]"
              >
                <div className="flex gap-3.5">
                  <span className="w-[72px] h-[72px] rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                    <img
                      src={r.trip.coverImage || `https://loremflickr.com/200/200/${encodeURIComponent(r.trip.destination)}/travel`}
                      alt={r.trip.destination}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-slate-900 text-[15px] leading-snug font-bold line-clamp-2 break-words">{r.trip.destination}</p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          statusStyle[r.status] ?? 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {statusLabel[r.status] ?? r.status}
                      </span>
                    </div>
                    <p className="text-slate-500 truncate text-[13px] mt-1">
                      {fmtDate(r.trip.startDate)} · Hosted by {r.trip.host.name.split(' ')[0]}
                    </p>
                  </div>
                </div>
                {r.status !== 'REJECTED' && (
                  <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/chats?tab=inquiries&chatId=${r.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 py-2 text-[13px] font-semibold transition-colors"
                    >
                      <MessageCircle size={14} /> Message host
                    </button>
                    <button
                      type="button"
                      disabled={acting[r.id]}
                      onClick={() => handleCancel(r)}
                      className="flex-1 rounded-full border border-slate-200 text-slate-500 hover:border-red-500 hover:text-red-500 disabled:opacity-50 py-2 text-[13px] font-semibold transition-colors"
                    >
                      {r.status === 'APPROVED' ? 'Leave trip' : 'Cancel request'}
                    </button>
                  </div>
                )}
                {r.status === 'REJECTED' && (
                  <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
                    <p className="text-slate-400 text-[13px]">The host couldn't fit you in this time.</p>
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="shrink-0 rounded-full border border-slate-200 text-slate-600 hover:border-blue-600 hover:text-blue-600 px-4 py-2 text-[13px] font-semibold transition-colors"
                    >
                      Explore trips
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function RequestSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-3xl p-4 flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      ))}
    </div>
  );
}
