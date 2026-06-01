/** Backend base URL, configured via VITE_BACKEND_URL (see .env.example). */
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, '') || 'http://localhost:4000';

/** Full URL that kicks off the Microsoft OAuth flow on the backend. */
export const MICROSOFT_LOGIN_URL = `${BACKEND_URL}/auth/microsoft`;

/**
 * Admin gate credentials. Overridable via env so they aren't fixed in source.
 *   VITE_ADMIN_USER / VITE_ADMIN_PASS
 *
 * NOTE: this is a CLIENT-SIDE gate only — the values end up in the built JS,
 * so treat it as a light barrier, not real authentication. The real security
 * (who can trigger emails) is the server-side API_KEY between Apps Script and
 * the backend.
 */
export const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || 'hng@admin';
export const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'hng@4747';
