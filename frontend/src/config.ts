/** Backend base URL, configured via VITE_BACKEND_URL (see .env.example). */
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, '') || 'http://localhost:4000';

/** Full URL that kicks off the Microsoft OAuth flow on the backend. */
export const MICROSOFT_LOGIN_URL = `${BACKEND_URL}/auth/microsoft`;
