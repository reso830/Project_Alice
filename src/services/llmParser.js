import { normalizeApplication, validateApplication } from '../models/application.js';
import { normaliseProfile } from '../models/profile.js';
import {
  complete,
  DEFAULT_MODEL,
  createLlmError,
} from './aiService.js';

export {
  DEFAULT_MODEL,
  mapErrorToReason,
  REASON_CODES,
} from './aiService.js';

const JOB_OUTPUT_FIELDS = [
  'companyName',
  'jobTitle',
  'responsibilities',
  'location',
  'salary',
  'workSetup',
  'shift',
  'skills',
  'preferredSkills',
  'recruiter',
  'jobPostingUrl',
];

function hasValue(value) {
  if (typeof value === 'string') {
    return value.trim() !== '';
  }

  if (Array.isArray(value)) {
    return value.some((entry) => {
      if (typeof entry === 'string') {
        return entry.trim() !== '';
      }

      if (entry && typeof entry === 'object') {
        return Object.values(entry).some(hasValue);
      }

      return false;
    });
  }

  return false;
}

function hasExtractedData(profile) {
  return Object.values(profile).some(hasValue);
}

function hasUsableJobData(draft) {
  return JOB_OUTPUT_FIELDS.some((field) => {
    const value = draft[field];

    if (field === 'salary') {
      return Number.isInteger(value) && value > 0;
    }

    return hasValue(value);
  });
}

function buildResumeSystemPrompt() {
  return [
    'You extract a resume into JSON for the user\'s profile. Return ONLY a JSON object — no prose, no markdown fences.',
    'If the input contains no résumé content, return every field empty: empty strings for string fields and empty arrays for array fields.',
    'Top-level keys: firstName, lastName, email, phone, city, summary (strings); and arrays experience, education, skills, certifications, awards, languages, links.',
    'Each array item MUST use exactly these keys:',
    'experience: {"role","company","responsibilities","dateStarted","dateEnded","currentWork"} — responsibilities is a single string (join bullets with newlines); currentWork is a boolean.',
    'education: {"degreeMajor","university","yearCompleted"}.',
    'certifications: {"name","issuingBody","certificateId","issuanceDate","expiryDate"}.',
    'awards: {"awardName","issuingBody","details","date"}.',
    'languages: {"language","proficiency"} — proficiency is one of Beginner, Intermediate, Professional, Fluent.',
    'links: {"url","friendlyName"}.',
    'skills: an array of plain strings (skill names only).',
    'Dates use MM/YYYY when the month is known; education yearCompleted is a 4-digit year. For a current role set currentWork true and dateEnded "".',
    'Do not fabricate missing facts — omit unknown values or use empty strings/arrays.',
  ].join(' ');
}

function buildJobSystemPrompt() {
  return [
    'You extract a job posting into JSON for an application draft. Return ONLY a JSON object — no prose, no markdown fences.',
    'If the input contains no job-posting content, return every field empty: empty strings for string fields, null for salary, and empty arrays for array fields.',
    'Top-level keys: companyName, jobTitle, responsibilities, location, salary, workSetup, shift, skills, preferredSkills, recruiter, jobPostingUrl.',
    'responsibilities is a single string; join bullets with newlines.',
    'salary is an integer annual Philippine peso amount, using the lower bound of a range; use null when absent or unclear.',
    'workSetup must be one of Remote, Hybrid, On-site, Field, or an empty string.',
    'shift must be one of Day, Mid, Night, Flexible, or an empty string.',
    'skills is an array of required skill names. preferredSkills is an array of nice-to-have skill names. Deduplicate both arrays.',
    'jobPostingUrl must be an http(s) URL or an empty string.',
    'Do not include status or compat. Status stays wishlisted and compat is assigned by the app.',
    'Years of experience is not an output field; do not return yearsOfExperience or similar keys.',
    'Do not fabricate missing facts — use empty strings, null, or empty arrays for unknown values.',
  ].join(' ');
}

export async function parseWithLlm(text, key, model = DEFAULT_MODEL) {
  const { parsed, truncated } = await complete({
    userContent: text,
    key,
    model,
    systemPrompt: buildResumeSystemPrompt(),
  });

  const draft = normaliseProfile(parsed);

  if (!hasExtractedData(draft)) {
    throw createLlmError('LLM_EMPTY_RESPONSE', 'The provider returned no usable profile data.');
  }

  return { draft, truncated };
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanSalary(value) {
  if (Number.isInteger(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().replace(/,/g, '');
  if (!/^\d+$/.test(normalized)) {
    return value;
  }

  return Number.parseInt(normalized, 10);
}

function cleanStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean))];
}

function buildJobDraft(parsed) {
  const draft = {
    companyName: cleanString(parsed.companyName),
    jobTitle: cleanString(parsed.jobTitle),
    responsibilities: cleanString(parsed.responsibilities),
    location: cleanString(parsed.location),
    salary: cleanSalary(parsed.salary),
    workSetup: cleanString(parsed.workSetup),
    shift: cleanString(parsed.shift),
    skills: cleanStringArray(parsed.skills),
    preferredSkills: cleanStringArray(parsed.preferredSkills),
    recruiter: cleanString(parsed.recruiter),
    jobPostingUrl: cleanString(parsed.jobPostingUrl),
    status: 'wishlisted',
  };

  const validated = validateApplication(normalizeApplication({
    id: 1,
    ...draft,
  }));

  delete validated.id;
  delete validated.compat;
  delete validated._corrupt;

  return Object.fromEntries(
    Object.entries(validated).filter(([key]) => key !== 'yearsOfExperience'),
  );
}

export async function parseJobWithLlm(text, key, model = DEFAULT_MODEL) {
  const { parsed, truncated } = await complete({
    userContent: text,
    key,
    model,
    systemPrompt: buildJobSystemPrompt(),
  });

  const draft = buildJobDraft(parsed);

  if (!hasUsableJobData(draft)) {
    throw createLlmError('LLM_EMPTY_RESPONSE', 'The provider returned no usable job-posting data.');
  }

  return { draft, truncated };
}
