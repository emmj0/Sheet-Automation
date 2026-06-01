/**
 * Durable token store — NO database.
 *
 * Persists the Microsoft connection (MSAL token cache + the connected account)
 * inside a HIDDEN tab ("_system") of the same Google Sheet, via the service
 * account. This survives Render redeploys / instance recycles (unlike the
 * ephemeral local filesystem), so the connection no longer needs re-authorizing
 * after every deploy.
 *
 * Layout of the "_system" tab:
 *   A1 = encrypted MSAL token cache blob
 *   A2 = encrypted JSON of the connected account { homeAccountId, username, connectedAt }
 *
 * Both values are AES-256-GCM encrypted (key derived from TOKEN_ENC_KEY, which
 * defaults to API_KEY) so a refresh token is never sitting in plaintext in the
 * spreadsheet.
 */
import crypto from 'crypto';
import { google, sheets_v4 } from 'googleapis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { createSheetsAuth } from './googleSheetsAuth.service';

export interface ConnectedAccount {
  homeAccountId: string;
  username: string;
  connectedAt: string;
}

const SYSTEM_SHEET = env.sheets.systemSheetName;

let client: sheets_v4.Sheets | null = null;
let sheetEnsured = false;

// In-memory mirror so MSAL's frequent cache reads don't hit the Sheets API every time.
let memCacheBlob: string | null = null;
let memAccount: ConnectedAccount | null = null;
let loaded = false;

function getClient(): sheets_v4.Sheets {
  if (!client) client = google.sheets({ version: 'v4', auth: createSheetsAuth() });
  return client;
}

/* ── encryption ───────────────────────────────────────────────────────── */

function key(): Buffer {
  return crypto.createHash('sha256').update(env.tokenEncKey).digest();
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/* ── sheet plumbing ───────────────────────────────────────────────────── */

/** Create the hidden "_system" tab if it doesn't exist yet. */
async function ensureSheet(): Promise<void> {
  if (sheetEnsured) return;
  const meta = await getClient().spreadsheets.get({
    spreadsheetId: env.sheets.spreadsheetId,
  });
  const exists = meta.data.sheets?.some(
    (s) => s.properties?.title === SYSTEM_SHEET
  );
  if (!exists) {
    await getClient().spreadsheets.batchUpdate({
      spreadsheetId: env.sheets.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: SYSTEM_SHEET,
                hidden: true,
                gridProperties: { rowCount: 10, columnCount: 2 },
              },
            },
          },
        ],
      },
    });
    logger.info(`Created hidden token tab "${SYSTEM_SHEET}"`);
  }
  sheetEnsured = true;
}

/** Load A1 (cache) + A2 (account) into memory once. */
async function load(): Promise<void> {
  if (loaded) return;
  await ensureSheet();
  const res = await getClient().spreadsheets.values.get({
    spreadsheetId: env.sheets.spreadsheetId,
    range: `${SYSTEM_SHEET}!A1:A2`,
  });
  const vals = res.data.values ?? [];
  const rawCache = vals[0]?.[0];
  const rawAccount = vals[1]?.[0];
  try {
    memCacheBlob = rawCache ? decrypt(String(rawCache)) : null;
    memAccount = rawAccount ? (JSON.parse(decrypt(String(rawAccount))) as ConnectedAccount) : null;
  } catch (err) {
    // Wrong key or corrupt data — treat as not connected rather than crashing.
    logger.error('Failed to decrypt token store (treating as disconnected)', {
      error: err instanceof Error ? err.message : String(err),
    });
    memCacheBlob = null;
    memAccount = null;
  }
  loaded = true;
}

async function writeCell(a1: string, value: string): Promise<void> {
  await ensureSheet();
  await getClient().spreadsheets.values.update({
    spreadsheetId: env.sheets.spreadsheetId,
    range: `${SYSTEM_SHEET}!${a1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] },
  });
}

/* ── public API (used by MSAL cache plugin + auth service) ────────────── */

export async function getCacheBlob(): Promise<string | null> {
  await load();
  return memCacheBlob;
}

export async function setCacheBlob(blob: string): Promise<void> {
  memCacheBlob = blob;
  loaded = true;
  await writeCell('A1', encrypt(blob));
}

export async function getAccount(): Promise<ConnectedAccount | null> {
  await load();
  return memAccount;
}

export async function setAccount(account: ConnectedAccount): Promise<void> {
  memAccount = account;
  loaded = true;
  await writeCell('A2', encrypt(JSON.stringify(account)));
}

/** Remove the stored connection (cache + account). */
export async function clear(): Promise<void> {
  await ensureSheet();
  await getClient().spreadsheets.values.clear({
    spreadsheetId: env.sheets.spreadsheetId,
    range: `${SYSTEM_SHEET}!A1:A2`,
  });
  memCacheBlob = null;
  memAccount = null;
  loaded = true;
  logger.info('Token store cleared (Microsoft disconnected)');
}
