export const COMPAT_RELEVANT_FIELDS = [
  'skills',
  'preferredSkills',
  'responsibilities',
  'jobTitle',
  'minYearsExperience',
];

export function valuesDiffer(first, second) {
  if (Array.isArray(first) || Array.isArray(second)) {
    return JSON.stringify(first ?? []) !== JSON.stringify(second ?? []);
  }

  return first !== second;
}

export function hasCompatRelevantFields(body, currentRecord = null) {
  return COMPAT_RELEVANT_FIELDS.some((field) => (
    Object.hasOwn(body ?? {}, field)
    && (!currentRecord || valuesDiffer(body[field], currentRecord[field]))
  ));
}
