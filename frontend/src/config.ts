/** Backend base URL, configured via VITE_BACKEND_URL (see .env.example). */
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, '') || 'http://localhost:4000';

/** Full URL that kicks off the Microsoft OAuth connect flow on the backend. */
export const MICROSOFT_LOGIN_URL = `${BACKEND_URL}/auth/microsoft`;

/** Admin connection-management endpoints. */
export const ADMIN_STATUS_URL = `${BACKEND_URL}/admin/status`;
export const ADMIN_DISCONNECT_URL = `${BACKEND_URL}/admin/disconnect`;

/**
 * Admin gate credentials. Overridable via env so they aren't fixed in source.
 *   VITE_ADMIN_USER / VITE_ADMIN_PASS
 *
 * NOTE: this is a CLIENT-SIDE gate — the values end up in the built JS, so it's
 * a light barrier. The password is also sent as the `x-admin-secret` header to
 * the backend, which validates it server-side for /admin/* endpoints.
 */
export const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || 'hng@admin';
export const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'hng@4747';
