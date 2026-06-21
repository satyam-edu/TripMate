import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Google auth logic preserved ──────────────────────────────────────────────
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/google', {
          token: tokenResponse.access_token,
        });
        login(data.token, data.user);
        navigate('/');
      } catch (err) {
        console.error('Backend rejection:', err);
        setError('Sign-in failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => setError('Google sign-in was cancelled or failed.'),
  });

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center">
      {/* ── Full-screen looping video background ───────────────────────────────── */}
      <video
        src="/travel-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-slate-950/40 z-10" />

      {/* ── Login modal ────────────────────────────────────────────────────────── */}
      <div className="relative z-20 w-[85%] sm:w-full max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-5 sm:p-8">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-7">
          <span className="text-[#2563EB]" style={{ fontSize: 22, fontWeight: 800 }}>
            TripMate
          </span>
          <span style={{ fontSize: 18 }}>✈️</span>
        </div>

        {/* Heading */}
        <h1 className="text-slate-900 tracking-tight text-2xl sm:text-3xl" style={{ fontWeight: 800 }}>
          Hello, Again!
        </h1>
        <p className="text-slate-500 mt-2" style={{ fontSize: 15 }}>
          Sign in to start your adventure.
        </p>

        {/* ── Google auth (REAL — handler + variables preserved) ───────────────── */}
        <button
          onClick={() => handleGoogleLogin()}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 mt-7 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white rounded-xl py-3.5 transition-colors"
          style={{ fontSize: 15, fontWeight: 600 }}
        >
          {isLoading ? <span className="google-btn-spinner" /> : <GoogleIcon />}
          {isLoading ? 'Signing in…' : 'Continue with Google'}
        </button>

        {/* Error */}
        {error && (
          <p className="text-[#ef4444] mt-4 text-center" style={{ fontSize: 13, fontWeight: 500 }}>
            {error}
          </p>
        )}

        <p className="flex items-center justify-center gap-1.5 text-slate-400 mt-6" style={{ fontSize: 12 }}>
          <ShieldCheck size={14} className="text-[#16a34a]" />
          We never post anything without your permission.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="bg-white rounded-full p-0.5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
