// server/db.js is NOT imported at the top level; importing it triggers better-sqlite3
// and filesystem side effects that must not run in hosted/Vercel environments.
// SQLite repository adapters are also imported lazily because they import
// server/db/* modules, whose default arguments import server/db.js.

export class HostedRepositoryNotImplementedError extends Error {
  constructor(repositoryName) {
    super(
      `Hosted persistence is not yet implemented for: ${repositoryName}. ` +
        'See feature 019-supabase-persistence.',
    );
    this.name = 'HostedRepositoryNotImplementedError';
  }
}

function createHostedStub(name) {
  const notImplemented = () => {
    throw new HostedRepositoryNotImplementedError(name);
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
 * @param {import('../config.js').config} config
 * @returns {Promise<{ applications: import('./applications.js').ApplicationsRepository,
 *                     profile: import('./profile.js').ProfileRepository }>}
 */
export async function createRepositories(config) {
  if (config.isHosted) {
    return {
      applications: createHostedStub('applications'),
      profile: createHostedStub('profile'),
    };
  }

  const { db, initSchema } = await import('../db.js');
  initSchema(db);

  return createTestRepositories(db);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {{ applications: import('./applications.js').ApplicationsRepository,
 *             profile: import('./profile.js').ProfileRepository }}
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
