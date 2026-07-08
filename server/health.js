import process from 'node:process';

import { APP_VERSION } from '../src/pages/welcome/shared/appMeta.js';

// PostgREST error codes that mean "migration not applied":
const UNDEFINED_COLUMN = '42703';
const UNDEFINED_TABLE = '42P01';

const PROBES = [
  { table: 'applications', column: 'user_id', failOn: [UNDEFINED_TABLE, UNDEFINED_COLUMN] },
  { table: 'profile', column: 'user_id', failOn: [UNDEFINED_TABLE, UNDEFINED_COLUMN] },
  // user_id is the PK on user_seed_state — present iff the table is.
  // Only the table-missing case warrants a hard fail.
  { table: 'user_seed_state', column: 'user_id', failOn: [UNDEFINED_TABLE] },
  {
    table: 'applications',
    column: 'timeline',
    failOn: [UNDEFINED_COLUMN],
    docPath: 'specs/025-application-timeline/quickstart.md §3.1',
  },
  {
    table: 'applications',
    column: 'archived_date',
    failOn: [UNDEFINED_COLUMN],
    docPath: 'specs/028-archive-applications-view/data-model.md §1.3',
  },
  {
    table: 'profile_skill',
    column: 'user_id',
    failOn: [UNDEFINED_TABLE, UNDEFINED_COLUMN],
    docPath: 'specs/032-profile-schema-refactor/data-model.md §3',
  },
  {
    table: 'applications',
    column: 'min_years_experience',
    failOn: [UNDEFINED_COLUMN],
    docPath: 'specs/036-compatibility-engine/data-model.md §1',
  },
  {
    table: 'applications',
    column: 'compat_analysis',
    failOn: [UNDEFINED_COLUMN],
    docPath: 'specs/037-compatibility-insights-panel/data-model.md §1',
  },
  {
    table: 'applications',
    column: 'compat_scored_at',
    failOn: [UNDEFINED_COLUMN],
    docPath: 'specs/037-compatibility-insights-panel/data-model.md §2',
  },
];

// Self-update is only safe when Alice runs through the portable launcher loop
// (`Start-Alice.cmd`) on Windows, because that script owns the stop → swap →
// relaunch flow. A plain `node app/server/portable.js` boot on Windows is local
// + win32 too, but has no swap path — advertising the updater there lets a user
// stage a download and click "restart" into a server that never comes back.
// The launcher passes a CLI marker to `server/portable.js`, which injects
// `portableRuntime:true` into `createApp`; all other boot paths omit it.
export function isPortableUpdateRuntime(runtime, { portableRuntime = false } = {}) {
  return (
    portableRuntime
    && runtime === 'local'
    && process.platform === 'win32'
  );
}

export function createHealthPayload(runtime, { portableRuntime = false, portable = false } = {}) {
  return {
    status: 'ok',
    runtime,
    version: APP_VERSION,
    updateSupported: isPortableUpdateRuntime(runtime, { portableRuntime }),
    portable: portable || portableRuntime,
  };
}

function migrationHint(table, column, docPath) {
  const artifact = column ? `${table}.${column}` : table;
  if (docPath) {
    return (
      `[hosted-schema] missing artifact: public.${artifact}. ` +
      'The migration has not been applied to the configured Supabase ' +
      `project. Apply the SQL block from ${docPath}.`
    );
  }
  return (
    `[hosted-schema] missing artifact: public.${artifact}. ` +
    'The 019 migration has not been applied to the configured Supabase ' +
    'project. Apply the SQL block from ' +
    'specs/019-supabase-persistence/data-model.md §5 via Supabase ' +
    'dashboard → SQL Editor, then restart the server.'
  );
}

/**
 * Boot-time schema check for hosted mode. Verifies that the 019 migration
 * (see `specs/019-supabase-persistence/data-model.md §5`) plus subsequent
 * additive column migrations from features 025 (`applications.timeline`)
 * and 028 (`applications.archived_date`) have been applied to the
 * configured Supabase project by issuing sentinel PostgREST probes —
 * `SELECT <column> FROM <t> LIMIT 0` against `applications`, `profile`,
 * `user_seed_state`, `applications.timeline`, and
 * `applications.archived_date`.
 *
 * Behavior:
 *   - `!config.isHosted` → early return, no network call.
 *   - PostgREST error code `42703` / `42P01` → throws a descriptive Error
 *     naming the missing column or table. Caller is expected to exit
 *     non-zero so deployment orchestrators detect the problem.
 *   - HTTP 200 (any payload, including empty array from RLS) → probe
 *     passes.
 *   - Other errors (network, 5xx, transient PostgREST) → logged at
 *     warning level and boot continues. The next real request will
 *     surface the connectivity problem.
 *
 * The Supabase client is lazy-imported so local-mode boot does not pull
 * `@supabase/supabase-js` into the Node module registry.
 *
 * @param {{ isHosted: boolean, supabase?: { url: string, anonKey: string } }} config
 * @param {{ logger?: Pick<Console, 'info' | 'warn'> }} [options]
 * @returns {Promise<void>}
 */
export async function assertHostedSchema(config, { logger = console } = {}) {
  if (!config?.isHosted) {
    return;
  }

  // Explicit escape hatch for the cold-start subprocess test in
  // `tests/server/repositories/stubs.test.js`, which boots `api/index.js`
  // with `APP_RUNTIME=hosted` against an unreachable
  // `https://example.supabase.co`. Without this gate the test would make
  // three real PostgREST round-trips per run, slowing it from ~1s to
  // ~30s. Production hosted deploys MUST NOT set this — the default
  // behavior is "always run the probe."
  if (process.env.SKIP_HOSTED_SCHEMA_CHECK === 'true') {
    logger.warn(
      '[hosted-schema] SKIP_HOSTED_SCHEMA_CHECK=true — boot-time probe skipped (test-only escape hatch; production deploys MUST NOT set this)',
    );
    return;
  }

  const url = config.supabase?.url;
  const anonKey = config.supabase?.anonKey;
  if (!url || !anonKey) {
    throw new Error(
      '[hosted-schema] config.supabase.url and config.supabase.anonKey are required in hosted mode',
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const probe of PROBES) {
    const { error } = await client
      .from(probe.table)
      .select(probe.column)
      .limit(0);

    if (!error) continue;

    if (probe.failOn.includes(error.code)) {
      const missing = error.code === UNDEFINED_TABLE ? null : probe.column;
      throw new Error(migrationHint(probe.table, missing, probe.docPath));
    }

    logger.warn(
      `[hosted-schema] probe error on public.${probe.table} (continuing): ${error.message ?? error.code ?? String(error)}`,
    );
  }

  logger.info('[hosted-schema] all probes passed');
}
