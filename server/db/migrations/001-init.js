export const migration = {
  id: '001-init',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name        TEXT    NOT NULL,
        job_title           TEXT    NOT NULL,
        status              TEXT    NOT NULL DEFAULT 'wishlisted',
        compat              INTEGER NOT NULL DEFAULT 0,
        fav                 INTEGER NOT NULL DEFAULT 0,
        source_platform     TEXT,
        application_date    TEXT,
        job_posting_url     TEXT,
        recruiter           TEXT,
        notes               TEXT,
        salary              TEXT,
        responsibilities    TEXT,
        skills              TEXT,
        follow_up_action    TEXT,
        follow_up_date      TEXT,
        last_status_update  TEXT    NOT NULL,
        created_at          TEXT    NOT NULL,
        updated_at          TEXT    NOT NULL,
        archived            INTEGER NOT NULL DEFAULT 0,
        metadata            TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_applications_status
        ON applications(status);
      CREATE INDEX IF NOT EXISTS idx_applications_archived
        ON applications(archived);
      CREATE INDEX IF NOT EXISTS idx_applications_created
        ON applications(created_at);

      CREATE TABLE IF NOT EXISTS profile (
        id          INTEGER PRIMARY KEY CHECK (id = 1),
        data        TEXT    NOT NULL,
        updated_at  TEXT    NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profile_skill (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id  INTEGER NOT NULL DEFAULT 1 REFERENCES profile(id) ON DELETE CASCADE,
        skill_name  TEXT    NOT NULL,
        proficiency INTEGER NOT NULL CHECK (proficiency BETWEEN 1 AND 5)
      );

      CREATE INDEX IF NOT EXISTS idx_profile_skill_profile
        ON profile_skill(profile_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_skill_unique
        ON profile_skill(profile_id, lower(skill_name));
    `);
  },
};

export default migration;
