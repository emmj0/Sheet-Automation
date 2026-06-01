import { Router } from 'express';
import authRoutes from './auth.routes';
import emailRoutes from './email.routes';
import adminRoutes from './admin.routes';

const router = Router();

// Health check (handy for uptime monitors and deployment platforms).
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Browser-facing OAuth routes:   /auth/google, /auth/google/callback
router.use('/auth', authRoutes);

// Machine-facing protected API:   /api/send-email
router.use('/api', emailRoutes);

// Admin connection management:    /admin/status, /admin/disconnect
router.use('/admin', adminRoutes);

export default router;
