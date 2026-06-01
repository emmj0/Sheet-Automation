/**
 * API key middleware (Step 7).
 *
 * Protects the /api/* routes that Apps Script calls. The script must send:
 *     Authorization: Bearer <API_KEY>
 * (an `x-api-key: <API_KEY>` header is also accepted as a fallback).
 *
 * Uses a constant-time comparison to avoid leaking the key via timing.
 */
import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const provided = bearer || req.get('x-api-key') || '';

  if (!provided || !safeEqual(provided, env.apiKey)) {
    logger.warn('Rejected unauthorized API request', {
      event: 'unauthorized',
      ip: req.ip,
      path: req.originalUrl,
    });
    res.status(401).json({ success: false, error: 'Unauthorized', code: 'INVALID_API_KEY' });
    return;
  }

  next();
}
