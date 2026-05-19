import { config } from '../server/config.js';
import { assertHostedSchema } from '../server/health.js';
import { createApp } from '../server/index.js';
import { createRepositories } from '../server/repositories/index.js';

// Hosted-mode boot-time schema check (FR-021). Mirrors the CLI boot block
// in `server/index.js` — Vercel turns an uncaught throw at module load
// into a function-init failure with a clear error log, equivalent to
// `process.exit(1)` in CLI mode. Without this, a hosted deploy against
// a Supabase project missing the 019 migration would start serving and
// fail at first request with a less informative PostgREST error.
//
// `assertHostedSchema` early-returns in local + demo modes, so this is
// a no-op outside hosted runtime. The cold-start subprocess test in
// `tests/server/repositories/stubs.test.js` sets
// `SKIP_HOSTED_SCHEMA_CHECK=true` to bypass the real network round-trips.
try {
  await assertHostedSchema(config);
} catch (err) {
  console.error('[boot]', err instanceof Error ? err.message : err);
  throw err;
}

// Lazy-import the seed middleware only when hosted, matching the discipline
// in `server/index.js`'s CLI boot block. This keeps the local-mode subprocess
// cold-start regression guard (tests/server/repositories/stubs.test.js)
// green — local boot never pulls `@supabase/supabase-js` into the module
// cache via the seed module's static dependency chain.
let seedHostedUserIfNeeded;
if (config.isHosted) {
  ({ seedHostedUserIfNeeded } = await import('../server/auth/seedHostedUser.js'));
}

const repositories = await createRepositories(config);

export default createApp({
  repositories,
  config,
  seedHostedUserIfNeeded,
});
