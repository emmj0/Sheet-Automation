/**
 * Google Sheets service (Step 5).
 *
 * Reusable wrapper around the Sheets API exposing the functions the spec
 * requires: addUser, findUserByEmail, updateStatus, getRow, appendRow.
 *
 * Sheet layout (1-based, row 1 = header):
 *   A: Send Email (checkbox  TRUE/FALSE)
 *   B: Email Address
 *   C: Status (Pending | Processing | Done | Failed)
 */
import { google, sheets_v4 } from 'googleapis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { createSheetsAuth } from './googleSheetsAuth.service';
import type { EmailStatus, RegistrationResult, SheetRow } from '../types';

const HEADER_ROW = 1; // data starts at row 2
const COLUMN_RANGE = 'A:C';

let client: sheets_v4.Sheets | null = null;

/** Lazily create (and cache) the authenticated Sheets client. */
function getClient(): sheets_v4.Sheets {
  if (!client) {
    client = google.sheets({ version: 'v4', auth: createSheetsAuth() });
  }
  return client;
}

/** Full A1 range for the data columns of the configured tab. */
function range(a1: string): string {
  return `${env.sheets.sheetName}!${a1}`;
}

function toStatus(value: string | undefined): EmailStatus {
  const v = (value || '').trim();
  if (v === 'Processing' || v === 'Done' || v === 'Failed') return v;
  return 'Pending';
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return String(value).trim().toUpperCase() === 'TRUE';
}

/* ── Reads ────────────────────────────────────────────────────────────── */

/** Read every data row (skips the header). */
export async function getRows(): Promise<SheetRow[]> {
  const res = await getClient().spreadsheets.values.get({
    spreadsheetId: env.sheets.spreadsheetId,
    range: range(COLUMN_RANGE),
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const values = res.data.values ?? [];
  const rows: SheetRow[] = [];

  // values[0] is the header row.
  for (let i = HEADER_ROW; i < values.length; i++) {
    const [a, b, c] = values[i] ?? [];
    if (b === undefined || b === null || String(b).trim() === '') continue;
    rows.push({
      rowNumber: i + 1, // convert 0-based index to 1-based sheet row
      sendEmail: toBool(a),
      email: String(b).trim().toLowerCase(),
      status: toStatus(c as string),
    });
  }
  return rows;
}

/** Read a single row by its 1-based sheet row number. */
export async function getRow(rowNumber: number): Promise<SheetRow | null> {
  const res = await getClient().spreadsheets.values.get({
    spreadsheetId: env.sheets.spreadsheetId,
    range: range(`A${rowNumber}:C${rowNumber}`),
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const row = res.data.values?.[0];
  if (!row || !row[1]) return null;
  return {
    rowNumber,
    sendEmail: toBool(row[0]),
    email: String(row[1]).trim().toLowerCase(),
    status: toStatus(row[2] as string),
  };
}

/** Find a user by (case-insensitive) email. Returns null when not found. */
export async function findUserByEmail(email: string): Promise<SheetRow | null> {
  const target = email.trim().toLowerCase();
  const rows = await getRows();
  return rows.find((r) => r.email === target) ?? null;
}

/* ── Writes ───────────────────────────────────────────────────────────── */

/** Append a raw [A, B, C] row to the bottom of the sheet. */
export async function appendRow(
  sendEmail: boolean,
  email: string,
  status: EmailStatus
): Promise<number> {
  const res = await getClient().spreadsheets.values.append({
    spreadsheetId: env.sheets.spreadsheetId,
    range: range(COLUMN_RANGE),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[sendEmail, email, status]] },
  });

  // updatedRange looks like "Sheet1!A7:C7" — pull the row number out.
  const updatedRange = res.data.updates?.updatedRange ?? '';
  const match = updatedRange.match(/![A-Z]+(\d+):/);
  return match ? parseInt(match[1], 10) : -1;
}

/** Update only the Status (column C) of a given row. */
export async function updateStatus(
  rowNumber: number,
  status: EmailStatus
): Promise<void> {
  await getClient().spreadsheets.values.update({
    spreadsheetId: env.sheets.spreadsheetId,
    range: range(`C${rowNumber}`),
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] },
  });
  logger.info('Sheet status updated', { rowNumber, status });
}

/**
 * Register a user coming back from Google OAuth (Step 5 + duplicate logic).
 *  - If the email already exists, return { created: false }.
 *  - Otherwise append [FALSE, email, "Pending"] and return { created: true }.
 */
export async function addUser(email: string): Promise<RegistrationResult> {
  const normalized = email.trim().toLowerCase();

  const existing = await findUserByEmail(normalized);
  if (existing) {
    return { created: false, email: normalized, rowNumber: existing.rowNumber };
  }

  const rowNumber = await appendRow(false, normalized, 'Pending');
  logger.info('New user appended to sheet', { email: normalized, rowNumber });
  return { created: true, email: normalized, rowNumber };
}
