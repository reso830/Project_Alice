import { pathToFileURL } from 'node:url';
import { db } from './db.js';
import { DEMO_RECORDS } from './seeds/applicationsData.js';

// Re-export so any caller of the legacy entry point (e.g. operator
// scripts or tests written before the data extraction) keeps working.
// The canonical, side-effect-free source is now
// `server/seeds/applicationsData.js`.
export { DEMO_RECORDS };

// `compat` is intentionally NOT seeded — it is server-authoritative (036) and
// recomputed by `db:seed:profile` against the seeded profile. Newly inserted
// rows take the column default (0) until then. `min_years_experience` IS seeded
// so the experience category participates once a profile exists.
const COLUMNS = [
  'company_name', 'job_title', 'status', 'fav',
  'salary', 'source_platform', 'job_posting_url', 'recruiter',
  'notes', 'responsibilities', 'skills',
  'application_date', 'last_status_update', 'created_at', 'updated_at', 'archived',
  'location', 'shift', 'work_setup', 'compat_notes', 'general_notes', 'preferred_skills',
  'min_years_experience', 'timeline',
];

export function seedApplications(targetDb = db) {
  const cleared = targetDb.prepare('DELETE FROM applications').run();
  console.log(`Cleared ${cleared.changes} existing record(s).`);

  const insert = targetDb.prepare(`
    INSERT INTO applications (${COLUMNS.join(', ')})
    VALUES (${COLUMNS.map((c) => `@${c}`).join(', ')})
  `);

  const insertMany = targetDb.transaction((records) => {
    for (const record of records) {
      insert.run(record);
    }
  });

  insertMany(DEMO_RECORDS);

  console.log(`Seeded ${DEMO_RECORDS.length} demo records.`);
  return DEMO_RECORDS.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    seedApplications();
    db.close();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
