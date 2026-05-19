// server/db.js is NOT imported at the top level; importing it triggers better-sqlite3
// and filesystem side effects that must not run in hosted/Vercel environments.
// SQLite repository adapters are also imported lazily because they import
// server/db/* modules, whose default arguments import server/db.js.
//
// The Supabase adapter modules in `./supabase/` are likewise imported lazily so
// local-mode and demo-mode boot never load `@supabase/supabase-js`.

export class DemoRepositoryNotImplementedError extends Error {
  constructor(repositoryName) {
    super(
      `Demo persistence is not yet implemented for: ${repositoryName}. ` +
        'See feature 020.',
    );
    this.name = 'DemoRepositoryNotImplementedError';
  }
}

function createDemoStub(name) {
  const notImplemented = () => {
    throw new DemoRepositoryNotImplementedError(name);
  };

  return {
    getAll: notImplemented,
    getById: notImplemented,
    create: notImplemented,
    update: notImplemented,
    archive: notImplemented,
    get: notImplemented,
    upsert: notImplemented,
  };
}

/**
 * Build the runtime-specific repository dispatcher.
 *
 * Returns a uniform `{ forRequest(req) }` shape across all three runtimes
 * (local, hosted, demo). Route handlers obtain their per-request bundle
 * via `req.repositories.forRequest(req)` and never branch on `config.runtime`.
 *
 * - Local: `forRequest` returns the long-lived SQLite bundle built once at
 *   dispatcher creation. `req` is ignored.
 * - Hosted: `forRequest` constructs a fresh Supabase client from the
 *   caller's JWT (`req.headers.authorization`) and returns RLS-scoped
 *   adapters keyed to `req.user.id`. Per-request; no caching.
 * - Demo: `forRequest` returns the long-lived demo stub. Every method
 *   throws `DemoRepositoryNotImplementedError`. `req` is ignored.
 *
 * @param {import('../config.js').config} config
 * @returns {Promise<{ forRequest: (req: import('express').Request) => { applications: object, profile: object } }>}
 */
export async function createRepositories(config) {
  if (config.isDemo) {
    const demo = {
      applications: createDemoStub('applications'),
      profile: createDemoStub('profile'),
    };
    return { forRequest: () => demo };
  }

  if (config.isHosted) {
    const [
      { createSupabaseClientForRequest },
      { createSupabaseApplicationsRepository },
      { createSupabaseProfileRepository },
    ] = await Promise.all([
      import('./supabase/client.js'),
      import('./supabase/applications.js'),
      import('./supabase/profile.js'),
    ]);

    return {
      forRequest(req) {
        const client = createSupabaseClientForRequest(req);
        const userId = req.user?.id;
        return {
          applications: createSupabaseApplicationsRepository(client, userId),
          profile: createSupabaseProfileRepository(client, userId),
        };
      },
    };
  }

  const { db, initSchema } = await import('../db.js');
  initSchema(db);
  const sqlite = await createTestRepositories(db);
  return { forRequest: () => sqlite };
}

/**
 * Low-level testing utility. Returns the flat `{ applications, profile }`
 * shape directly against an injected database, bypassing the dispatcher.
 * Used by unit tests that exercise the SQLite adapter contract directly.
 * For integration tests that drive `createApp`, wrap the result via
 * `tests/server/helpers.js#wrapAsDispatcher`.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {Promise<{ applications: object, profile: object }>}
 */
export async function createTestRepositories(db) {
  const [
    { createSqliteApplicationsRepository },
    { createSqliteProfileRepository },
  ] = await Promise.all([
    import('./applications.js'),
    import('./profile.js'),
  ]);

  return {
    applications: createSqliteApplicationsRepository(db),
    profile: createSqliteProfileRepository(db),
  };
}
