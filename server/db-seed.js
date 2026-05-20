import { pathToFileURL } from 'node:url';
import { db } from './db.js';
import { DEMO_RECORDS } from './seeds/applicationsData.js';

// Re-export so any caller of the legacy entry point (e.g. operator
// scripts or tests written before the data extraction) keeps working.
// The canonical, side-effect-free source is now
// `server/seeds/applicationsData.js`.
export { DEMO_RECORDS };

const COLUMNS = [
  'company_name', 'job_title', 'status', 'compat', 'fav',
  'salary', 'source_platform', 'job_posting_url', 'recruiter',
  'notes', 'responsibilities', 'skills',
  'application_date', 'last_status_update', 'created_at', 'updated_at', 'archived',
  'location', 'shift', 'work_setup', 'compat_notes', 'general_notes', 'preferred_skills',
];

export function seedApplications() {
  const cleared = db.prepare('DELETE FROM applications').run();
  console.log(`Cleared ${cleared.changes} existing record(s).`);

  const insert = db.prepare(`
    INSERT INTO applications (${COLUMNS.join(', ')})
    VALUES (${COLUMNS.map((c) => `@${c}`).join(', ')})
  `);

  const insertMany = db.transaction((records) => {
    for (const record of records) {
      insert.run(record);
    }
  });

  insertMany(DEMO_RECORDS);
  db.close();

  console.log(`Seeded ${DEMO_RECORDS.length} demo records.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    seedApplications();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
