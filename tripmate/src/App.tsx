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
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
