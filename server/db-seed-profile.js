import { pathToFileURL } from 'node:url';
import { initSchema } from './db.js';
import { saveProfile } from './db/profile.js';
import { DEMO_PROFILE } from './seeds/profileData.js';

// Re-export so any caller of the legacy entry point keeps working. The
// canonical, side-effect-free source is now `server/seeds/profileData.js`.
export { DEMO_PROFILE };

// CLI-only side effects: `initSchema()` opens the SQLite DB, `saveProfile()`
// writes to it, and `process.exit()` terminates the host. These ran at
// module load before Phase 02, which made the file unsafe to import from
// tests (it would either kill the test process or corrupt the dev DB).
// Now they only fire when the file is executed as a script.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  initSchema();

  try {
    const saved = saveProfile(DEMO_PROFILE);
    console.log('Profile seeded successfully.');
    console.log(`  Name  : ${saved.firstName} ${saved.lastName}`);
    console.log(`  City  : ${saved.city}`);
    console.log(`  Email : ${saved.email}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed profile:', error.message);
    process.exit(1);
  }
}
