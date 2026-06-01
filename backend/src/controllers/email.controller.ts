/**
 * Email controller (Step 5 + Step 8).
 *
 *  POST /api/send-email   (protected by API key; called by Apps Script)
 *  Body: { "email": "user@outlook.com", "rowNumber": 5 }
 *
 * Apps Script owns the Status column in the sheet (it sets Processing before
 * calling and Done/Failed after). The backend just sends the mail and reports
 * success/failure in the JSON response.
 */
import { Request, Response } from 'express';
import { logEvents } from '../utils/logger';
import { sendEmail } from '../services/email.service';
import { AppError } from '../middlewares/errorHandler';
import type { SendEmailRequest } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendEmailHandler(req: Request, res: Response): Promise<void> {
  const { email, rowNumber } = (req.body ?? {}) as SendEmailRequest;

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    throw new AppError('A valid "email" field is required.', 400, 'INVALID_EMAIL');
  }

  try {
    const { messageId } = await sendEmail(email.trim());
    res.json({
      success: true,
      email: email.trim(),
      rowNumber: rowNumber ?? null,
      messageId,
    });
  } catch (err) {
    logEvents.emailFailed(email, err);
    // 502: the upstream (Microsoft Graph) failed, not the request itself.
    throw new AppError(
      `Failed to send email: ${err instanceof Error ? err.message : String(err)}`,
      502,
      'MAIL_SEND_FAILURE'
    );
  }
}
