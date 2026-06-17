import { normalizeApplication, validateApplication } from '../models/application.js';
import { normaliseProfile } from '../models/profile.js';

export const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
export const LLM_TIMEOUT_MS = 30_000;
export const MAX_INPUT_CHARS = 24_000;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
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

export const REASON_CODES = Object.freeze({
  rate_limit: Object.freeze({
    code: 'HTTP 429',
    message: 'Rate limit reached — too many requests in a short time.',
    fix: 'wait',
  }),
  timeout: Object.freeze({
    code: 'TIMEOUT',
    message: 'The AI model took too long to respond.',
    fix: 'wait',
  }),
  server: Object.freeze({
    code: 'HTTP 503',
    message: 'The AI provider is temporarily unavailable.',
    fix: 'wait',
  }),
  network: Object.freeze({
    code: 'NETWORK',
    message: "Couldn't reach the AI service — check your connection.",
    fix: 'wait',
  }),
  invalid_key: Object.freeze({
    code: 'HTTP 401',
    message: 'Invalid API key — your AI provider key was rejected.',
    fix: 'settings',
  }),
  quota: Object.freeze({
    code: 'HTTP 402',
    message: 'Out of credits — your AI provider account has no remaining balance.',
    fix: 'settings',
  }),
  NO_TEXT: Object.freeze({
    code: 'NO_TEXT',
    message: 'No machine-readable text found — the file looks scanned or image-only.',
    fix: 'dead-end',
  }),
});

function createLlmError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  if (status) {
    error.status = status;
  }
  return error;
}

export function mapErrorToReason(errorOrStatus) {
  const status = typeof errorOrStatus === 'number'
    ? errorOrStatus
    : errorOrStatus?.status;
  const code = typeof errorOrStatus === 'string'
    ? errorOrStatus
    : errorOrStatus?.code;
  const name = errorOrStatus?.name;

  if (code === 'NO_TEXT' || code === 'LLM_EMPTY_RESPONSE') {
    return 'NO_TEXT';
  }

  if (code === 'LLM_TIMEOUT' || name === 'AbortError' || status === 408) {
    return 'timeout';
  }

  if (code === 'LLM_NETWORK_ERROR') {
    return 'network';
  }

  if (status === 401 || status === 403) {
    return 'invalid_key';
  }

  if (status === 402) {
    return 'quota';
  }

  if (status === 429) {
    return 'rate_limit';
  }

  if (status >= 500 && status <= 599) {
    return 'server';
  }

  return 'rate_limit';
}

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

function parseAssistantJson(content) {
  if (typeof content !== 'string') {
    throw createLlmError('LLM_INVALID_RESPONSE', 'The provider returned an invalid response.');
  }

  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(jsonText);
  } catch {
    throw createLlmError('LLM_INVALID_RESPONSE', 'The provider returned invalid JSON.');
  }
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

async function requestChatCompletion({
  text,
  key,
  model = DEFAULT_MODEL,
  systemPrompt,
}) {
  const rawText = typeof text === 'string' ? text : '';
  const truncated = rawText.length > MAX_INPUT_CHARS;
  const input = truncated ? rawText.slice(0, MAX_INPUT_CHARS) : rawText;
  const modelSlug = typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_MODEL;
  const controller = new globalThis.AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let response;

  try {
    response = await globalThis.fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelSlug,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createLlmError('LLM_TIMEOUT', 'The provider request timed out.');
    }
    throw createLlmError('LLM_NETWORK_ERROR', 'The provider request failed.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw createLlmError('LLM_PROVIDER_ERROR', 'The provider rejected the request.', response.status);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw createLlmError('LLM_INVALID_RESPONSE', 'The provider returned an invalid response.');
  }

  const parsed = parseAssistantJson(payload?.choices?.[0]?.message?.content);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw createLlmError('LLM_INVALID_RESPONSE', 'The provider returned an invalid schema.');
  }

  return { parsed, truncated };
}

export async function parseWithLlm(text, key, model = DEFAULT_MODEL) {
  const { parsed, truncated } = await requestChatCompletion({
    text,
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
  const { parsed, truncated } = await requestChatCompletion({
    text,
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

export async function validateKey(key) {
  const controller = new globalThis.AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await globalThis.fetch(OPENROUTER_MODELS_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
    });

    if (response.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      reason: mapErrorToReason(response.status),
    };
  } catch (error) {
    return {
      ok: false,
      reason: mapErrorToReason(error?.name === 'AbortError'
        ? error
        : createLlmError('LLM_NETWORK_ERROR', 'The provider request failed.')),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
