import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = useGoogleLogin({
    // By removing the 'auth-code' flow, it defaults to 'implicit' flow
    // which directly returns the access_token we need.
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      setError(null);
      try {
        // Send the access_token directly to our backend
        const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/google', {
          token: tokenResponse.access_token,
        });

        login(data.token, data.user);
        navigate('/home');
      } catch (err) {
        console.error("Backend rejection:", err);
        setError('Sign-in failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed.');
    },
  });

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo / Brand */}
        <div className="login-brand">
          <div className="login-brand-icon">✈️</div>
          <h1 className="login-title">TripMate</h1>
          <p className="login-subtitle">Find your travel tribe.</p>
        </div>

        {/* Illustration blobs */}
        <div className="login-blobs" aria-hidden="true">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
        </div>

        {/* CTA */}
        <div className="login-cta">
          <p className="login-cta-text">
            Connect with travellers going exactly where you are.
          </p>

          <button
            id="google-login-btn"
            type="button"
            className="google-btn"
            onClick={() => handleGoogleLogin()}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="google-btn-spinner" />
            ) : (
              <GoogleIcon />
            )}
            <span>{isLoading ? 'Signing in…' : 'Continue with Google'}</span>
          </button>

          {error && <p className="login-error">{error}</p>}

          <p className="login-disclaimer">
            By continuing, you agree to our{' '}
            <a href="/terms">Terms of Service</a> and{' '}
            <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
