import { computeCompatibility } from '../../src/models/compatibility.js';

export function scoreApplication(appFields, profile, asOf) {
  return computeCompatibility(profile ?? {}, appFields ?? {}, { asOf }).score;
}

export async function recomputeActive(repos, profile, asOf) {
  const applications = await repos.applications.getAll();
  const updates = [];

  for (const application of applications) {
    const compat = scoreApplication(application, profile, asOf);
    const compatScoredAt = new Date().toISOString();
    // Stamp even when the numeric score is unchanged: generated analysis
    // compares its timestamp to this value, so profile edits must stale notes.
    const payload = compat !== application.compat
      ? { compat, compatScoredAt }
      : { compatScoredAt };

    updates.push(repos.applications.update(application.id, payload, asOf));
  }

  return Promise.all(updates);
}
