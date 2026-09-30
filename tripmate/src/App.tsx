import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppShell } from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import PostTab from './pages/PostTab';
import Requests from './pages/Requests';
import Chats from './pages/Chats';
import Profile from './pages/Profile';
import TripDetail from './pages/TripDetail';
import PublicProfile from './pages/PublicProfile';
import { useServerWaking } from './services/serverWakeStatus';

// Shown whenever a request has been pending a while (a cold-started free-tier backend
// can take 30-50s to wake up for the first request of the day).
function ServerWakingBanner() {
  const waking = useServerWaking();
  if (!waking) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white text-sm font-semibold text-center py-2 px-4">
      Waking up the server — this can take up to a minute on the first request. Hang tight…
    </div>
  );
}

// Guards the authenticated app: redirect to /login when signed out, render the
// shell (sidebar + bottom nav + <Outlet/>) when signed in.
function ProtectedShell() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null; // wait for rehydration to avoid a flash-redirect
  // Remember where they were going (e.g. a shared trip link) so login can send them back.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <AppShell />;
}

// Keeps authenticated users out of /login.
function LoginRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;
  return <Login />;
}

export default function App() {
  return (
    <>
      <ServerWakingBanner />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginRoute />} />

        {/* Protected (share the app shell) */}
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/post" element={<PostTab />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/trips/:id" element={<TripDetail />} />
          <Route path="/users/:id" element={<PublicProfile />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
