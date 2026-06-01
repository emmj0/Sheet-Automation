import { Router } from 'express';
import { getStatus, postDisconnect } from '../controllers/admin.controller';
import { requireAdmin } from '../middlewares/admin.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/status', requireAdmin, asyncHandler(getStatus));
router.post('/disconnect', requireAdmin, asyncHandler(postDisconnect));

export default router;
