import { createLlmError, mapErrorToReason } from '../aiErrors.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const LLM_TIMEOUT_MS = 30_000;
const MAX_INPUT_CHARS = 24_000;

function createTimeoutController() {
  const controller = new globalThis.AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  return {
    controller,
    clear: () => clearTimeout(timeoutId),
  };
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

async function complete({
  userContent,
  key,
  model = DEFAULT_MODEL,
  systemPrompt,
}) {
  const rawText = typeof userContent === 'string' ? userContent : '';
  const truncated = rawText.length > MAX_INPUT_CHARS;
  const input = truncated ? rawText.slice(0, MAX_INPUT_CHARS) : rawText;
  const modelSlug = typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_MODEL;
  const timeout = createTimeoutController();

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
      signal: timeout.controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createLlmError('LLM_TIMEOUT', 'The provider request timed out.');
    }
    throw createLlmError('LLM_NETWORK_ERROR', 'The provider request failed.');
  } finally {
    timeout.clear();
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
    throw createLlmError('LLM_INVALID_RESPONSE', 'The provider returned invalid schema.');
  }

  return { parsed, truncated };
}

async function validateKey(key) {
  const timeout = createTimeoutController();

  try {
    const response = await globalThis.fetch(OPENROUTER_MODELS_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: timeout.controller.signal,
    });

    if (response.ok) {
      return { ok: true };
    }

    return {
      ok: false,
      reason: mapErrorToReason(response.status),
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        ok: false,
        reason: mapErrorToReason(createLlmError('LLM_TIMEOUT', 'The provider request timed out.')),
      };
    }

    return {
      ok: false,
      reason: mapErrorToReason(createLlmError('LLM_NETWORK_ERROR', 'The provider request failed.')),
    };
  } finally {
    timeout.clear();
  }
}

export const openrouterProvider = {
  defaultModel: DEFAULT_MODEL,
  complete,
  validateKey,
};
