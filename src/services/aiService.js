import { getActiveProvider } from './aiProvider.js';
import { createLlmError, mapErrorToReason } from './aiErrors.js';
import { openrouterProvider } from './providers/openrouter.js';

export const DEFAULT_MODEL = openrouterProvider.defaultModel;

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

export async function complete(params) {
  return getActiveProvider().complete(params);
}

export async function validateKey(key) {
  return getActiveProvider().validateKey(key);
}

export { createLlmError, mapErrorToReason };
