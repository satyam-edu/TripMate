import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// Redirects to /login if the user is not authenticated.
// Shows nothing (null) while the auth state is being rehydrated from localStorage
// to prevent a flash-redirect on page refresh.
export default function ProtectedRoute({ children }: Props) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
