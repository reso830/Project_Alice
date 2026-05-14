import express from 'express';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { createRepositories } from './repositories/index.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createProfileRouter } from './routes/profile.js';
import { createResumeRouter } from './routes/resume.js';

export function createApp({ repositories }) {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/applications', createApplicationsRouter({ repo: repositories.applications }));
  app.use('/api/profile', createProfileRouter({ repo: repositories.profile }));
  app.use('/api/resume', createResumeRouter());

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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repositories = await createRepositories(config);
  const app = createApp({ repositories });

  app.listen(config.port, () => {
    console.log(`[config] Runtime mode: ${config.runtime}`);
    console.log(`Alice API server listening on http://localhost:${config.port}`);
  });
}
