import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, PlusCircle, Inbox, MessageCircle, User, LogOut } from 'lucide-react';
import { Avatar, cn } from './ui-bits';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../context/AuthContext';
import { ChatAlertsProvider, useChatAlerts } from '../context/ChatAlertsContext';

const items: { to: string; label: string; icon: typeof Home; end?: boolean }[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/post', label: 'Post', icon: PlusCircle },
  { to: '/requests', label: 'Requests', icon: Inbox },
  { to: '/chats', label: 'Chats', icon: MessageCircle },
  { to: '/profile', label: 'Profile', icon: User },
];

/* ── App shell: sidebar (desktop) + bottom nav (mobile) + routed content ─────── */
export function AppShell() {
  const { user, logout } = useAuth();
  return (
    <ChatAlertsProvider>
      <div className="min-h-screen bg-[#F8FAFC] flex">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </ChatAlertsProvider>
  );
}

/* ── Red unread-count dot for the Chats menu item ───────────────────────────── */
function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-bold flex items-center justify-center',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/* ── Desktop sidebar: dark icon rail with a sliding "notch" on the active item ─ */
const PAGE_BG = '#F8FAFC'; // must match the page background so the notch reads as a cut-out
const RAIL_ITEMS = items.filter((it) => it.to !== '/profile'); // Profile is the avatar at the bottom
const SLOT = 60; // height of one rail item (px)
const NOTCH_W = 52;
const NOTCH_H = 116;

function Sidebar({ user, onLogout }: { user: AuthUser | null; onLogout: () => void }) {
  const name = user?.name ?? 'Traveller';
  const { unreadTotal } = useChatAlerts();
  const { pathname } = useLocation();
  const activeIndex = RAIL_ITEMS.findIndex((it) => (it.end ? pathname === it.to : pathname.startsWith(it.to)));
  const profileActive = pathname.startsWith('/profile');

  return (
    <aside className="hidden lg:block w-[104px] shrink-0 h-screen sticky top-0 py-4 pl-4">
      <div className="relative h-full w-[72px] rounded-[28px] bg-[#2563EB] shadow-[0_8px_30px_rgba(37,99,235,0.25)] flex flex-col items-center py-5">
        {/* Logo */}
        <NavLink
          to="/"
          aria-label="TripMate home"
          className="w-11 h-11 rounded-full shrink-0 ring-2 ring-white/80 overflow-hidden"
        >
          <img src="/logo.png" alt="" className="w-full h-full object-cover" />
        </NavLink>

        {/* Main icons, vertically centred like the design */}
        <nav className="relative w-full my-auto" style={{ height: RAIL_ITEMS.length * SLOT }}>
          {/* The notch: a page-coloured wave on the rail's right edge that slides to the active item. */}
          <svg
            aria-hidden="true"
            width={NOTCH_W}
            height={NOTCH_H}
            viewBox={`0 0 ${NOTCH_W} ${NOTCH_H}`}
            className="absolute right-0 top-0 pointer-events-none transition-[transform,opacity] duration-300 ease-out"
            style={{
              transform: `translateY(${activeIndex * SLOT + SLOT / 2 - NOTCH_H / 2}px)`,
              opacity: activeIndex < 0 ? 0 : 1,
            }}
          >
            <path
              d={`M${NOTCH_W} 0 C${NOTCH_W} 36 2 32 2 ${NOTCH_H / 2} C2 ${NOTCH_H - 32} ${NOTCH_W} ${NOTCH_H - 36} ${NOTCH_W} ${NOTCH_H} Z`}
              fill={PAGE_BG}
            />
          </svg>

          {RAIL_ITEMS.map((it) => {
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                aria-label={it.to === '/chats' && unreadTotal > 0 ? `${it.label} (${unreadTotal} unread)` : it.label}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center justify-center w-full transition-colors duration-300',
                    isActive ? 'text-[#2563EB]' : 'text-white/70 hover:text-white',
                  )
                }
                style={{ height: SLOT }}
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon size={20} strokeWidth={isActive ? 2.6 : 2} />
                      {it.to === '/chats' && (
                        <UnreadBadge
                          count={unreadTotal}
                          className="absolute -top-2.5 -right-3 ring-2 ring-[#2563EB]"
                        />
                      )}
                    </span>
                    <RailTooltip label={it.label} />
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Profile + sign out */}
        <div className="flex flex-col items-center gap-4 shrink-0">
          <NavLink
            to="/profile"
            aria-label="Profile"
            className={cn(
              // flex (not inline) so the ring hugs the avatar exactly, with a small dark gap
              'group relative flex rounded-full ring-2 ring-offset-2 ring-offset-[#2563EB] transition-shadow',
              profileActive ? 'ring-white' : 'ring-transparent hover:ring-white/50',
            )}
          >
            <Avatar src={user?.avatar ?? null} name={name} size={40} />
            <RailTooltip label="Profile" />
          </NavLink>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            className="group relative w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            <RailTooltip label="Sign out" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* Name label that appears to the right of a rail icon on hover / keyboard focus. */
function RailTooltip({ label }: { label: string }) {
  return (
    <span
      className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0F172A] px-2.5 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 z-50"
    >
      {label}
    </span>
  );
}

/* ── Mobile floating bottom nav ─────────────────────────────────────────────── */
function BottomNav() {
  const { unreadTotal } = useChatAlerts();
  return (
    <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
      <nav className="flex items-center gap-1 bg-white/95 backdrop-blur-md border border-[#E2E8F0] rounded-full px-2 py-2 shadow-[0_8px_30px_rgba(15,23,42,0.12)]">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              aria-label={it.to === '/chats' && unreadTotal > 0 ? `${it.label} (${unreadTotal} unread)` : it.label}
              className={({ isActive }) =>
                cn(
                  'relative w-11 h-11 rounded-full flex items-center justify-center transition-all',
                  isActive ? 'bg-[#2563EB] text-white shadow-md shadow-blue-300' : 'text-[#94A3B8]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />
                  {it.to === '/chats' && (
                    <UnreadBadge count={unreadTotal} className="absolute -top-0.5 -right-0.5 ring-2 ring-white" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
