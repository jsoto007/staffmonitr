import axios from 'axios';

const normalizeApiBaseUrl = () => {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (envUrl) {
    const withoutTrailingSlash = envUrl.replace(/\/+$/, '');
    // Keep a consistent prefix even if the env var is set to a bare host.
    return withoutTrailingSlash.endsWith('/api') ? withoutTrailingSlash : `${withoutTrailingSlash}/api`;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }

  return '/api';
};

const api = axios.create({
  baseURL: normalizeApiBaseUrl(),
  timeout: 12000,
  withCredentials: true,
});

export default api;
