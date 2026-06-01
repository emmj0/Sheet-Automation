import { Router } from 'express';
import { sendEmailHandler } from '../controllers/email.controller';
import { requireApiKey } from '../middlewares/apiKey.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// POST /api/send-email  -> protected; called by Apps Script
router.post('/send-email', requireApiKey, asyncHandler(sendEmailHandler));

export default router;
