/**
 * Centralised, validated environment configuration.
 *
 * Importing this module loads .env (via dotenv) and exposes a typed `env`
 * object. It throws on startup if a required variable is missing, so the
 * process fails fast instead of breaking mid-request.
 *
 * Auth model:
 *   - END-USER LOGIN  -> Microsoft (Azure AD / Microsoft identity platform).
 *   - EMAIL SENDING   -> Microsoft Graph /me/sendMail using a refresh token
 *                        obtained from a one-time admin consent (OAuth2),
 *                        because personal outlook.com accounts no longer
 *                        allow SMTP basic-auth / app passwords.
 *   - GOOGLE SHEETS   -> Google service account (unchanged).
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

/** Read a required variable or throw a clear error. */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Copy .env.example to .env and fill it in.`
    );
  }
  return value.trim();
}

/** Read an optional variable with a fallback. */
function optional(name: string, fallback = ''): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

const BACKEND_URL = stripTrailingSlash(optional('BACKEND_URL', 'http://localhost:4000'));
const FRONTEND_URL = stripTrailingSlash(optional('FRONTEND_URL', 'http://localhost:5173'));
const MS_TENANT = optional('MS_TENANT', 'common');

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  isProduction: optional('NODE_ENV', 'development') === 'production',
  port: parseInt(optional('PORT', '4000'), 10),

  backendUrl: BACKEND_URL,
  frontendUrl: FRONTEND_URL,

  microsoft: {
    clientId: required('MS_CLIENT_ID'),
    clientSecret: required('MS_CLIENT_SECRET'),
    /** "common" (personal + work), "consumers" (personal only), or a tenant ID. */
    tenant: MS_TENANT,
    authority: `https://login.microsoftonline.com/${MS_TENANT}`,
    /** Redirect URI for END-USER login. */
    loginRedirectUri: optional(
      'MS_LOGIN_REDIRECT_URI',
      `${BACKEND_URL}/auth/microsoft/callback`
    ),
    /** Redirect URI for the one-time SENDER mailbox authorization. */
    mailRedirectUri: optional(
      'MS_MAIL_REDIRECT_URI',
      `${BACKEND_URL}/auth/microsoft/mail-callback`
    ),
    /** The outlook.com address that sends the emails (for display/verification). */
    mailSender: optional('MAIL_SENDER', ''),
    /** Where MSAL persists the sender's token cache + account id. */
    tokenCachePath: path.resolve(optional('MS_TOKEN_CACHE_PATH', './.mail-token-cache.json')),
    mailAccountPath: path.resolve(optional('MS_MAIL_ACCOUNT_PATH', './.mail-account.json')),
  },

  sheets: {
    spreadsheetId: required('GOOGLE_SHEET_ID'),
    sheetName: optional('GOOGLE_SHEET_NAME', 'Sheet1'),
    serviceAccountKeyPath: path.resolve(
      optional('SERVICE_ACCOUNT_KEY_PATH', './service-account.json')
    ),
    serviceAccountKeyBase64: optional('SERVICE_ACCOUNT_KEY_BASE64', ''),
  },

  apiKey: required('API_KEY'),

  mail: {
    /** Email subject. A specific line scores better with spam filters than "Welcome". */
    subject: optional('MAIL_SUBJECT', 'Your registration is confirmed'),
    /** Friendly product name used in the email body. */
    appName: optional('MAIL_APP_NAME', 'Email Automation'),
  },
};

export type Env = typeof env;
