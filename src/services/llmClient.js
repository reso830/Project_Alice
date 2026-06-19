export const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
export const LLM_TIMEOUT_MS = 30_000;
export const MAX_INPUT_CHARS = 24_000;
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function createLlmError(code, message, status) {
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

export async function requestChatCompletion({
  text,
  userContent,
  key,
  model = DEFAULT_MODEL,
  systemPrompt,
}) {
  const rawText = typeof userContent === 'string'
    ? userContent
    : typeof text === 'string'
      ? text
      : '';
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
    throw createLlmError('LLM_INVALID_RESPONSE', 'The provider returned invalid schema.');
  }

  return { parsed, truncated };
}
