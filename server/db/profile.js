import { db } from '../db.js';
import {
  dedupeSkillsForStorage,
  joinProfileWithSkills,
  splitProfileForStorage,
} from '../../src/models/profile.js';

const PROFILE_ID = 1;

function toRecord(row) {
  if (!row) {
    return null;
  }

  return JSON.parse(row.data);
}

function writeProfileParts(document, skills, targetDb) {
  targetDb.prepare(`
    INSERT INTO profile (id, data, updated_at)
    VALUES (@id, @data, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      data = excluded.data,
      updated_at = excluded.updated_at
  `).run({
    id: PROFILE_ID,
    data: JSON.stringify(document),
  });

  targetDb.prepare('DELETE FROM profile_skill WHERE profile_id = ?').run(PROFILE_ID);

  const insertSkill = targetDb.prepare(`
    INSERT INTO profile_skill (profile_id, skill_name, proficiency)
    VALUES (@profileId, @skillName, @proficiency)
  `);

  for (const skill of skills) {
    insertSkill.run({
      profileId: PROFILE_ID,
      skillName: skill.name,
      proficiency: skill.level,
    });
  }
}

function readSkills(targetDb) {
  return targetDb
    .prepare(`
      SELECT skill_name, proficiency
      FROM profile_skill
      WHERE profile_id = ?
      ORDER BY id ASC
    `)
    .all(PROFILE_ID)
    .map((row) => ({
      name: row.skill_name,
      level: row.proficiency,
    }));
}

export function getProfile(targetDb = db) {
  const row = targetDb.prepare('SELECT data FROM profile WHERE id = ?').get(PROFILE_ID);
  const document = toRecord(row);

  if (!document) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(document, 'skills')) {
    const { skills } = splitProfileForStorage(document);
    const cleanedSkills = dedupeSkillsForStorage(skills);
    const { skills: _embeddedSkills, ...strippedDocument } = document;

    targetDb.transaction(() => {
      writeProfileParts(strippedDocument, cleanedSkills, targetDb);
    })();

    return joinProfileWithSkills(strippedDocument, cleanedSkills);
  }

  return joinProfileWithSkills(document, readSkills(targetDb));
}

export function saveProfile(profile, targetDb = db) {
  const { document, skills } = splitProfileForStorage(profile);

  targetDb.transaction(() => {
    writeProfileParts(document, skills, targetDb);
  })();

  return getProfile(targetDb);
}
