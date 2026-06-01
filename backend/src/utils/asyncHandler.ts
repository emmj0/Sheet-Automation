/**
 * Wraps an async Express handler so thrown errors / rejected promises are
 * forwarded to the error-handling middleware instead of crashing the process.
 */
import { NextFunction, Request, RequestHandler, Response } from 'express';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
