/**
 * Centralised error handling (Step 11).
 *
 * - AppError lets controllers/services throw HTTP-aware errors.
 * - notFoundHandler returns a JSON 404 for unknown routes.
 * - errorHandler is the final Express error middleware (must keep 4 args).
 */
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const message =
    err instanceof Error ? err.message : 'An unexpected error occurred';

  logger.error('Unhandled error', {
    path: req.originalUrl,
    method: req.method,
    statusCode,
    code,
    error: message,
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(statusCode).json({ success: false, error: message, code });
}
