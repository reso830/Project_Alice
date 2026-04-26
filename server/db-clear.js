import { db } from './db.js';

try {
  const result = db.prepare('DELETE FROM applications').run();
  db.close();

  console.log(`Cleared ${result.changes} record(s). Database is now empty.`);
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
