/**
 * Auth controller — merged Microsoft "connect" flow.
 *
 *   GET /auth/microsoft           -> redirect to Microsoft consent (connect)
 *   GET /auth/microsoft/callback  -> save token durably, record email, bounce back
 *
 * Signing in IS the connection: the token is persisted (durable token store)
 * and the same account is used to send the welcome emails.
 */
import { Request, Response } from 'express';
import { env } from '../config/env';
import { logger, logEvents } from '../utils/logger';
import {
  getConnectUrl,
  handleConnectCallback,
} from '../services/microsoftAuth.service';
import { addUser } from '../services/sheets.service';

/** Start the Microsoft connect/login flow. */
export async function startMicrosoftLogin(_req: Request, res: Response): Promise<void> {
  const url = await getConnectUrl();
  res.redirect(url);
}

/** Handle Microsoft's redirect back to us. */
export async function handleMicrosoftCallback(req: Request, res: Response): Promise<void> {
  const { code, error, error_description } = req.query as {
    code?: string;
    error?: string;
    error_description?: string;
  };

  if (error) {
    logger.warn('Microsoft login returned an error', { error, error_description });
    res.redirect(`${env.frontendUrl}/error?reason=${encodeURIComponent(error)}`);
    return;
  }
  if (!code) {
    res.redirect(`${env.frontendUrl}/error?reason=missing_code`);
    return;
  }

  try {
    const profile = await handleConnectCallback(code);
    logEvents.oauthLogin(profile.email);

    const result = await addUser(profile.email);
    logEvents.userRegistered(result.email, result.rowNumber, result.created);

    const params = new URLSearchParams({
      status: result.created ? 'new' : 'existing',
      email: result.email,
      connected: '1',
    });
    res.redirect(`${env.frontendUrl}/success?${params.toString()}`);
  } catch (err) {
    logger.error('Microsoft login callback failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.redirect(`${env.frontendUrl}/error?reason=oauth_failed`);
  }
}
