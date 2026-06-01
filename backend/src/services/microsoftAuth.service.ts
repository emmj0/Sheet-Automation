/**
 * Microsoft authentication (Azure AD / Microsoft identity platform) via MSAL.
 *
 * Two independent flows live here:
 *
 *  1) LOGIN  — end users click "Continue with Microsoft". We exchange the auth
 *     code for an ID token and read their email/name. No tokens are persisted;
 *     this client uses an in-memory cache.
 *
 *  2) MAIL   — a ONE-TIME admin consent that signs in the SENDER mailbox
 *     (the outlook.com account that sends emails) with `Mail.Send` +
 *     offline_access. MSAL caches the resulting refresh token to disk so the
 *     backend can later acquire access tokens silently and call
 *     Microsoft Graph /me/sendMail — even though Apps Script triggers the send
 *     long after the admin signed in.
 *
 * Why Graph + OAuth2 instead of SMTP? Microsoft disabled SMTP basic-auth and
 * app passwords for personal outlook.com/hotmail accounts, so OAuth2 is the
 * only supported path.
 */
import fs from 'fs';
import {
  ConfidentialClientApplication,
  Configuration,
  ICachePlugin,
  LogLevel,
} from '@azure/msal-node';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { UserProfile } from '../types';

const LOGIN_SCOPES = ['User.Read'];
const MAIL_SCOPES = ['Mail.Send'];

/* ── MSAL clients ─────────────────────────────────────────────────────── */

const baseAuth: Configuration['auth'] = {
  clientId: env.microsoft.clientId,
  clientSecret: env.microsoft.clientSecret,
  authority: env.microsoft.authority,
};

const baseSystem: Configuration['system'] = {
  loggerOptions: {
    loggerCallback: (level, message) => {
      if (level === LogLevel.Error) logger.error(`[MSAL] ${message}`);
    },
    piiLoggingEnabled: false,
    logLevel: LogLevel.Error,
  },
};

/** Login client: in-memory cache (we never persist end-user tokens). */
const loginClient = new ConfidentialClientApplication({
  auth: baseAuth,
  system: baseSystem,
});

/** Persist the sender's MSAL token cache to disk so refresh tokens survive restarts. */
const mailCachePlugin: ICachePlugin = {
  async beforeCacheAccess(ctx) {
    if (fs.existsSync(env.microsoft.tokenCachePath)) {
      ctx.tokenCache.deserialize(
        fs.readFileSync(env.microsoft.tokenCachePath, 'utf-8')
      );
    }
  },
  async afterCacheAccess(ctx) {
    if (ctx.cacheHasChanged) {
      fs.writeFileSync(
        env.microsoft.tokenCachePath,
        ctx.tokenCache.serialize(),
        { mode: 0o600 }
      );
    }
  },
};

const mailClient = new ConfidentialClientApplication({
  auth: baseAuth,
  system: baseSystem,
  cache: { cachePlugin: mailCachePlugin },
});

/* ── 1) End-user login flow ───────────────────────────────────────────── */

/** URL of the Microsoft consent screen for end-user login. */
export async function getLoginUrl(): Promise<string> {
  return loginClient.getAuthCodeUrl({
    scopes: LOGIN_SCOPES,
    redirectUri: env.microsoft.loginRedirectUri,
    prompt: 'select_account',
  });
}

/** Exchange the ?code= from the login callback for the user's profile. */
export async function handleLoginCallback(code: string): Promise<UserProfile> {
  const result = await loginClient.acquireTokenByCode({
    code,
    scopes: LOGIN_SCOPES,
    redirectUri: env.microsoft.loginRedirectUri,
  });

  const claims = (result.idTokenClaims ?? {}) as Record<string, unknown>;
  const email =
    result.account?.username ||
    (claims.email as string) ||
    (claims.preferred_username as string) ||
    '';

  if (!email) {
    throw new Error('Microsoft did not return an email address for this account.');
  }

  return {
    email: email.toLowerCase(),
    name: result.account?.name || (claims.name as string) || undefined,
  };
}

/* ── 2) Sender mailbox authorization (one-time) ───────────────────────── */

/** URL the ADMIN visits once to authorize the sending mailbox. */
export async function getMailAuthUrl(): Promise<string> {
  return mailClient.getAuthCodeUrl({
    scopes: MAIL_SCOPES, // MSAL adds offline_access automatically -> refresh token
    redirectUri: env.microsoft.mailRedirectUri,
    prompt: 'consent',
    ...(env.microsoft.mailSender ? { loginHint: env.microsoft.mailSender } : {}),
  });
}

/** Handle the admin's mail-consent callback and persist the account id. */
export async function handleMailCallback(code: string): Promise<string> {
  const result = await mailClient.acquireTokenByCode({
    code,
    scopes: MAIL_SCOPES,
    redirectUri: env.microsoft.mailRedirectUri,
  });

  const homeAccountId = result.account?.homeAccountId;
  if (!homeAccountId) {
    throw new Error('Mail authorization did not return an account.');
  }

  fs.writeFileSync(
    env.microsoft.mailAccountPath,
    JSON.stringify({
      homeAccountId,
      username: result.account?.username ?? '',
      authorizedAt: new Date().toISOString(),
    }),
    { mode: 0o600 }
  );

  logger.info('Sender mailbox authorized', {
    sender: result.account?.username,
  });
  return result.account?.username ?? '';
}

/** Is the sender mailbox authorized yet? */
export function isMailAuthorized(): boolean {
  return fs.existsSync(env.microsoft.mailAccountPath);
}

function readMailAccountId(): string {
  if (!fs.existsSync(env.microsoft.mailAccountPath)) {
    throw new Error(
      'Sender mailbox is not authorized yet. Visit ' +
        `${env.backendUrl}/auth/microsoft/mail-setup once while signed in as the sender.`
    );
  }
  const data = JSON.parse(fs.readFileSync(env.microsoft.mailAccountPath, 'utf-8'));
  return data.homeAccountId as string;
}

/**
 * Acquire a Graph access token for the sender mailbox using the cached
 * refresh token (MSAL renews/rotates it transparently).
 */
export async function getMailAccessToken(): Promise<string> {
  const homeAccountId = readMailAccountId();
  const account = await mailClient.getTokenCache().getAccountByHomeId(homeAccountId);
  if (!account) {
    throw new Error(
      'No cached account for the sender mailbox. Re-run the /auth/microsoft/mail-setup flow.'
    );
  }

  const result = await mailClient.acquireTokenSilent({
    account,
    scopes: MAIL_SCOPES,
  });

  if (!result?.accessToken) {
    throw new Error('Failed to acquire a Graph access token for the sender mailbox.');
  }
  return result.accessToken;
}
