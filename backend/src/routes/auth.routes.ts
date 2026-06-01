import { Router } from 'express';
import {
  handleMailSetupCallback,
  handleMicrosoftCallback,
  startMailSetup,
  startMicrosoftLogin,
} from '../controllers/auth.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// End-user login
router.get('/microsoft', asyncHandler(startMicrosoftLogin));
router.get('/microsoft/callback', asyncHandler(handleMicrosoftCallback));

// One-time sender-mailbox authorization (admin)
router.get('/microsoft/mail-setup', asyncHandler(startMailSetup));
router.get('/microsoft/mail-callback', asyncHandler(handleMailSetupCallback));

export default router;
