import axios from 'axios';

// ── Axios Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: 'http://localhost:5001/api',
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

export default api;
