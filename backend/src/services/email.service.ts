/**
 * Email service — Outlook via Microsoft Graph (OAuth2).
 *
 * Personal outlook.com/hotmail accounts no longer support SMTP basic-auth or
 * app passwords, so we send through the Graph endpoint:
 *
 *     POST https://graph.microsoft.com/v1.0/me/sendMail
 *     Authorization: Bearer <delegated access token with Mail.Send>
 *
 * The access token comes from the cached sender-mailbox refresh token
 * (see microsoftAuth.service.ts). Node 18+/22 provides a global fetch.
 */
import { env } from '../config/env';
import { logger, logEvents } from '../utils/logger';
import { getMailAccessToken, isConnected } from './microsoftAuth.service';

const GRAPH_SENDMAIL_URL = 'https://graph.microsoft.com/v1.0/me/sendMail';

/** Quick startup check: is a Microsoft account connected and able to send? */
export async function verifyEmailReady(): Promise<boolean> {
  if (!(await isConnected())) {
    logger.warn(
      'No Microsoft account connected yet. Sign in via "Continue with Microsoft" ' +
        `(or ${env.backendUrl}/auth/microsoft) to connect a sending account.`
    );
    return false;
  }
  try {
    await getMailAccessToken();
    logger.info('Outlook (Microsoft Graph) mail transport ready');
    return true;
  } catch (err) {
    logger.error('Could not acquire a Graph token for the connected account', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// A specific, non-generic subject scores better than a bare "Welcome".
const SUBJECT = env.mail.subject;

function buildHtml(recipient: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1f2937;line-height:1.6">
    <h2 style="color:#0067b8;margin:0 0 16px">Welcome to ${env.mail.appName}</h2>
    <p>Hello,</p>
    <p>Your registration with <strong>${recipient}</strong> is confirmed. Thank you for signing in with your Microsoft account.</p>
    <p>If you have any questions, just reply to this email and we'll help you out.</p>
    <p style="margin-top:28px">Best regards,<br/>The ${env.mail.appName} Team</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 12px" />
    <p style="font-size:12px;color:#6b7280;margin:0">
      You're receiving this email because you signed in with your Microsoft
      account at ${env.mail.appName}. If this wasn't you, you can safely ignore it.
    </p>
  </div>`;
}

/**
 * Send the welcome email to a single recipient via Microsoft Graph.
 * Resolves on success (Graph returns 202 Accepted); throws on failure so the
 * caller can report "Failed" back to Apps Script.
 */
export async function sendEmail(
  email: string
): Promise<{ messageId: string; response: string }> {
  const accessToken = await getMailAccessToken();

  const payload = {
    message: {
      subject: SUBJECT,
      body: { contentType: 'HTML', content: buildHtml(email) },
      toRecipients: [{ emailAddress: { address: email } }],
    },
    saveToSentItems: true,
  };

  const res = await fetch(GRAPH_SENDMAIL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // sendMail returns 202 Accepted with an empty body on success.
  if (res.status === 202) {
    const messageId = res.headers.get('request-id') || 'accepted';
    logEvents.emailSend(email, messageId, 'HTTP 202 Accepted');
    return { messageId, response: 'HTTP 202 Accepted' };
  }

  const bodyText = await res.text().catch(() => '');
  throw new Error(`Graph sendMail failed: HTTP ${res.status} ${bodyText}`);
}
