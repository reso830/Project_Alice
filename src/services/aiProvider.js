import { openrouterProvider } from './providers/openrouter.js';

function assertValidProvider(slug, provider) {
  const missing = [];
  if (typeof provider?.defaultModel !== 'string' || !provider.defaultModel.trim()) {
    missing.push('defaultModel');
  }
  if (typeof provider?.complete !== 'function') {
    missing.push('complete');
  }
  if (typeof provider?.validateKey !== 'function') {
    missing.push('validateKey');
  }
  if (missing.length > 0) {
    throw new Error(`AI provider "${slug}" is missing required fields: ${missing.join(', ')}.`);
  }
}

const PROVIDERS = { openrouter: openrouterProvider };

for (const [slug, provider] of Object.entries(PROVIDERS)) {
  assertValidProvider(slug, provider);
}

let activeSlug = 'openrouter';

export function resolveProvider(slug) {
  const provider = PROVIDERS[slug];
  if (!provider) {
    throw new Error(`Unknown AI provider: ${slug}`);
  }
  return provider;
}

export function getActiveProvider() {
  return resolveProvider(activeSlug);
}

export function setActiveProvider(slug) {
  resolveProvider(slug);
  activeSlug = slug;
}
