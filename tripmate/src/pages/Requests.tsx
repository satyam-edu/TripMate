import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Inbox, MessageCircle } from 'lucide-react';
import api, { apiErrorMessage, cachedGet } from '../services/api';
import { Avatar, CoverImg, Skeleton, EmptyState, ErrorState, UnderlineTabs, BTN_OUTLINE, PAGE_TITLE, cn } from '../components/ui-bits';

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

  const [cachedReceived] = useState(() => cachedGet<ReceivedRequest[]>('/requests/received'));
  const [cachedSent] = useState(() => cachedGet<SentRequest[]>('/requests/sent'));
  const [view, setView] = useState<ViewState>(cachedReceived && cachedSent ? 'ready' : 'loading');
  const [received, setReceived] = useState<ReceivedRequest[]>(cachedReceived ?? []);
  const [sent, setSent] = useState<SentRequest[]>(cachedSent ?? []);
  const [acting, setActing] = useState<Record<string, boolean>>({});

  const fetchAll = async () => {
    setView((v) => (v === 'ready' ? v : 'loading')); // cached data stays up while refreshing
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
      setView((v) => (v === 'ready' ? v : 'error'));
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
    <div className="pb-28 lg:pb-10 max-w-3xl">
      <h1 className={PAGE_TITLE}>Requests</h1>
      <p className="text-[#6A6A6A] mt-1 mb-8 text-base">
        Manage who's joining your trips and where you've asked to tag along.
      </p>

      <UnderlineTabs
        tabs={[
          { value: 'received', label: 'Received', badge: received.length || undefined },
          { value: 'sent', label: 'Sent' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-2"
      />

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
          <ul className="divide-y divide-[#DDDDDD]">
            {received.map((r) => (
              <li key={r.id} className="py-6 flex flex-wrap items-center gap-x-4 gap-y-3">
                <Link to={`/users/${r.user.id}`} className="shrink-0">
                  <Avatar src={r.user.avatar} name={r.user.name} size={56} />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/users/${r.user.id}`} className="text-[#222222] text-base font-semibold truncate block">
                    {r.user.name}
                  </Link>
                  <p className="text-[#6A6A6A] truncate text-sm">wants to join {r.trip.destination}</p>
                </div>
                {/* Phones: buttons drop to their own full-width row so the row never overflows. */}
                <div className="flex gap-2 w-full sm:w-auto sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/chats?tab=inquiries&chatId=${r.id}`)}
                    aria-label={`Message ${r.user.name}`}
                    title="Message"
                    className="w-10 h-10 shrink-0 flex items-center justify-center border border-[#222222] text-[#222222] rounded-full hover:bg-slate-50 transition-colors"
                  >
                    <MessageCircle size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={acting[r.id]}
                    onClick={() => handleAction(r.id, 'REJECTED')}
                    className={cn(BTN_OUTLINE, 'flex-1 sm:flex-none')}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={acting[r.id]}
                    onClick={() => handleAction(r.id, 'APPROVED')}
                    className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    Accept
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
          <ul className="divide-y divide-[#DDDDDD]">
            {sent.map((r) => (
              <li key={r.id} className="py-6">
                <div className="flex gap-4">
                  <span className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    <CoverImg
                      src={r.trip.coverImage}
                      size={330}
                      alt={r.trip.destination}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[#222222] text-base leading-snug font-semibold line-clamp-2 break-words">{r.trip.destination}</p>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                          statusStyle[r.status] ?? 'bg-slate-100 text-[#6A6A6A]',
                        )}
                      >
                        {statusLabel[r.status] ?? r.status}
                      </span>
                    </div>
                    <p className="text-[#6A6A6A] truncate text-sm mt-1">
                      {fmtDate(r.trip.startDate)} · Hosted by {r.trip.host.name.split(' ')[0]}
                    </p>
                    {r.status !== 'REJECTED' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => navigate(`/chats?tab=inquiries&chatId=${r.id}`)} className={BTN_OUTLINE}>
                          <MessageCircle size={14} /> Message host
                        </button>
                        <button type="button" disabled={acting[r.id]} onClick={() => handleCancel(r)} className={BTN_OUTLINE}>
                          {r.status === 'APPROVED' ? 'Leave trip' : 'Cancel request'}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <p className="text-[#6A6A6A] text-sm">The host couldn't fit you in this time.</p>
                        <button type="button" onClick={() => navigate('/')} className={BTN_OUTLINE}>
                          Explore trips
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function RequestSkeleton() {
  return (
    <div className="divide-y divide-[#DDDDDD]">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="py-6 flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      ))}
    </div>
  );
}
