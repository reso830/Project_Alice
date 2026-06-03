const KEY_STORAGE_KEY = 'alice.ai.openrouterKey';
const CONSENT_STORAGE_KEY = 'alice.ai.consent';
const CONSENT_GRANTED = 'granted';

function storage() {
  return globalThis.localStorage;
}

export function getKey() {
  return (storage()?.getItem(KEY_STORAGE_KEY) ?? '').trim();
}

export function setKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';

  if (!key) {
    clearKey();
    return;
  }

  storage()?.setItem(KEY_STORAGE_KEY, key);
}

export function clearKey() {
  storage()?.removeItem(KEY_STORAGE_KEY);
}

export function hasKey() {
  return getKey() !== '';
}

export function getConsent() {
  return storage()?.getItem(CONSENT_STORAGE_KEY) ?? '';
}

export function setConsent() {
  storage()?.setItem(CONSENT_STORAGE_KEY, CONSENT_GRANTED);
}

export function clearConsent() {
  storage()?.removeItem(CONSENT_STORAGE_KEY);
}

export function hasConsent() {
  return getConsent() === CONSENT_GRANTED;
}
