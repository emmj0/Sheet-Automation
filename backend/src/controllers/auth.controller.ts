/**
 * Auth controller.
 *
 * End-user login (Microsoft):
 *   GET /auth/microsoft           -> redirect to Microsoft consent screen
 *   GET /auth/microsoft/callback  -> exchange code, save email, bounce to frontend
 *
 * One-time sender-mailbox authorization (admin only):
 *   GET /auth/microsoft/mail-setup     -> redirect to consent (Mail.Send)
 *   GET /auth/microsoft/mail-callback  -> persist refresh token for sending
 */
import { Request, Response } from 'express';
import { env } from '../config/env';
import { logger, logEvents } from '../utils/logger';
import {
  getLoginUrl,
  getMailAuthUrl,
  handleLoginCallback,
  handleMailCallback,
} from '../services/microsoftAuth.service';
import { addUser } from '../services/sheets.service';

/* ── End-user login ───────────────────────────────────────────────────── */

/** Start the Microsoft login flow. */
export async function startMicrosoftLogin(_req: Request, res: Response): Promise<void> {
  const url = await getLoginUrl();
  res.redirect(url);
}

/** Handle Microsoft's redirect back to us after login. */
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
    const profile = await handleLoginCallback(code);
    logEvents.oauthLogin(profile.email);

    const result = await addUser(profile.email);
    logEvents.userRegistered(result.email, result.rowNumber, result.created);

    const params = new URLSearchParams({
      status: result.created ? 'new' : 'existing',
      email: result.email,
    });
    res.redirect(`${env.frontendUrl}/success?${params.toString()}`);
  } catch (err) {
    logger.error('Microsoft login callback failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.redirect(`${env.frontendUrl}/error?reason=oauth_failed`);
  }
}

/* ── One-time sender-mailbox authorization ────────────────────────────── */

/** Admin visits this once (signed in as the sender outlook.com account). */
export async function startMailSetup(_req: Request, res: Response): Promise<void> {
  const url = await getMailAuthUrl();
  res.redirect(url);
}

/** Persist the sender's refresh token so the backend can send mail later. */
export async function handleMailSetupCallback(req: Request, res: Response): Promise<void> {
  const { code, error, error_description } = req.query as {
    code?: string;
    error?: string;
    error_description?: string;
  };

  if (error || !code) {
    logger.error('Mail authorization failed', { error, error_description });
    res
      .status(400)
      .send(`Mail authorization failed: ${error_description || error || 'missing code'}`);
    return;
  }

  try {
    const sender = await handleMailCallback(code);
    res
      .status(200)
      .send(
        `<h2>✅ Sender mailbox authorized</h2>` +
          `<p>The backend can now send emails as <strong>${sender}</strong>.</p>` +
          `<p>You can close this tab.</p>`
      );
  } catch (err) {
    logger.error('Mail authorization callback failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).send('Mail authorization failed. Check the server logs.');
  }
}
