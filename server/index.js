import express from 'express';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createRequireAuth } from './auth/middleware.js';
import { config } from './config.js';
import { assertHostedSchema } from './health.js';
import { createRepositories } from './repositories/index.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createProfileRouter } from './routes/profile.js';
import { createResumeRouter } from './routes/resume.js';

// NOTE: `./auth/seedHostedUser.js` is intentionally NOT statically imported
// here. That module statically imports `../repositories/supabase/client.js`,
// which statically imports `@supabase/supabase-js`. Loading the chain from
// the local-mode boot path would violate the lazy-import discipline (spec
// FR-018). The CLI boot block below dynamically imports it only in hosted
// mode; tests inject their own stub via `createApp({ seedHostedUserIfNeeded })`.

export function createApp({
  repositories,
  config: appConfig,
  requireAuth: explicitRequireAuth,
  seedHostedUserIfNeeded,
} = {}) {
  const app = express();
  const runtime = appConfig?.runtime ?? 'local';

  let requireAuth = explicitRequireAuth;
  if (!requireAuth && appConfig?.isHosted) {
    if (!appConfig.supabase?.url) {
      throw new Error(
        'createApp: hosted config requires supabase.url to build requireAuth (or pass an explicit requireAuth)',
      );
    }
    const jwksUri = `${appConfig.supabase.url.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
    requireAuth = createRequireAuth({ jwksUri });
  }

  // Normalize `null` → undefined so the router factories skip the mount.
  // `seedHostedUserIfNeeded` is otherwise passed through unchanged. The
  // CLI boot block constructs the real middleware for hosted mode via a
  // dynamic import; tests pass their own stub or omit it entirely.
  if (seedHostedUserIfNeeded === null) {
    seedHostedUserIfNeeded = undefined;
  }

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', runtime });
  });

  app.use(
    '/api/applications',
    createApplicationsRouter({
      repos: repositories,
      requireAuth,
      seedHostedUserIfNeeded,
    }),
  );
  app.use(
    '/api/profile',
    createProfileRouter({
      repos: repositories,
      requireAuth,
      seedHostedUserIfNeeded,
    }),
  );
  app.use(
    '/api/resume',
    createResumeRouter({ requireAuth, seedHostedUserIfNeeded }),
  );

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
  // Hosted-mode boot-time schema check (skipped in local + demo). Refuses
  // to serve until the 019 migration has been applied to the configured
  // Supabase project. See server/health.js + contracts/api.md §5.
  try {
    await assertHostedSchema(config);
  } catch (err) {
    console.error('[boot]', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Dynamically import the seed middleware only in hosted mode. This keeps
  // local-mode boot free of `@supabase/supabase-js` (the seed module's
  // transitive static dependency). Spec FR-018 / Phase 07 close-out.
  let seedHostedUserIfNeeded;
  if (config.isHosted) {
    ({ seedHostedUserIfNeeded } = await import('./auth/seedHostedUser.js'));
  }

  const repositories = await createRepositories(config);
  const app = createApp({ repositories, config, seedHostedUserIfNeeded });

  app.listen(config.port, () => logBoot(config));
}
