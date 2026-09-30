import axios from 'axios';
import { trackRequest } from './serverWakeStatus';

// ── Axios Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor ───────────────────────────────────────────────────────
// Automatically attaches the stored JWT to every outgoing request, and starts the
// "is the server waking up?" timer (see serverWakeStatus.ts — Render's free tier
// cold-starts after inactivity, so the first request of the day can be slow).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tripmate_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  (config as { _settleWake?: () => void })._settleWake = trackRequest();
  return config;
});

// ── Response Interceptor ──────────────────────────────────────────────────────
// Expired/invalid JWT → clear the session and send the user back to /login.
api.interceptors.response.use(
  (res) => {
    (res.config as { _settleWake?: () => void })._settleWake?.();
    return res;
  },
  (error) => {
    (error.config as { _settleWake?: () => void } | undefined)?._settleWake?.();
    if (error.response?.status === 401 && localStorage.getItem('tripmate_token')) {
      localStorage.removeItem('tripmate_token');
      localStorage.removeItem('tripmate_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Pulls the backend's { error: "..." } message out of a failed request.
export function apiErrorMessage(err: unknown, fallback: string): string {
  return axios.isAxiosError(err) && typeof err.response?.data?.error === 'string'
    ? err.response.data.error
    : fallback;
}

export default api;
