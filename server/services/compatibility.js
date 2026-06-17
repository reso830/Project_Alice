import { computeCompatibility } from '../../src/models/compatibility.js';

export function scoreApplication(appFields, profile, asOf) {
  return computeCompatibility(profile ?? {}, appFields ?? {}, { asOf }).score;
}

export async function recomputeActive(repos, profile, asOf) {
  const applications = await repos.applications.getAll();
  const updates = [];

  for (const application of applications) {
    const compat = scoreApplication(application, profile, asOf);

    if (compat !== application.compat) {
      updates.push(repos.applications.update(application.id, { compat }, asOf));
    }
  }

  return Promise.all(updates);
}
