/**
 * Google service-account authentication for the Sheets API.
 *
 * This is the ONLY remaining use of Google auth in the backend — end-user
 * login now goes through Microsoft (see microsoftAuth.service.ts). The
 * service account reads/writes the "Email Automation" spreadsheet.
 */
import fs from 'fs';
import { google } from 'googleapis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  [k: string]: unknown;
}

let cachedKey: ServiceAccountKey | null = null;

/**
 * Load the service account credentials either from a base64 env var
 * (preferred on PaaS hosts) or from the JSON key file on disk.
 */
export function loadServiceAccountKey(): ServiceAccountKey {
  if (cachedKey) return cachedKey;

  if (env.sheets.serviceAccountKeyBase64) {
    const json = Buffer.from(
      env.sheets.serviceAccountKeyBase64,
      'base64'
    ).toString('utf-8');
    cachedKey = JSON.parse(json) as ServiceAccountKey;
    logger.info('Loaded service account from SERVICE_ACCOUNT_KEY_BASE64');
    return cachedKey;
  }

  if (!fs.existsSync(env.sheets.serviceAccountKeyPath)) {
    throw new Error(
      `Service account key not found at ${env.sheets.serviceAccountKeyPath}. ` +
        `Download it from Google Cloud (Step 2) or set SERVICE_ACCOUNT_KEY_BASE64.`
    );
  }

  const raw = fs.readFileSync(env.sheets.serviceAccountKeyPath, 'utf-8');
  cachedKey = JSON.parse(raw) as ServiceAccountKey;
  logger.info(`Loaded service account from ${env.sheets.serviceAccountKeyPath}`);
  return cachedKey;
}

/** A GoogleAuth instance scoped for read/write access to Sheets. */
export function createSheetsAuth() {
  const key = loadServiceAccountKey();
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: key.client_email,
      private_key: key.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

/** Convenience: the service account's email (for the "share the sheet" step). */
export function getServiceAccountEmail(): string {
  return loadServiceAccountKey().client_email;
}
