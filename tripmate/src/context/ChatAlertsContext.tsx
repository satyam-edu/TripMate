import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { alertsEnabled, desktopAllowed } from '../services/alerts';
import { useAuth } from './AuthContext';
import { Avatar } from '../components/ui-bits';

// What the server pushes for every new chat message (see backend chat.controller sendMessage).
export interface ChatPush {
  kind: 'groups' | 'inquiries';
  conversationId: string;
  chatTitle: string;
  message: { id: string; text: string; createdAt: string; sender: { id: string; name: string; avatar: string | null } };
}

interface ChatAlertsValue {
  unreadTotal: number; // badge on the Chats menu item
  refreshUnread: () => void; // re-count from the server (after a chat is marked read)
}

const ChatAlertsContext = createContext<ChatAlertsValue>({ unreadTotal: 0, refreshUnread: () => {} });

const BASE_TITLE = document.title;
const chatLink = (p: ChatPush) => `/chats?tab=${p.kind}&chatId=${p.conversationId}`;

/* ── App-wide chat alerts: unread badge, in-app pop-up, tab title, desktop notification ── */
export function ChatAlertsProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [toast, setToast] = useState<ChatPush | null>(null);

  const refreshUnread = useCallback(() => {
    api
      .get<{ total: number }>('/chats/unread-count')
      .then(({ data }) => setUnreadTotal(data.total))
      .catch((error) => console.error('[ChatAlerts] unread count failed', error));
  }, []);

  useEffect(refreshUnread, [refreshUnread]);

  // Which chat the user is looking at right now ("groups:<id>"), read by the socket listener.
  const viewingRef = useRef<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const chatId = p.get('chatId');
    viewingRef.current =
      location.pathname === '/chats' && chatId ? `${p.get('tab') === 'inquiries' ? 'inquiries' : 'groups'}:${chatId}` : null;
  }, [location]);

  useEffect(() => {
    if (!token || !user) return;
    const socket = getSocket(token);
    const onMessage = (push: ChatPush) => {
      if (push.message.sender.id === user.id) return; // my own message (e.g. from another tab)
      const key = `${push.kind}:${push.conversationId}`;
      const viewing = viewingRef.current === key;
      if (viewing && !document.hidden) return; // on screen: the Chats page marks it read

      setUnreadTotal((n) => n + 1);
      if (!alertsEnabled()) return; // muted: badges still count, no interruptions
      if (!viewing) setToast(push);

      // Desktop notification when the TripMate tab is in the background (and alerts are switched on).
      if (document.hidden && desktopAllowed()) {
        const n = new Notification(`${push.message.sender.name.split(' ')[0]} · ${push.chatTitle}`, {
          body: push.message.text,
          icon: push.message.sender.avatar ?? undefined,
          tag: key, // one notification per chat, replaced by newer messages
        });
        n.onclick = () => {
          window.focus();
          navigate(chatLink(push));
          n.close();
        };
      }
    };
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [token, user, navigate]);

  // "(3) tripmate" in the browser tab while there are unread messages.
  useEffect(() => {
    document.title = unreadTotal > 0 ? `(${unreadTotal}) ${BASE_TITLE}` : BASE_TITLE;
  }, [unreadTotal]);

  // Pop-up hides itself after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <ChatAlertsContext.Provider value={{ unreadTotal, refreshUnread }}>
      {children}

      {toast && (
        <div className="fixed z-[60] bottom-24 left-4 right-4 sm:left-auto sm:right-6 lg:bottom-6 sm:w-96">
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.18)] p-3">
            <button
              type="button"
              onClick={() => {
                navigate(chatLink(toast));
                setToast(null);
              }}
              className="flex-1 min-w-0 flex items-center gap-3 text-left"
            >
              <Avatar src={toast.message.sender.avatar} name={toast.message.sender.name} size={40} />
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-slate-900 truncate">
                  {toast.message.sender.name.split(' ')[0]} · {toast.chatTitle}
                </span>
                <span className="block text-[13px] text-slate-500 truncate">{toast.message.text}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss"
              className="text-slate-400 hover:text-slate-600 shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </ChatAlertsContext.Provider>
  );
}

export function useChatAlerts() {
  return useContext(ChatAlertsContext);
}
