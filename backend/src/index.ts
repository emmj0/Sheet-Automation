/**
 * Server bootstrap.
 *
 * Order matters: load & validate env first (config/env throws on missing
 * vars), surface the Google service account + Outlook mail readiness, then
 * start listening.
 */
import { env } from './config/env';
import { createApp } from './app';
import { logger } from './utils/logger';
import { verifyEmailReady } from './services/email.service';
import { getServiceAccountEmail } from './services/googleSheetsAuth.service';

async function main(): Promise<void> {
  const app = createApp();

  // Surface configuration problems at boot rather than on first request.
  try {
    const sa = getServiceAccountEmail();
    logger.info('Service account loaded', { serviceAccount: sa });
    logger.info(`Reminder: the Google Sheet must be shared (Editor) with ${sa}`);
  } catch (err) {
    logger.error('Could not load the service account key', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await verifyEmailReady();

  app.listen(env.port, () => {
    logger.info(`Backend listening on ${env.backendUrl} (port ${env.port})`);
    logger.info(`Login start:     ${env.backendUrl}/auth/microsoft`);
    logger.info(`Login callback:  ${env.microsoft.loginRedirectUri}`);
    logger.info(`Mail setup (1x): ${env.backendUrl}/auth/microsoft/mail-setup`);
    logger.info(`Send email API:  ${env.backendUrl}/api/send-email`);
  });
}

// Fail loudly on unexpected async errors.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

main().catch((err) => {
  logger.error('Fatal startup error', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
