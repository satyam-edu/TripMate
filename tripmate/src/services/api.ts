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

// ── GET cache ─────────────────────────────────────────────────────────────────
// Last successful response per GET url. Pages render it instantly (no skeleton) and
// still refetch in the background (stale-while-revalidate). Saved to localStorage so a
// reload — or a cold-starting server — still shows the last data right away.
const CACHE_KEY = 'tripmate_cache';
const CACHE_MAX = 40; // ponytail: oldest-first eviction keeps localStorage small; trip/profile pages add up
const lastGet = new Map<string, unknown>(
  (() => {
    try {
      return Object.entries(JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, unknown>);
    } catch {
      return [];
    }
  })(),
);
export const cachedGet = <T,>(url: string) => lastGet.get(url) as T | undefined;
function rememberGet(url: string, data: unknown) {
  lastGet.delete(url); // re-insert so it counts as newest
  lastGet.set(url, data);
  if (lastGet.size > CACHE_MAX) lastGet.delete(lastGet.keys().next().value!);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(lastGet)));
  } catch {
    // storage full/blocked: the in-memory cache still works
  }
}
export function clearGetCache() {
  lastGet.clear();
  localStorage.removeItem(CACHE_KEY);
}

// ── Response Interceptor ──────────────────────────────────────────────────────
// Expired/invalid JWT → clear the session and send the user back to /login.
api.interceptors.response.use(
  (res) => {
    (res.config as { _settleWake?: () => void })._settleWake?.();
    if (res.config.method === 'get' && res.config.url) rememberGet(res.config.url, res.data);
    return res;
  },
  (error) => {
    (error.config as { _settleWake?: () => void } | undefined)?._settleWake?.();
    if (error.response?.status === 401 && localStorage.getItem('tripmate_token')) {
      localStorage.removeItem('tripmate_token');
      localStorage.removeItem('tripmate_user');
      clearGetCache();
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
