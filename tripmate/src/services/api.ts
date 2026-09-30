import axios from 'axios';

// ── Axios Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor ───────────────────────────────────────────────────────
// Automatically attaches the stored JWT to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tripmate_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response Interceptor ──────────────────────────────────────────────────────
// Expired/invalid JWT → clear the session and send the user back to /login.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('tripmate_token')) {
      localStorage.removeItem('tripmate_token');
      localStorage.removeItem('tripmate_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
