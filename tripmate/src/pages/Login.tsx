import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../context/AuthContext';

// Remember who has signed in on this device, so we only say "welcome back" to returning users.
const SEEN_KEY = 'tripmate_returning';
const isReturning = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returning] = useState(isReturning);

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
        try {
          localStorage.setItem(SEEN_KEY, '1');
        } catch {
          /* storage blocked: fine, we just greet them as new next time */
        }
        // Back to the page they were trying to open (e.g. a shared trip link).
        navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
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
    <div className="relative min-h-screen overflow-hidden">
      {/* ── Full-screen looping video background ───────────────────────────────── */}
      <video
        src="/travel-bg.mp4"
        poster="/travel-bg-poster.jpg"
        preload="auto"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Dark gradient: heavier on the left where the text sits, lighter on the right */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-slate-950/30 lg:bg-gradient-to-r lg:from-slate-950/80 lg:via-slate-950/40 lg:to-slate-950/10 z-10" />

      {/* ── Desktop header: brand on the left, sign-in on the right ─────────────── */}
      <header className="hidden lg:block absolute top-0 inset-x-0 z-30">
        <div className="max-w-6xl mx-auto px-8 h-20 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="w-10 h-10 rounded-full" />
            <span style={{ fontSize: 24, fontWeight: 800 }}>TripMate</span>
          </div>
          <div className="relative">
            <button
              onClick={() => handleGoogleLogin()}
              disabled={isLoading}
              className="flex items-center gap-2.5 pl-3 pr-5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-800 shadow-lg disabled:opacity-60 transition-colors"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              {isLoading ? <span className="google-btn-spinner" /> : <GoogleIcon />}
              {isLoading ? 'Signing in…' : returning ? 'Sign in with Google' : 'Get started with Google'}
            </button>
            {error && (
              <p className="absolute right-0 top-full mt-2 w-max text-[#fca5a5]" style={{ fontSize: 13, fontWeight: 500 }}>
                {error}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-20 min-h-screen max-w-6xl mx-auto px-5 sm:px-8 py-8 lg:pt-28 lg:pb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 lg:gap-8">
        {/* ── Brand + pitch ────────────────────────────────────────────────────── */}
        <div className="flex-1 lg:flex-none flex flex-col text-white lg:max-w-lg">
          <div className="flex lg:hidden items-center gap-2.5">
            <img src="/logo.png" alt="" className="w-10 h-10 rounded-full" />
            <span style={{ fontSize: 24, fontWeight: 800 }}>TripMate</span>
          </div>

          <div className="mt-auto lg:mt-0">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl leading-[1.1] tracking-tight" style={{ fontWeight: 800 }}>
              Don't travel alone.
              <br />
              Find your crew.
            </h2>
            <p className="hidden lg:block mt-5 text-white/80" style={{ fontSize: 17 }}>
              Join trips hosted by real travellers, or post your own and pick who comes along.
            </p>
            <ul className="mt-4 lg:mt-8 flex flex-wrap gap-2.5">
              {['Verified travellers', 'Trip group chats', 'Women only trips'].map((f) => (
                <li
                  key={f}
                  className="px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-white/90"
                  style={{ fontSize: 13, fontWeight: 500 }}
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Sign-in card ─────────────────────────────────────────────────────── */}
        <div className="lg:hidden w-full max-w-sm mx-auto bg-slate-950/40 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl p-6 sm:p-8">
          <h1 className="text-white tracking-tight text-2xl" style={{ fontWeight: 800 }}>
            {returning ? 'Welcome back!' : 'Get started'}
          </h1>
          <p className="text-white/70 mt-1.5" style={{ fontSize: 15 }}>
            {returning ? 'Sign in to pick up where you left off.' : 'Sign in to find your next trip.'}
          </p>

          {/* ── Google auth (REAL: handler + variables preserved) ─────────────── */}
          <button
            onClick={() => handleGoogleLogin()}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 mt-6 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white rounded-xl py-3.5 transition-colors"
            style={{ fontSize: 15, fontWeight: 600 }}
          >
            {isLoading ? <span className="google-btn-spinner" /> : <GoogleIcon />}
            {isLoading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {error && (
            <p className="text-[#ef4444] mt-4 text-center" style={{ fontSize: 13, fontWeight: 500 }}>
              {error}
            </p>
          )}

          <p className="flex items-center justify-center gap-1.5 text-white/60 mt-5" style={{ fontSize: 12 }}>
            <ShieldCheck size={14} className="text-[#16a34a]" />
            We never post anything without your permission.
          </p>
        </div>
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
