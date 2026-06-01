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
import {
  getMailAccessToken,
  isMailAuthorized,
} from './microsoftAuth.service';

const GRAPH_SENDMAIL_URL = 'https://graph.microsoft.com/v1.0/me/sendMail';

/** Quick startup check: is the sending mailbox authorized? */
export async function verifyEmailReady(): Promise<boolean> {
  if (!isMailAuthorized()) {
    logger.warn(
      'Sender mailbox NOT authorized yet. Visit ' +
        `${env.backendUrl}/auth/microsoft/mail-setup once while signed in as the sender outlook.com account.`
    );
    return false;
  }
  try {
    await getMailAccessToken();
    logger.info('Outlook (Microsoft Graph) mail transport ready', {
      sender: env.microsoft.mailSender || undefined,
    });
    return true;
  } catch (err) {
    logger.error('Could not acquire a Graph token for the sender mailbox', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

const SUBJECT = 'Welcome';

function buildHtml(): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1f2937">
    <h2 style="color:#0067b8">Welcome 🎉</h2>
    <p>Hello,</p>
    <p>Thank you for registering through Microsoft Sign-In.</p>
    <p>This email was automatically sent from our Email Automation System.</p>
    <p style="margin-top:32px">Regards,<br/>Support Team</p>
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
      body: { contentType: 'HTML', content: buildHtml() },
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
