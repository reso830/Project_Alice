import { openrouterProvider } from './providers/openrouter.js';

const PROVIDERS = {
  openrouter: openrouterProvider,
};

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
