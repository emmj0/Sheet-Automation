/**
 * Microsoft authentication (Azure AD / Microsoft identity platform) via MSAL.
 *
 * Merged "connection" model: signing in with Microsoft IS the connection.
 *   - "Continue with Microsoft" authorizes the account with Mail.Send +
 *     offline_access, so the same account both identifies the user AND can send
 *     the welcome emails.
 *   - The resulting token cache + connected account are persisted to a durable,
 *     DB-less store (a hidden tab in the Google Sheet — see tokenStore.ts), so
 *     the connection survives Render redeploys.
 *   - Disconnect clears that stored token, after which sending is disabled until
 *     someone connects again.
 *
 * Why Graph + OAuth2 (not SMTP)? Microsoft disabled SMTP basic-auth/app
 * passwords for personal outlook.com accounts; OAuth2 is the supported path.
 */
import {
  ConfidentialClientApplication,
  Configuration,
  ICachePlugin,
  LogLevel,
} from '@azure/msal-node';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import * as tokenStore from './tokenStore';
import type { UserProfile } from '../types';

/** Scopes requested when connecting. MSAL adds openid/profile/offline_access. */
const CONNECT_SCOPES = ['User.Read', 'Mail.Send'];

/* ── MSAL client with a durable (sheet-backed) token cache ────────────── */

const cachePlugin: ICachePlugin = {
  async beforeCacheAccess(ctx) {
    const blob = await tokenStore.getCacheBlob();
    if (blob) ctx.tokenCache.deserialize(blob);
  },
  async afterCacheAccess(ctx) {
    if (ctx.cacheHasChanged) {
      await tokenStore.setCacheBlob(ctx.tokenCache.serialize());
    }
  },
};

const config: Configuration = {
  auth: {
    clientId: env.microsoft.clientId,
    clientSecret: env.microsoft.clientSecret,
    authority: env.microsoft.authority,
  },
  cache: { cachePlugin },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        if (level === LogLevel.Error) logger.error(`[MSAL] ${message}`);
      },
      piiLoggingEnabled: false,
      logLevel: LogLevel.Error,
    },
  },
};

const msalClient = new ConfidentialClientApplication(config);

/* ── Connect (login) ──────────────────────────────────────────────────── */

/** URL of the Microsoft consent screen to connect an account. */
export async function getConnectUrl(): Promise<string> {
  return msalClient.getAuthCodeUrl({
    scopes: CONNECT_SCOPES,
    redirectUri: env.microsoft.loginRedirectUri,
    prompt: 'select_account',
  });
}

/**
 * Handle the OAuth callback: exchange the code (which caches the refresh token
 * via the durable plugin), record the connected account, and return the
 * user's profile so the caller can store the email in the sheet.
 */
export async function handleConnectCallback(code: string): Promise<UserProfile> {
  const result = await msalClient.acquireTokenByCode({
    code,
    scopes: CONNECT_SCOPES,
    redirectUri: env.microsoft.loginRedirectUri,
  });

  const claims = (result.idTokenClaims ?? {}) as Record<string, unknown>;
  const email =
    result.account?.username ||
    (claims.email as string) ||
    (claims.preferred_username as string) ||
    '';

  if (!email || !result.account?.homeAccountId) {
    throw new Error('Microsoft did not return an account/email for this sign-in.');
  }

  await tokenStore.setAccount({
    homeAccountId: result.account.homeAccountId,
    username: email.toLowerCase(),
    connectedAt: new Date().toISOString(),
  });

  logger.info('Microsoft account connected', { email: email.toLowerCase() });
  return { email: email.toLowerCase(), name: result.account?.name || (claims.name as string) || undefined };
}

/* ── Status / disconnect ──────────────────────────────────────────────── */

export interface ConnectionStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

/** Current connection status, read from the durable store. */
export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const account = await tokenStore.getAccount();
  return {
    connected: !!account,
    email: account?.username ?? null,
    connectedAt: account?.connectedAt ?? null,
  };
}

export async function isConnected(): Promise<boolean> {
  return (await tokenStore.getAccount()) !== null;
}

/** Remove the saved Microsoft connection (token + account). */
export async function disconnect(): Promise<void> {
  const account = await tokenStore.getAccount();
  if (account) {
    try {
      const msalAccount = await msalClient
        .getTokenCache()
        .getAccountByHomeId(account.homeAccountId);
      if (msalAccount) await msalClient.getTokenCache().removeAccount(msalAccount);
    } catch (err) {
      logger.warn('Could not remove MSAL account from cache during disconnect', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  await tokenStore.clear();
}

/* ── Sending: acquire a Graph token for the connected account ─────────── */

export async function getMailAccessToken(): Promise<string> {
  const account = await tokenStore.getAccount();
  if (!account) {
    throw new Error(
      'No Microsoft account is connected. Sign in with Microsoft (Connect) first.'
    );
  }

  const msalAccount = await msalClient
    .getTokenCache()
    .getAccountByHomeId(account.homeAccountId);
  if (!msalAccount) {
    throw new Error(
      'The connected account is missing from the token cache. Please reconnect.'
    );
  }

  const result = await msalClient.acquireTokenSilent({
    account: msalAccount,
    scopes: ['Mail.Send'],
  });
  if (!result?.accessToken) {
    throw new Error('Failed to acquire a Graph access token for the connected account.');
  }
  return result.accessToken;
}
