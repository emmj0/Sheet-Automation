/**
 * Admin controller — manage the Microsoft connection.
 *
 *   GET  /admin/status      -> { connected, email, connectedAt }
 *   POST /admin/disconnect  -> remove the stored Microsoft token/connection
 *
 * Both are protected by requireAdmin.
 */
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  disconnect,
  getConnectionStatus,
} from '../services/microsoftAuth.service';

export async function getStatus(_req: Request, res: Response): Promise<void> {
  const status = await getConnectionStatus();
  res.json({ success: true, ...status });
}

export async function postDisconnect(_req: Request, res: Response): Promise<void> {
  await disconnect();
  logger.info('Microsoft connection disconnected via admin');
  res.json({ success: true, connected: false, email: null, connectedAt: null });
}
