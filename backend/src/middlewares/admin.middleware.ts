/**
 * Admin auth for /admin/* endpoints (status + disconnect).
 *
 * The frontend gate collects the admin password; it is sent on admin requests
 * as `x-admin-secret` and validated here against ADMIN_PASS (constant-time).
 *
 * NOTE: the admin credentials also live in the frontend bundle, so this is a
 * light gate — adequate for managing the connection in this project, not a
 * substitute for real auth on a sensitive multi-tenant system.
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

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const provided = req.get('x-admin-secret') || '';
  if (!provided || !safeEqual(provided, env.admin.pass)) {
    logger.warn('Rejected unauthorized admin request', {
      event: 'unauthorized_admin',
      ip: req.ip,
      path: req.originalUrl,
    });
    res.status(401).json({ success: false, error: 'Unauthorized', code: 'INVALID_ADMIN' });
    return;
  }
  next();
}
