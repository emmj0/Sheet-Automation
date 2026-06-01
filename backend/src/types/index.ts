/**
 * Shared application types.
 */

/** A single row of the "Email Automation" sheet. */
export interface SheetRow {
  /** 1-based row number in the spreadsheet (row 1 is the header). */
  rowNumber: number;
  /** Column A - the "Send Email" checkbox. */
  sendEmail: boolean;
  /** Column B - the user's email address. */
  email: string;
  /** Column C - the status. */
  status: EmailStatus;
}

export type EmailStatus = 'Pending' | 'Processing' | 'Done' | 'Failed';

/** Result of trying to register a user that came back from Google OAuth. */
export interface RegistrationResult {
  /** true when a brand new row was created, false when the email already existed. */
  created: boolean;
  email: string;
  rowNumber: number;
}

/** The profile we read from Microsoft after a successful OAuth exchange. */
export interface UserProfile {
  email: string;
  name?: string;
}

/** Body of POST /api/send-email (sent by Apps Script). */
export interface SendEmailRequest {
  email: string;
  rowNumber?: number;
}

/** Standard JSON error shape returned by the API. */
export interface ApiErrorBody {
  success: false;
  error: string;
  code?: string;
}
