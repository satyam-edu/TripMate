import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import TripCard from '../components/TripCard';
import CreateTripModal from '../components/CreateTripModal';
import Requests from './Requests';
import type { Trip } from '../types';
import { Home as HomeIcon, PlusCircle, Bell as NavBellIcon, MessageSquare, User as UserIcon, Search, SlidersHorizontal, Menu } from 'lucide-react';

// ── Icons (all strictly sized) ────────────────────────────────────────────────
function PlusIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden animate-pulse">
      <div className="w-full aspect-[16/9] bg-slate-100" />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-4 bg-slate-100 rounded-full w-2/3" />
        <div className="h-3 bg-slate-100 rounded-full w-1/3" />
        <div className="flex gap-4">
          <div className="h-3 bg-slate-100 rounded-full w-28" />
          <div className="h-3 bg-slate-100 rounded-full w-20" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-100 flex-shrink-0" />
            <div className="h-3 bg-slate-100 rounded-full w-16" />
          </div>
          <div className="h-8 w-28 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
      <div className="relative mb-8 select-none">
        <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center">
          <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20" aria-hidden="true">
            {/* Globe */}
            <circle cx="52" cy="56" r="28" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="2" />
            <ellipse cx="52" cy="56" rx="11" ry="28" fill="none" stroke="#7dd3fc" strokeWidth="1.5" />
            <line x1="24" y1="56" x2="80" y2="56" stroke="#7dd3fc" strokeWidth="1.5" />
            <line x1="26" y1="44" x2="78" y2="44" stroke="#bae6fd" strokeWidth="1" />
            <line x1="26" y1="68" x2="78" y2="68" stroke="#bae6fd" strokeWidth="1" />
            {/* Plane */}
            <g transform="translate(10,14) rotate(-30 24 24)">
              <path d="M24 4 L30 20 L46 20 L34 28 L38 44 L24 36 L10 44 L14 28 L2 20 L18 20 Z" fill="#0f172a" opacity="0" />
              <path d="M8 22 C8 22 20 10 30 14 L44 8 C46 7 48 9 46 11 L36 20 L40 32 C41 35 38 37 36 35 L28 26 L16 32 L18 38 C19 40 17 42 15 41 L10 36 L6 38 C4 39 3 37 4 35 L8 28 L4 26 C2 25 3 22 5 22 Z" fill="#1e293b" />
            </g>
          </svg>
        </div>
      </div>

      <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">No trips yet.</h2>
      <p className="text-slate-500 text-sm max-w-[260px] leading-relaxed mb-8">
        Be the first adventurer. Post your trip and find your travel tribe.
      </p>

      <button
        type="button"
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-2xl shadow-lg hover:bg-sky-600 active:scale-95 transition-all duration-200"
      >
        <PlusIcon />
        Plan your first adventure
      </button>
    </div>
  );
}

// ── Error State ───────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
      <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-2xl">😕</div>
      <p className="text-slate-800 font-semibold text-sm">Couldn't load trips.</p>
      <p className="text-slate-400 text-xs">Check your connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-2xl hover:bg-teal-600 transition-all duration-200"
      >
        Retry
      </button>
    </div>
  );
}

// ── Bottom Navigation ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: HomeIcon, label: 'Home', active: true },
  { icon: PlusCircle, label: 'Post', active: false },
  { icon: NavBellIcon, label: 'Requests', active: false },
  { icon: MessageSquare, label: 'Chats', active: false },
  { icon: UserIcon, label: 'Profile', active: false },
] as const;

function BottomNav({
  onPostClick,
  onHomeClick,
  onHubClick,
  activeTab,
}: {
  onPostClick: () => void;
  onHomeClick: () => void;
  onHubClick: () => void;
  activeTab: string;
}) {
  return (
    <nav className="fixed bottom-0 w-full bg-white border-t border-slate-100 pb-safe pt-3 px-6 flex justify-between items-center z-[60] md:hidden">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.label === 'Home' ? activeTab === 'home'
          : item.label === 'Post' ? activeTab === 'post'
          : item.label === 'Requests' ? activeTab === 'requests'
          : false;
        const handleClick =
          item.label === 'Post' ? onPostClick
          : item.label === 'Home' ? onHomeClick
          : item.label === 'Requests' ? onHubClick
          : undefined;
        return (
          <button
            key={item.label}
            type="button"
            onClick={handleClick}
            className={`flex flex-col items-center transition-colors ${
              isActive ? 'text-sky-500' : 'text-slate-400 hover:text-slate-900'
            }`}
          >
            <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium mt-1">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Desktop Floated Nav ──────────────────────────────────────────────────────
function DesktopFloatedNav({
  name,
  onLogout,
  onPostClick,
  onHomeClick,
  onHubClick,
  activeTab,
}: {
  name: string;
  onLogout: () => void;
  onPostClick: () => void;
  onHomeClick: () => void;
  onHubClick: () => void;
  activeTab: string;
}) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  return (
    <div className="hidden md:flex justify-between items-center py-6 mb-4">

      {/* Left: Brand */}
      <span className="text-2xl font-bold text-slate-900">Trip Mate</span>

      {/* Center: Nav Links */}
      <nav className="flex items-center gap-8">
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive =
            item.label === 'Home' ? activeTab === 'home'
            : item.label === 'Post' ? activeTab === 'post'
            : item.label === 'Requests' ? activeTab === 'requests'
            : false;
          const handleClick =
            item.label === 'Home' ? onHomeClick
            : item.label === 'Post' ? onPostClick
            : item.label === 'Requests' ? onHubClick
            : undefined;
          return (
            <button
              key={item.label}
              type="button"
              onClick={handleClick}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                isActive ? 'text-sky-500' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Right: Bell + Profile Pill */}
      <div className="flex items-center gap-4">

        <button
          type="button"
          title="Notifications"
          className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors"
        >
          <NavBellIcon className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((o) => !o)}
            title="Profile menu"
            className="flex items-center gap-2 border border-slate-200 rounded-full p-1 pl-3 hover:shadow-md transition-shadow cursor-pointer"
          >
            <Menu className="w-4 h-4 text-slate-600" />
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
              {name[0]?.toUpperCase() ?? 'T'}
            </div>
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 top-12 w-48 bg-white border border-slate-100 rounded-xl shadow-lg py-1 z-50">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(false)}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => { setIsProfileMenuOpen(false); onLogout(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-slate-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function PageHeader({ name }: { name: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex justify-between items-center mb-8 md:hidden">

      {/* Left: Greeting */}
      <div className="flex flex-col">
        <p className="text-sm text-slate-500">{greeting}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {name.split(' ')[0]}
        </h1>
      </div>

      {/* Right: Bell */}
      <button
        type="button"
        title="Notifications"
        className="relative w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-900 shadow-sm border border-slate-100 hover:bg-slate-100 transition-colors"
      >
        <NavBellIcon className="w-5 h-5" />
        <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-sky-500 border border-white"></span>
      </button>
    </div>
  );
}

// ── Search Bar ────────────────────────────────────────────────────────────────
function SearchBar() {
  return (
    <div className="w-full bg-slate-50 rounded-full flex items-center px-5 py-3.5 mt-6 mb-7 shadow-sm border border-slate-100 focus-within:ring-2 focus-within:ring-sky-500/50 transition-shadow">
      <Search className="text-slate-400 w-5 h-5 shrink-0" />
      <input
        type="search"
        placeholder="Search destinations, dates…"
        readOnly
        className="flex-1 bg-transparent border-none outline-none text-slate-900 placeholder:text-slate-400 px-3 min-w-0"
      />
      <button type="button" aria-label="Filter" className="shrink-0 flex items-center">
        <SlidersHorizontal className="text-slate-400 w-5 h-5 hover:text-slate-600 transition-colors" />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const { user, logout } = useAuth();
  const [trips, setTrips]               = useState<Trip[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [hasError, setHasError]         = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab]       = useState<string>('home');

  const fetchTrips = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const { data } = await api.get<Trip[]>('/trips');
      setTrips(data);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTrips(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 md:pt-0">

        <DesktopFloatedNav
          name={user?.name ?? 'Traveller'}
          onLogout={logout}
          activeTab={activeTab}
          onHomeClick={() => { setActiveTab('home'); setIsCreateModalOpen(false); }}
          onPostClick={() => { setActiveTab('post'); setIsCreateModalOpen(true); }}
          onHubClick={() => { setActiveTab('requests'); setIsCreateModalOpen(false); }}
        />

        {activeTab === 'requests' ? (
          <Requests />
        ) : (
          <>
            <PageHeader name={user?.name ?? 'Traveller'} />
            <SearchBar />

            {/* Section heading */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold text-slate-900">Upcoming Trips</h2>
              {trips.length > 0 && !isLoading && (
                <button type="button" className="text-xs font-semibold text-teal-600 hover:text-violet-600 transition-colors">
                  See all
                </button>
              )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
              ) : hasError ? (
                <ErrorState onRetry={fetchTrips} />
              ) : trips.length === 0 ? (
                <EmptyState onCreateClick={() => { setIsCreateModalOpen(true); setActiveTab('post'); }} />
              ) : (
                trips.map((trip) => <TripCard key={trip.id} trip={trip} currentUserId={user?.id ?? ''} />)
              )}
            </div>
          </>
        )}

      </div>

      <BottomNav
        activeTab={activeTab}
        onHomeClick={() => { setActiveTab('home'); setIsCreateModalOpen(false); }}
        onPostClick={() => { setActiveTab('post'); setIsCreateModalOpen(true); }}
        onHubClick={() => { setActiveTab('requests'); setIsCreateModalOpen(false); }}
      />
      {isCreateModalOpen && (
        <CreateTripModal
          onClose={() => { setIsCreateModalOpen(false); setActiveTab('home'); }}
        />
      )}
    </div>
  );
}
