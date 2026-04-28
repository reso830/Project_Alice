import { db } from './db.js';

try {
  const result = db.prepare('DELETE FROM profile').run();
  console.log(result.changes > 0 ? 'Profile cleared.' : 'No profile to clear.');
  process.exit(0);
} catch (error) {
  console.error('Failed to clear profile:', error.message);
  process.exit(1);
}
