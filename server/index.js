import express from 'express';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createRequireAuth } from './auth/middleware.js';
import { config } from './config.js';
import { createRepositories } from './repositories/index.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createProfileRouter } from './routes/profile.js';
import { createResumeRouter } from './routes/resume.js';

export function createApp({ repositories, config: appConfig, requireAuth: explicitRequireAuth } = {}) {
  const app = express();
  const runtime = appConfig?.runtime ?? 'local';

  let requireAuth = explicitRequireAuth;
  if (!requireAuth && appConfig?.isHosted) {
    if (!appConfig.supabase?.jwtSecret) {
      throw new Error(
        'createApp: hosted config requires supabase.jwtSecret to build requireAuth (or pass an explicit requireAuth)',
      );
    }
    requireAuth = createRequireAuth({ jwtSecret: appConfig.supabase.jwtSecret });
  }

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', runtime });
  });

  app.use(
    '/api/applications',
    createApplicationsRouter({ repo: repositories.applications, requireAuth }),
  );
  app.use(
    '/api/profile',
    createProfileRouter({ repo: repositories.profile, requireAuth }),
  );
  app.use('/api/resume', createResumeRouter({ requireAuth }));

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

export function logBoot(runtimeConfig) {
  console.log(`[config] Runtime mode: ${runtimeConfig.runtime}`);
  console.log(`[runtime] mode=${runtimeConfig.runtime} port=${runtimeConfig.port}`);
  console.log(`Alice API server listening on http://localhost:${runtimeConfig.port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repositories = await createRepositories(config);
  const app = createApp({ repositories, config });

  app.listen(config.port, () => logBoot(config));
}
