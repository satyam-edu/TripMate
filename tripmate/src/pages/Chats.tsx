import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, ChevronLeft, MessageCircle, Reply, X, BellRing, BellOff } from 'lucide-react';
import api, { apiErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useChatAlerts, type ChatPush } from '../context/ChatAlertsContext';
import { getSocket } from '../services/socket';
import { alertsEnabled, setAlertsEnabled } from '../services/alerts';
import { Avatar, Skeleton, ErrorState, cn, formatDateRange } from '../components/ui-bits';

/* ── Types (match backend payloads) ─────────────────────────────────────────── */
type ChatTab = 'groups' | 'inquiries';
type ViewState = 'loading' | 'error' | 'ready';

interface ChatMessage {
  id: string;
  text: string;
  createdAt: string;
  sender: { id: string; name: string; avatar: string | null };
  replyTo?: { id: string; text: string; sender: { id: string; name: string } } | null;
  pending?: boolean; // shown instantly on send, before the server confirms it
}

interface GroupChat {
  kind: 'groups';
  id: string; // tripId
  title: string;
  image: string | null;
  startDate: string;
  endDate: string;
  spotsFilled: number;
  maxGuests: number;
  lastMessage: ChatMessage | null;
  unread: number;
}

interface InquiryChat {
  kind: 'inquiries';
  id: string; // requestId
  title: string; // the other person's name
  image: string | null;
  status: 'PENDING' | 'APPROVED';
  destination: string;
  lastMessage: ChatMessage | null;
  unread: number;
}

type Conversation = GroupChat | InquiryChat;

const TABS: { id: ChatTab; label: string }[] = [
  { id: 'groups', label: 'Groups' },
  { id: 'inquiries', label: 'Inquiries' },
];

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function subtitle(c: Conversation): string {
  return c.kind === 'groups'
    ? `${c.spotsFilled}/${c.maxGuests} travelers · ${formatDateRange(c.startDate, c.endDate)}`
    : `${c.status === 'APPROVED' ? 'Approved' : 'Pending'} request · ${c.destination}`;
}

// Today → "2:14 PM", otherwise → "12 Jul".
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Put the conversation's new last message in place (optionally +1 unread) and move it to the top.
function bumpConversation<T extends Conversation>(list: T[], id: string, message: ChatMessage, addUnread = false): T[] {
  const conv = list.find((c) => c.id === id);
  if (!conv) return list;
  return [{ ...conv, lastMessage: message, unread: conv.unread + (addUnread ? 1 : 0) }, ...list.filter((c) => c.id !== id)];
}


/* ═══════════════════════════════════════════════════════════════════════════════
   CHATS  (dual-tab · fixed app-like scroll layout · mobile full-screen takeover)
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function Chats() {
  const { user, token } = useAuth();
  const { refreshUnread } = useChatAlerts();

  // Tab + active chat are synced to the URL (?tab=groups|inquiries & chatId=…).
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab: ChatTab = searchParams.get('tab') === 'inquiries' ? 'inquiries' : 'groups';
  const activeId = searchParams.get('chatId');

  const [view, setView] = useState<ViewState>('loading');
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [inquiries, setInquiries] = useState<InquiryChat[]>([]);

  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const list: Conversation[] = tab === 'groups' ? groups : inquiries;
  const active = list.find((c) => c.id === activeId) ?? null;
  const chatKey = active ? `${active.kind}:${active.id}` : null;

  // Messages are stored with the chat they belong to, so switching chats never
  // shows the previous chat's messages; "loading" = we don't have this chat yet.
  const [thread, setThread] = useState<{ key: string | null; messages: ChatMessage[] }>({ key: null, messages: [] });
  const messages = thread.key === chatKey ? thread.messages : [];
  const messagesLoading = chatKey !== null && thread.key !== chatKey;
  const appendMessage = (key: string, message: ChatMessage) =>
    setThread((t) => {
      if (t.key !== key || t.messages.some((m) => m.id === message.id)) return t;
      // My own message coming back from the server: swap it in for its "Sending…" copy.
      const i = message.pending
        ? -1
        : t.messages.findIndex((m) => m.pending && m.sender.id === message.sender.id && m.text === message.text);
      if (i >= 0) return { ...t, messages: t.messages.map((m, j) => (j === i ? message : m)) };
      return { ...t, messages: [...t.messages, message] };
    });
  // Server confirmed (or rejected, when `saved` is null) a message shown with a temporary id.
  const settleMessage = (key: string, tempId: string, saved: ChatMessage | null) =>
    setThread((t) => {
      if (t.key !== key) return t;
      const alreadyIn = saved !== null && t.messages.some((m) => m.id === saved.id);
      return {
        ...t,
        messages:
          saved && !alreadyIn
            ? t.messages.map((m) => (m.id === tempId ? saved : m))
            : t.messages.filter((m) => m.id !== tempId),
      };
    });

  // The socket listener is set up once, so it reads the latest lists through a ref.
  const listsRef = useRef({ groups, inquiries });
  const openKeyRef = useRef<string | null>(null); // the chat on screen, "groups:<id>"
  useEffect(() => {
    listsRef.current = { groups, inquiries };
    openKeyRef.current = chatKey;
  });

  // Marks a chat read on the server and clears its badge. Debounced per chat so a
  // busy chat doesn't send one request per incoming message.
  const readTimers = useRef(new Map<string, number>());
  const markRead = useCallback(
    (key: string) => {
      window.clearTimeout(readTimers.current.get(key));
      readTimers.current.set(
        key,
        window.setTimeout(() => {
          readTimers.current.delete(key);
          const [kind, id] = key.split(':') as [ChatTab, string];
          const clear = <T extends Conversation>(prev: T[]) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c));
          if (kind === 'groups') setGroups(clear);
          else setInquiries(clear);
          api
            .post(`/chats/${kind}/${id}/read`)
            .then(refreshUnread)
            .catch((error) => console.error('[Chats] mark read failed', error));
        }, 400),
      );
    },
    [refreshUnread],
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchChats = async () => {
    try {
      const { data } = await api.get<{ groups: GroupChat[]; inquiries: InquiryChat[] }>('/chats');
      setGroups(data.groups);
      setInquiries(data.inquiries);
      setView('ready');
    } catch (error) {
      console.error('[Chats] fetch failed', error);
      setView('error');
    }
  };

  useEffect(() => {
    void fetchChats();
  }, []);

  // Live updates: the server pushes every new message in any of my chats.
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const onMessage = ({ kind, conversationId, message }: ChatPush) => {
      const key = `${kind}:${conversationId}`;
      appendMessage(key, message);
      const known = listsRef.current[kind].some((c) => c.id === conversationId);
      if (!known) {
        void fetchChats(); // a chat we haven't listed yet (e.g. a new inquiry)
        return;
      }
      const onScreen = openKeyRef.current === key && !document.hidden;
      const fromOther = message.sender.id !== user?.id;
      if (kind === 'groups') setGroups((prev) => bumpConversation(prev, conversationId, message, fromOther && !onScreen));
      else setInquiries((prev) => bumpConversation(prev, conversationId, message, fromOther && !onScreen));
      if (onScreen && fromOther) markRead(key);
    };
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [token, user?.id, markRead]);

  // Opening a chat (or coming back to the tab while it's open) marks it read.
  useEffect(() => {
    if (!chatKey) return;
    const markIfVisible = () => {
      if (!document.hidden) markRead(chatKey);
    };
    markIfVisible();
    document.addEventListener('visibilitychange', markIfVisible);
    return () => document.removeEventListener('visibilitychange', markIfVisible);
  }, [chatKey, markRead]);

  // Load the open chat's history.
  useEffect(() => {
    if (!chatKey) return;
    let cancelled = false;
    api
      .get<ChatMessage[]>(`/chats/${chatKey.replace(':', '/')}/messages`)
      .then(({ data }) => !cancelled && setThread({ key: chatKey, messages: data }))
      .catch((error) => {
        console.error('[Chats] messages failed', error);
        if (!cancelled) setThread({ key: chatKey, messages: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [chatKey])

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [thread]);

  // Lock background scroll while a chat is open (mobile overlay + desktop pane).
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  const switchTab = (t: ChatTab) => {
    setSendError(null);
    setReplyingTo(null);
    setSearchParams({ tab: t }); // also drops chatId → back to list
  };
  const openChat = (id: string) => {
    setSendError(null);
    setReplyingTo(null);
    setSearchParams({ tab, chatId: id }); // push
  };

  // Closing mirrors the hardware back button so we don't leave a re-openable entry.
  const closeChat = () => {
    setReplyingTo(null);
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else setSearchParams({ tab }, { replace: true });
  };

  // Sends go out one after another so quick messages keep their order on the server.
  const sendQueue = useRef<Promise<void>>(Promise.resolve());

  // The message appears immediately ("Sending…"), then gets swapped for the saved one.
  const send = () => {
    const text = draft.trim();
    if (!text || !active || !user) return;
    const { kind, id } = active;
    const key = `${kind}:${id}`;
    const reply = replyingTo;
    const temp: ChatMessage = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, name: user.name, avatar: user.avatar },
      replyTo: reply ? { id: reply.id, text: reply.text, sender: { id: reply.sender.id, name: reply.sender.name } } : null,
      pending: true,
    };

    appendMessage(key, temp);
    if (kind === 'groups') setGroups((prev) => bumpConversation(prev, id, temp));
    else setInquiries((prev) => bumpConversation(prev, id, temp));
    setDraft('');
    setReplyingTo(null);
    setSendError(null);

    sendQueue.current = sendQueue.current.then(async () => {
      try {
        const { data } = await api.post<ChatMessage>(`/chats/${kind}/${id}/messages`, { text, replyToId: reply?.id });
        settleMessage(key, temp.id, data);
      } catch (error) {
        settleMessage(key, temp.id, null);
        setDraft((d) => d || text); // give the text back so it can be re-sent
        setSendError(apiErrorMessage(error, 'Message not sent. Please try again.'));
      }
    });
  };

  const startReply = (m: ChatMessage) => {
    setReplyingTo(m);
    inputRef.current?.focus();
  };

  // Tapping a quoted message scrolls to the original and flashes it.
  const jumpTo = (id: string) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1500);
  };

  const nameFor = (sender: { id: string; name: string }) =>
    sender.id === user?.id ? 'You' : sender.name.split(' ')[0];

  return (
    <div className="flex flex-col lg:h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between gap-3 mb-1 lg:mb-4 shrink-0">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Chats</h1>
        <AlertsToggle />
      </div>

      {view === 'error' && <ErrorState onRetry={fetchChats} />}

      {view !== 'error' && (
        <div className="lg:grid lg:grid-cols-[340px_1fr] lg:grid-rows-1 lg:gap-6 lg:flex-1 lg:min-h-0">
          {/* ── Sidebar (tabs + list) ──────────────────────────────────────────── */}
          <div className={cn('lg:flex lg:flex-col lg:min-h-0', active && 'hidden lg:flex')}>
            {/* Dual-tab pill switch */}
            <div className="flex bg-slate-100 rounded-full p-1 mb-3 shrink-0">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => switchTab(t.id)}
                  className={cn(
                    'flex-1 rounded-full py-2 text-sm font-semibold transition-colors',
                    tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500',
                  )}
                >
                  {t.label}
                  {(() => {
                    const n = (t.id === 'groups' ? groups : inquiries).reduce((sum, c) => sum + c.unread, 0);
                    return n > 0 ? (
                      <span
                        className={cn(
                          'ml-1.5 inline-flex min-w-[18px] h-[18px] px-1 rounded-full items-center justify-center text-[10px] font-bold',
                          tab === t.id ? 'bg-white text-blue-600' : 'bg-blue-600 text-white',
                        )}
                      >
                        {n > 99 ? '99+' : n}
                      </span>
                    ) : null;
                  })()}
                </button>
              ))}
            </div>

            {/* Conversation list (scrolls within the pane on desktop) */}
            <div className="space-y-2 lg:flex-1 lg:overflow-y-auto lg:min-h-0 lg:pr-1">
              {view === 'loading' ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[82px]" />)
              ) : list.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-6 text-slate-400">
                  <MessageCircle size={28} className="mb-2" />
                  <p className="text-sm">
                    {tab === 'groups'
                      ? 'No trip groups yet. When you host a trip or get approved for one, its group chat shows up here.'
                      : 'No inquiries yet. Chats with hosts (or travellers asking to join your trips) show up here.'}
                  </p>
                </div>
              ) : (
                list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openChat(c.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-2xl border transition-colors text-left',
                      activeId === c.id ? 'bg-blue-50 border-blue-600/30' : 'bg-white border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <ConvThumb conv={c} size={56} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-900 truncate text-[15px] font-bold">{c.title}</span>
                        {c.lastMessage && (
                          <span className={cn('shrink-0 text-xs', c.unread > 0 ? 'text-blue-600 font-semibold' : 'text-slate-400')}>
                            {fmtTime(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'block truncate text-[13px]',
                            c.unread > 0 ? 'text-slate-900 font-semibold' : 'text-slate-500',
                          )}
                        >
                          {c.lastMessage
                            ? `${c.lastMessage.sender.id === user?.id ? 'You' : c.lastMessage.sender.name.split(' ')[0]}: ${c.lastMessage.text}`
                            : 'No messages yet. Say hi 👋'}
                        </span>
                        {c.unread > 0 && (
                          <span className="bg-blue-600 text-white rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center shrink-0 text-[11px] font-bold">
                            {c.unread > 99 ? '99+' : c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Chat window ────────────────────────────────────────────────────────
              Mobile + open → full-screen overlay (fixed inset-0 z-50, covers bottom nav)
              Desktop       → static pane inside the grid
              ──────────────────────────────────────────────────────────────────── */}
          <div
            className={cn(
              'flex-col bg-white lg:h-full lg:min-h-0 lg:rounded-3xl lg:border lg:border-slate-200 lg:overflow-hidden',
              active ? 'flex fixed inset-0 z-50 lg:static lg:z-auto' : 'hidden lg:flex',
            )}
          >
            {active ? (
              <>
                {/* Header: locked at the top */}
                <div className="flex items-center gap-3 p-4 border-b border-slate-200 shrink-0">
                  <button type="button" onClick={closeChat} className="lg:hidden text-slate-500" aria-label="Back">
                    <ChevronLeft size={22} />
                  </button>
                  <ConvThumb conv={active} size={40} header />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 text-[15px] font-bold truncate">{active.title}</p>
                    <p className="text-slate-400 text-xs truncate">{subtitle(active)}</p>
                  </div>
                </div>

                {/* Message list: the ONLY scrollable region */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 bg-slate-50">
                  {messagesLoading && <p className="text-center text-slate-400 text-sm">Loading messages…</p>}
                  {!messagesLoading && messages.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-10">No messages yet. Start the conversation!</p>
                  )}
                  {messages.map((m) => (
                    <MessageRow
                      key={m.id}
                      message={m}
                      fromMe={m.sender.id === user?.id}
                      showName={active.kind === 'groups'}
                      highlighted={highlightId === m.id}
                      nameFor={nameFor}
                      // The join pitch and not-yet-saved messages can't be replied to.
                      onReply={m.id.startsWith('pitch-') || m.pending ? undefined : () => startReply(m)}
                      onJumpTo={jumpTo}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Input: locked at the bottom */}
                <div className="border-t border-slate-200 shrink-0">
                  {sendError && <p className="text-red-500 text-xs px-4 pt-2">{sendError}</p>}
                  {replyingTo && (
                    <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-slate-100 border-l-4 border-blue-600 px-3 py-2">
                      <Reply size={16} className="text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-blue-600">
                          Replying to {replyingTo.sender.id === user?.id ? 'yourself' : replyingTo.sender.name.split(' ')[0]}
                        </p>
                        <p className="text-[13px] text-slate-500 truncate">{replyingTo.text}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        aria-label="Cancel reply"
                        className="text-slate-400 hover:text-slate-600 shrink-0"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                  <div className="p-3 flex items-center gap-2">
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') send();
                        if (e.key === 'Escape') setReplyingTo(null);
                      }}
                      maxLength={1000}
                      placeholder={tab === 'groups' ? 'Message the group…' : 'Write a reply…'}
                      className="flex-1 bg-slate-100 rounded-full px-5 py-3 outline-none text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={send}
                      disabled={!draft.trim()}
                      aria-label="Send"
                      className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors shrink-0"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 hidden lg:flex items-center justify-center text-slate-400 text-[15px]">
                Select a conversation to start chatting
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Alerts on/off toggle: blue = on, grey = off ─────────────────────────────── */
function AlertsToggle() {
  const [on, setOn] = useState(alertsEnabled);

  const toggle = () => {
    const next = !on;
    setAlertsEnabled(next);
    setOn(next);
    // Turning alerts on is the moment to ask for desktop notifications (only asked once by the browser).
    if (next && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? 'New-message alerts are on. Click to mute them' : 'New-message alerts are off. Click to turn them on'}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors',
        on
          ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
          : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600',
      )}
    >
      {on ? <BellRing size={15} /> : <BellOff size={15} />} {on ? 'Alerts on' : 'Alerts off'}
    </button>
  );
}

/* ── One message bubble: hover → reply button, swipe right → reply ─────────── */
const SWIPE_TRIGGER = 56; // px of rightward swipe that starts a reply
const SWIPE_MAX = 80;

function MessageRow({
  message: m,
  fromMe,
  showName,
  highlighted,
  nameFor,
  onReply,
  onJumpTo,
}: {
  message: ChatMessage;
  fromMe: boolean;
  showName: boolean;
  highlighted: boolean;
  nameFor: (sender: { id: string; name: string }) => string;
  onReply?: () => void;
  onJumpTo: (id: string) => void;
}) {
  // Swipe state: where the touch started, whether it turned into a vertical scroll, current offset.
  const touch = useRef<{ x: number; y: number; scrolling: boolean } | null>(null);
  const [dx, setDx] = useState(0);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!onReply) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, scrolling: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = touch.current;
    if (!t || t.scrolling) return;
    const moveX = e.touches[0].clientX - t.x;
    const moveY = e.touches[0].clientY - t.y;
    // Mostly vertical → the user is scrolling the list, not swiping.
    if (Math.abs(moveY) > Math.abs(moveX) && Math.abs(moveY) > 8) {
      t.scrolling = true;
      setDx(0);
      return;
    }
    setDx(Math.max(0, Math.min(SWIPE_MAX, moveX)));
  };
  const onTouchEnd = () => {
    if (dx >= SWIPE_TRIGGER) onReply?.();
    touch.current = null;
    setDx(0);
  };

  const replyButton = onReply && (
    <button
      type="button"
      onClick={onReply}
      aria-label="Reply"
      title="Reply"
      className="self-center shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
    >
      <Reply size={16} />
    </button>
  );

  return (
    <div
      id={`msg-${m.id}`}
      className="relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Reply icon revealed behind the message while swiping */}
      {dx > 0 && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-blue-600"
          style={{ opacity: Math.min(1, dx / SWIPE_TRIGGER) }}
        >
          <Reply size={16} />
        </span>
      )}

      <div
        className={cn('group flex gap-2 items-end', fromMe ? 'justify-end' : 'justify-start', dx === 0 && 'transition-transform')}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
      >
        {fromMe && replyButton}
        {!fromMe && <Avatar src={m.sender.avatar} name={m.sender.name} size={28} />}
        <div className="max-w-[75%] min-w-0">
          {!fromMe && showName && (
            <p className="text-slate-400 mb-1 ml-1 text-[11px] font-semibold">{m.sender.name.split(' ')[0]}</p>
          )}
          <div
            className={cn(
              'rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words transition-[box-shadow,opacity]',
              m.pending && 'opacity-70',
              fromMe
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-white text-slate-900 border border-slate-200 rounded-bl-md',
              highlighted && 'ring-2 ring-amber-400',
            )}
          >
            {m.replyTo && (
              <button
                type="button"
                onClick={() => onJumpTo(m.replyTo!.id)}
                className={cn(
                  'block w-full text-left rounded-lg border-l-4 px-2.5 py-1.5 mb-1.5 text-[12px]',
                  fromMe ? 'bg-white/15 border-white/70' : 'bg-slate-100 border-blue-600',
                )}
              >
                <span className={cn('block font-semibold', fromMe ? 'text-white' : 'text-blue-600')}>
                  {nameFor(m.replyTo.sender)}
                </span>
                <span className={cn('line-clamp-2', fromMe ? 'text-white/80' : 'text-slate-500')}>{m.replyTo.text}</span>
              </button>
            )}
            {m.text}
          </div>
          <p className={cn('text-slate-400 mt-1 text-[11px]', fromMe ? 'text-right mr-1' : 'ml-1')}>
            {m.pending ? 'Sending…' : fmtTime(m.createdAt)}
          </p>
        </div>
        {!fromMe && replyButton}
      </div>
    </div>
  );
}

/* ── Thumbnail: square cover for groups, circular avatar for inquiries ──────── */
function ConvThumb({ conv, size, header }: { conv: Conversation; size: number; header?: boolean }) {
  if (conv.kind === 'inquiries') {
    return <Avatar src={conv.image} name={conv.title} size={size} />;
  }
  const cover =
    conv.image || `https://loremflickr.com/200/200/${encodeURIComponent(conv.title.split(',')[0]?.trim() ?? 'travel')}/travel`;
  return (
    <span
      className={cn('overflow-hidden bg-slate-100 shrink-0', header ? 'rounded-xl' : 'rounded-2xl')}
      style={{ width: size, height: size }}
    >
      <img src={cover} alt={conv.title} className="w-full h-full object-cover" loading="lazy" />
    </span>
  );
}
