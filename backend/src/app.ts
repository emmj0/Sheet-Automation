/**
 * Express application wiring (kept separate from the server bootstrap in
 * index.ts so it can be imported by tests).
 */
import cors from 'cors';
import express, { Application } from 'express';
import { env } from './config/env';
import routes from './routes';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

export function createApp(): Application {
  const app = express();

  // Behind a reverse proxy (nginx / Railway / Render) so req.ip is correct.
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use('/', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
