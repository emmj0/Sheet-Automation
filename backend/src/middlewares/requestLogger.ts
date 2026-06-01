/**
 * Logs every incoming API request (Step 10) and its response status/duration.
 */
import { NextFunction, Request, Response } from 'express';
import { logEvents, logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  logEvents.apiRequest(req.method, req.originalUrl, req.ip);

  res.on('finish', () => {
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}
