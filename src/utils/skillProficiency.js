function normalizeSkillName(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/\s+/g, ' ')
    : '';
}

export function resolveSkillLevel(skillName, profileSkills) {
  const target = normalizeSkillName(skillName);
  if (!target || !Array.isArray(profileSkills)) {
    return 'missing';
  }

  const match = profileSkills.find((skill) => normalizeSkillName(skill?.name) === target);
  if (!match) {
    return 'missing';
  }

  return Number(match.level) >= 3 ? 'proficient' : 'learning';
}

export function resolveSkillMatches(skillNames, profileSkills) {
  if (!Array.isArray(skillNames)) {
    return [];
  }

  return skillNames
    .filter((skillName) => typeof skillName === 'string' && skillName.trim() !== '')
    .map((skillName) => ({
      name: skillName.trim(),
      level: resolveSkillLevel(skillName, profileSkills),
    }));
}
