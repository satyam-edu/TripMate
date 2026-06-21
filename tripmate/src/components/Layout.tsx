import { NavLink, Outlet } from 'react-router-dom';
import { Home, PlusCircle, Inbox, MessageCircle, User, LogOut } from 'lucide-react';
import { Avatar, cn } from './ui-bits';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../context/AuthContext';

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
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

/* ── Desktop sidebar ────────────────────────────────────────────────────────── */
function Sidebar({ user, onLogout }: { user: AuthUser | null; onLogout: () => void }) {
  const name = user?.name ?? 'Traveller';
  return (
    <aside className="hidden lg:flex flex-col w-[240px] shrink-0 h-screen sticky top-0 border-r border-[#E2E8F0] bg-white px-4 py-6">
      <div className="flex items-center gap-2 px-3 mb-8">
        <span className="text-[#2563EB]" style={{ fontSize: 22, fontWeight: 800 }}>
          TripMate
        </span>
        <span style={{ fontSize: 18 }}>✈️</span>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors text-left',
                  isActive ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#64748B] hover:bg-[#F8FAFC]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                  <span style={{ fontSize: 15, fontWeight: isActive ? 600 : 500 }}>{it.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2">
        <NavLink
          to="/profile"
          className="flex-1 min-w-0 flex items-center gap-3 rounded-2xl p-2 hover:bg-[#F8FAFC] transition-colors"
        >
          <Avatar src={user?.avatar ?? null} name={name} size={40} />
          <span className="text-left leading-tight min-w-0">
            <span className="block text-[#0F172A] truncate" style={{ fontSize: 14, fontWeight: 600 }}>
              {name}
            </span>
            <span className="block text-[#94A3B8]" style={{ fontSize: 12 }}>
              Traveler
            </span>
          </span>
        </NavLink>
        <button
          onClick={onLogout}
          title="Sign out"
          aria-label="Sign out"
          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#ef4444] transition-colors"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}

/* ── Mobile floating bottom nav ─────────────────────────────────────────────── */
function BottomNav() {
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
              aria-label={it.label}
              className={({ isActive }) =>
                cn(
                  'w-11 h-11 rounded-full flex items-center justify-center transition-all',
                  isActive ? 'bg-[#2563EB] text-white shadow-md shadow-blue-300' : 'text-[#94A3B8]',
                )
              }
            >
              {({ isActive }) => <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
