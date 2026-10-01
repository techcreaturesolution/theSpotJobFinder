import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { requireAdmin, requireAuth, requireEmployer, requireMaster } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import adminRoutes from './routes/admin.js';
import admobRoutes from './routes/admob.js';
import adsenseRoutes, { adsTxt } from './routes/adsense.js';
import authRoutes from './routes/auth.js';
import employerRoutes from './routes/employer.js';
import jobRoutes from './routes/jobs.js';
import masterRoutes from './routes/master.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, contentSecurityPolicy: false }));
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/ads.txt', adsTxt);
  app.use('/api/auth', authRoutes);
  app.use('/api/adsense', adsenseRoutes);
  app.use('/api/admob', admobRoutes);
  app.use('/api/jobs', requireAuth, jobRoutes);
  app.use('/api/employer', requireAuth, requireEmployer, employerRoutes);
  app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
  app.use('/api/master', requireAuth, requireMaster, masterRoutes);
  app.use('/api', notFound);

  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  const clientPublic = path.resolve(clientDist, '../public');
  app.get('/demo-video-ad.mp4', (_req, res) => res.sendFile(path.join(clientPublic, 'demo-video-ad.mp4')));
  if (env.nodeEnv === 'production') {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
