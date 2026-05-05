import express from 'express';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createApplicationsRouter } from './routes/applications.js';
import { createProfileRouter } from './routes/profile.js';

const PORT = 3001;

export function createApp({ db } = {}) {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/applications', createApplicationsRouter({ db }));
  app.use('/api/profile', createProfileRouter({ db }));

  app.use((err, _req, res, _next) => {
    if (err?.status === 400 && err?.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
        },
      });
    }

    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  });

  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Alice API server listening on http://localhost:${PORT}`);
  });
}
