/**
 * Centralised logging (Step 10).
 *
 * Logs to the console (human-friendly, coloured) and to rotating-ish files
 * under ./logs:
 *   - logs/combined.log : everything
 *   - logs/error.log    : errors only
 *
 * Use the `logger` for free-form messages and the helper functions for the
 * structured events the spec calls out (logins, registrations, API requests,
 * email sends, SMTP responses, errors).
 */
import fs from 'fs';
import path from 'path';
import winston from 'winston';

const logDir = path.resolve('logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaKeys = Object.keys(meta).filter((k) => k !== 'service');
    const metaStr = metaKeys.length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${stack || message}${metaStr}`;
  })
);

const fileFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'email-automation' },
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

/* ── Structured event helpers ─────────────────────────────────────────── */

export const logEvents = {
  oauthLogin(email: string) {
    logger.info('OAuth login', { event: 'oauth_login', email });
  },
  userRegistered(email: string, rowNumber: number, created: boolean) {
    logger.info(created ? 'User registered' : 'User already registered', {
      event: created ? 'user_registered' : 'user_duplicate',
      email,
      rowNumber,
    });
  },
  apiRequest(method: string, url: string, ip?: string) {
    logger.info('API request', { event: 'api_request', method, url, ip });
  },
  emailSend(email: string, messageId: string, response?: string) {
    logger.info('Email sent', {
      event: 'email_send',
      email,
      messageId,
      mailResponse: response,
    });
  },
  emailFailed(email: string, error: unknown) {
    logger.error('Email send failed', {
      event: 'email_failed',
      email,
      error: error instanceof Error ? error.message : String(error),
    });
  },
};
