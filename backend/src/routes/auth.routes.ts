import { Router } from 'express';
import {
  handleMicrosoftCallback,
  startMicrosoftLogin,
} from '../controllers/auth.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Microsoft connect/login (signing in IS the connection)
router.get('/microsoft', asyncHandler(startMicrosoftLogin));
router.get('/microsoft/callback', asyncHandler(handleMicrosoftCallback));

export default router;
