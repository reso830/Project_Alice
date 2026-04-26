import { db, initSchema } from './db.js';

try {
  initSchema();
  db.close();
  console.log('Database initialized successfully');
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
