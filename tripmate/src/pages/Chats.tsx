import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, ChevronLeft, Phone, MoreVertical, MessageCircle } from 'lucide-react';
import { Avatar, cn } from '../components/ui-bits';

/* ── Types ──────────────────────────────────────────────────────────────────── */
type ChatTab = 'groups' | 'inquiries';

interface Message {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
  authorName?: string;
  authorAvatar?: string | null;
}

interface Conversation {
  id: string;
  kind: ChatTab; // 'groups' → trip group chat · 'inquiries' → 1-on-1 join inquiry
  title: string; // trip name (group) or person name (inquiry)
  headerSubtitle: string; // shown in the room header
  image: string; // cover (group) or avatar (inquiry)
  lastMessage: string;
  time: string;
  unread: number;
  messages: Message[];
}

/* ── Mock data ──────────────────────────────────────────────────────────────── */
const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=400&h=400&fit=crop&auto=format`;

const COVER = {
  spiti: img('1626621341517-bbf3d9990a23'),
  goa: img('1512343879784-a960bf40e7f2'),
  manali: img('1593181629936-11c609b8db9b'),
};
const FACE = {
  rohan: img('1507003211169-0a1dd7228f2d'),
  ananya: img('1494790108377-be9c29b29330'),
  kabir: img('1506794778202-cad84cf45f1d'),
  priya: img('1534528741775-53994a69daeb'),
};

const CONVERSATIONS: Conversation[] = [
  // ── Active trip groups ──────────────────────────────────────────────────────
  {
    id: 'g1',
    kind: 'groups',
    title: 'Spiti Valley',
    headerSubtitle: '4/6 travelers · 12–19 Jul',
    image: COVER.spiti,
    lastMessage: 'Booked the tempo traveller — sharing details soon!',
    time: '2:14 PM',
    unread: 2,
    messages: [
      { id: 'm1', fromMe: false, authorName: 'Rohan', authorAvatar: FACE.rohan, text: 'Hey everyone! Excited for Spiti 🏔️', time: '1:40 PM' },
      { id: 'm2', fromMe: true, text: "Same here! What's the plan for day 1?", time: '1:42 PM' },
      { id: 'm3', fromMe: false, authorName: 'Rohan', authorAvatar: FACE.rohan, text: "We'll acclimatize at Kaza, then Key Monastery.", time: '1:45 PM' },
      { id: 'm4', fromMe: true, text: "Perfect. I'll carry a power bank and meds.", time: '1:48 PM' },
      { id: 'm5', fromMe: false, authorName: 'Rohan', authorAvatar: FACE.rohan, text: 'Booked the tempo traveller — sharing details soon!', time: '2:14 PM' },
    ],
  },
  {
    id: 'g2',
    kind: 'groups',
    title: 'Goa Coastline',
    headerSubtitle: '3/6 travelers · 3–7 Aug',
    image: COVER.goa,
    lastMessage: 'Anyone up for a sunrise at Anjuna?',
    time: '11:02 AM',
    unread: 0,
    messages: [
      { id: 'm1', fromMe: false, authorName: 'Ananya', authorAvatar: FACE.ananya, text: 'Anyone up for a sunrise at Anjuna?', time: '11:02 AM' },
      { id: 'm2', fromMe: true, text: 'Count me in 🌅', time: '11:05 AM' },
    ],
  },
  {
    id: 'g3',
    kind: 'groups',
    title: 'Manali & Kasol',
    headerSubtitle: '2/6 travelers · 20–26 Aug',
    image: COVER.manali,
    lastMessage: 'Carrying a tripod for the boulder shots.',
    time: 'Yesterday',
    unread: 0,
    messages: [
      { id: 'm1', fromMe: false, authorName: 'Rohan', authorAvatar: FACE.rohan, text: 'Carrying a tripod for the boulder shots.', time: 'Yesterday' },
    ],
  },

  // ── 1-on-1 join inquiries ───────────────────────────────────────────────────
  {
    id: 'i1',
    kind: 'inquiries',
    title: 'Ananya Iyer',
    headerSubtitle: 'Pending request · Spiti Valley',
    image: FACE.ananya,
    lastMessage: 'Hi! Is there still a spot open?',
    time: '3:20 PM',
    unread: 1,
    messages: [
      { id: 'm1', fromMe: false, authorName: 'Ananya', authorAvatar: FACE.ananya, text: 'Hi! Is there still a spot open for Spiti?', time: '3:18 PM' },
      { id: 'm2', fromMe: false, authorName: 'Ananya', authorAvatar: FACE.ananya, text: 'Hi! Is there still a spot open?', time: '3:20 PM' },
    ],
  },
  {
    id: 'i2',
    kind: 'inquiries',
    title: 'Kabir Singh',
    headerSubtitle: 'Pending request · Rishikesh Rapids',
    image: FACE.kabir,
    lastMessage: "I've done the Rishikesh stretch before 🙌",
    time: '1:05 PM',
    unread: 0,
    messages: [
      { id: 'm1', fromMe: false, authorName: 'Kabir', authorAvatar: FACE.kabir, text: "I've done the Rishikesh stretch before 🙌", time: '1:05 PM' },
      { id: 'm2', fromMe: true, text: 'Nice! How many trips so far?', time: '1:09 PM' },
    ],
  },
  {
    id: 'i3',
    kind: 'inquiries',
    title: 'Priya Nair',
    headerSubtitle: 'Waitlisted · Udaipur Heritage',
    image: FACE.priya,
    lastMessage: 'No worries, keep me posted!',
    time: 'Mon',
    unread: 0,
    messages: [
      { id: 'm1', fromMe: true, text: "Trip's full for now, but I'll waitlist you.", time: 'Mon' },
      { id: 'm2', fromMe: false, authorName: 'Priya', authorAvatar: FACE.priya, text: 'No worries, keep me posted!', time: 'Mon' },
    ],
  },
];

const TABS: { id: ChatTab; label: string }[] = [
  { id: 'groups', label: 'Groups' },
  { id: 'inquiries', label: 'Inquiries' },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   CHATS  (dual-tab · fixed app-like scroll layout · mobile full-screen takeover)
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function Chats() {
  // Tab + active chat are synced to the URL (?tab=groups|inquiries & chatId=…).
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab: ChatTab = searchParams.get('tab') === 'inquiries' ? 'inquiries' : 'groups';
  const activeId = searchParams.get('chatId');

  const [draft, setDraft] = useState('');
  const [convos, setConvos] = useState<Conversation[]>(CONVERSATIONS);

  const list = convos.filter((c) => c.kind === tab);
  const active = convos.find((c) => c.id === activeId) ?? null;

  // Lock background scroll while a chat is open (mobile overlay + desktop pane).
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  const switchTab = (t: ChatTab) => setSearchParams({ tab: t }); // also drops chatId → back to list
  const openChat = (id: string) => setSearchParams({ tab, chatId: id }); // push

  // Closing mirrors the hardware back button so we don't leave a re-openable entry.
  const closeChat = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else setSearchParams({ tab }, { replace: true });
  };

  const send = () => {
    if (!draft.trim() || !active) return;
    const msg: Message = { id: `n${Date.now()}`, fromMe: true, text: draft.trim(), time: 'Now' };
    setConvos((prev) =>
      prev.map((c) =>
        c.id === active.id ? { ...c, messages: [...c.messages, msg], lastMessage: msg.text, time: 'Now' } : c,
      ),
    );
    setDraft('');
  };

  return (
    <div className="flex flex-col lg:h-[calc(100vh-140px)]">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1 lg:mb-4 shrink-0">Chats</h1>

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
              </button>
            ))}
          </div>

          {/* Conversation list (scrolls within the pane on desktop) */}
          <div className="space-y-2 lg:flex-1 lg:overflow-y-auto lg:min-h-0 lg:pr-1">
            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400">
                <MessageCircle size={28} className="mb-2" />
                <p className="text-sm">{tab === 'groups' ? 'No active groups yet.' : 'No inquiries right now.'}</p>
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
                      <span className="text-slate-400 shrink-0 text-xs">{c.time}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 truncate text-[13px]">{c.lastMessage}</span>
                      {c.unread > 0 && (
                        <span className="bg-blue-600 text-white rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center shrink-0 text-[11px] font-bold">
                          {c.unread}
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
              {/* Header — locked at the top */}
              <div className="flex items-center gap-3 p-4 border-b border-slate-200 shrink-0">
                <button type="button" onClick={closeChat} className="lg:hidden text-slate-500" aria-label="Back">
                  <ChevronLeft size={22} />
                </button>
                <ConvThumb conv={active} size={40} header />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 text-[15px] font-bold truncate">{active.title}</p>
                  <p className="text-slate-400 text-xs truncate">{active.headerSubtitle}</p>
                </div>
                <button type="button" className="text-slate-400 hover:text-blue-600 transition-colors">
                  <Phone size={19} />
                </button>
                <button type="button" className="text-slate-400 hover:text-blue-600 transition-colors">
                  <MoreVertical size={19} />
                </button>
              </div>

              {/* Message list — the ONLY scrollable region */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {active.messages.map((m) => (
                  <div key={m.id} className={cn('flex gap-2 items-end', m.fromMe ? 'justify-end' : 'justify-start')}>
                    {!m.fromMe && <Avatar src={m.authorAvatar ?? null} name={m.authorName ?? '?'} size={28} />}
                    <div className="max-w-[75%]">
                      {!m.fromMe && m.authorName && (
                        <p className="text-slate-400 mb-1 ml-1 text-[11px] font-semibold">{m.authorName}</p>
                      )}
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-2.5 text-sm',
                          m.fromMe
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-white text-slate-900 border border-slate-200 rounded-bl-md',
                        )}
                      >
                        {m.text}
                      </div>
                      <p className={cn('text-slate-400 mt-1 text-[11px]', m.fromMe ? 'text-right mr-1' : 'ml-1')}>
                        {m.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input — locked at the bottom */}
              <div className="p-3 border-t border-slate-200 flex items-center gap-2 shrink-0">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder={tab === 'groups' ? 'Message the group…' : 'Write a reply…'}
                  className="flex-1 bg-slate-100 rounded-full px-5 py-3 outline-none text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={send}
                  className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 hidden lg:flex items-center justify-center text-slate-400 text-[15px]">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Thumbnail: square cover for groups, circular avatar for inquiries ──────── */
function ConvThumb({ conv, size, header }: { conv: Conversation; size: number; header?: boolean }) {
  if (conv.kind === 'inquiries') {
    return <Avatar src={conv.image} name={conv.title} size={size} />;
  }
  return (
    <span
      className={cn('overflow-hidden bg-slate-100 shrink-0', header ? 'rounded-xl' : 'rounded-2xl')}
      style={{ width: size, height: size }}
    >
      <img src={conv.image} alt={conv.title} className="w-full h-full object-cover" loading="lazy" />
    </span>
  );
}
