import { config } from '../server/config.js';
import { createApp } from '../server/index.js';
import { createRepositories } from '../server/repositories/index.js';

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
