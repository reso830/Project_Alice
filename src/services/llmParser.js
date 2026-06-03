import { normaliseProfile } from '../models/profile.js';

export const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
export const LLM_TIMEOUT_MS = 30_000;
export const MAX_INPUT_CHARS = 24_000;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function createLlmError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
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

function buildSystemPrompt() {
  return [
    'Return only JSON matching Alice profile fields.',
    'Use keys: firstName, lastName, email, phone, city, summary, skills, experience, education, certifications, awards, languages, links.',
    'Do not fabricate missing facts. Omit unknown values or use empty strings/arrays.',
    'Use MM/YYYY dates when month is known; use YYYY for education yearCompleted.',
  ].join(' ');
}

export async function parseWithLlm(text, key) {
  const rawText = typeof text === 'string' ? text : '';
  const truncated = rawText.length > MAX_INPUT_CHARS;
  const input = truncated ? rawText.slice(0, MAX_INPUT_CHARS) : rawText;
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
        model: DEFAULT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
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
    throw createLlmError('LLM_PROVIDER_ERROR', 'The provider rejected the request.');
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

  const draft = normaliseProfile(parsed);

  if (!hasExtractedData(draft)) {
    throw createLlmError('LLM_EMPTY_RESPONSE', 'The provider returned no usable profile data.');
  }

  return { draft, truncated };
}
