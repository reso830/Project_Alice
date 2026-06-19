import {
  complete,
  mapErrorToReason,
} from './aiService.js';
import { resolveSkillMatches } from '../utils/skillProficiency.js';

const SUMMARY_TARGET_LIMIT = 28;

export { mapErrorToReason };

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 'None';
  }

  const cleaned = values
    .map(cleanString)
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(', ') : 'None';
}

function formatProfileSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) {
    return 'None';
  }

  const lines = skills
    .filter((skill) => cleanString(skill?.name))
    .map((skill) => `${cleanString(skill.name)} (${Number(skill.level) || 0}/5)`);
  return lines.length > 0 ? lines.join(', ') : 'None';
}

function formatSkillMatches(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return 'None';
  }

  return matches.map((match) => `${match.name}: ${match.level}`).join(', ');
}

function formatExperienceRoles(experience) {
  if (!Array.isArray(experience) || experience.length === 0) {
    return 'None';
  }

  const roles = experience
    .map((entry) => cleanString(entry?.role))
    .filter(Boolean);
  return roles.length > 0 ? roles.join(', ') : 'None';
}

function buildCompatSystemPrompt() {
  return [
    'Write like a concise professional career coach reviewing a role fit.',
    'Return ONLY JSON with this exact shape: {"summary":"<=34 chars","body":"..."}',
    'The UI already displays the numeric score and match tier, so do not repeat the score, percentage, or tier label.',
    'The summary must be a complete phrase under 28 characters; do not rely on truncation. Keep it specific and avoid generic "Low match" or "High match" restatements.',
    'The body should be 4-6 natural sentences, warm but direct, and synthesize what the match means for the candidate.',
    'Do not read out every required or preferred skill. Mention only the few signals that explain the fit, tension, or most important gap.',
    'Avoid hiring predictions and avoid telling the user whether to apply. Focus on positioning, strengths, gaps, and how the role reads against the profile.',
  ].join(' ');
}

function fallbackSummaryForScore(score) {
  if (score >= 85) return 'Strong fit with nuance';
  if (score >= 65) return 'Strong fit with gaps';
  if (score >= 40) return 'Some fit, clear gaps';
  return 'Big gaps to address';
}

function buildCompatUserContent(application, profile) {
  const app = application ?? {};
  const candidate = profile ?? {};
  const score = Number.isFinite(app.compat) ? Math.round(app.compat) : 0;
  const requiredSkills = Array.isArray(app.skills) ? app.skills : [];
  const preferredSkills = Array.isArray(app.preferredSkills) ? app.preferredSkills : [];
  const allSkills = [...requiredSkills, ...preferredSkills];
  const skillMatches = resolveSkillMatches(allSkills, candidate.skills);

  return [
    `Score: ${score}`,
    '',
    'Job data:',
    `Job title: ${cleanString(app.jobTitle) || 'None'}`,
    `Responsibilities: ${cleanString(app.responsibilities) || 'None'}`,
    `Required skills: ${formatList(requiredSkills)}`,
    `Preferred skills: ${formatList(preferredSkills)}`,
    `Minimum years experience: ${Number.isFinite(app.minYearsExperience) ? app.minYearsExperience : 'None'}`,
    '',
    'Resolved skill matches:',
    formatSkillMatches(skillMatches),
    '',
    'Profile data:',
    `Summary: ${cleanString(candidate.summary) || 'None'}`,
    `Profile skills: ${formatProfileSkills(candidate.skills)}`,
    `Experience roles: ${formatExperienceRoles(candidate.experience)}`,
  ].join('\n');
}

function normalizeNotes(parsed, application = null) {
  const rawSummary = cleanString(parsed?.summary);
  let summary = rawSummary;
  if (summary.length > SUMMARY_TARGET_LIMIT) {
    const score = Number.isFinite(application?.compat) ? Math.round(application.compat) : 0;
    summary = fallbackSummaryForScore(score);
  }
  const body = cleanString(parsed?.body);

  return { summary, body };
}

export async function generateNotes(application, profile, aiSettings) {
  const { parsed } = await complete({
    key: aiSettings?.getKey?.(),
    model: aiSettings?.getModel?.(),
    systemPrompt: buildCompatSystemPrompt(),
    userContent: buildCompatUserContent(application, profile),
  });

  return normalizeNotes(parsed, application);
}
