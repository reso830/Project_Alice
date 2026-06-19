import { DEFAULT_MODEL } from '../services/aiService.js';

const KEY_STORAGE_KEY = 'alice.ai.openrouterKey';
const CONSENT_STORAGE_KEY = 'alice.ai.consent';
const CONSENT_GRANTED = 'granted';
const ENABLED_STORAGE_KEY = 'alice.ai.enabled';
const MODEL_STORAGE_KEY = 'alice.ai.model';
const FEATURES_STORAGE_KEY = 'alice.ai.features';

const FEATURE_KEYS = ['cv', 'jd', 'compat'];
const DEFAULT_FEATURES = Object.freeze({
  cv: true,
  jd: false,
  compat: false,
});

function storage() {
  return globalThis.localStorage;
}

function getStoredValue(key) {
  return storage()?.getItem(key) ?? null;
}

function hasStoredValue(key) {
  return getStoredValue(key) !== null;
}

function getLegacyConsent() {
  return getStoredValue(CONSENT_STORAGE_KEY) ?? '';
}

function ensureKnownFeature(key) {
  if (!FEATURE_KEYS.includes(key)) {
    throw new Error(`Unknown AI feature: ${key}`);
  }
}

function readRawKey() {
  return (getStoredValue(KEY_STORAGE_KEY) ?? '').trim();
}

function parseFeatures(value) {
  if (!value) {
    return { ...DEFAULT_FEATURES };
  }

  try {
    const parsed = JSON.parse(value);
    return FEATURE_KEYS.reduce((features, key) => ({
      ...features,
      [key]: typeof parsed?.[key] === 'boolean' ? parsed[key] : DEFAULT_FEATURES[key],
    }), {});
  } catch {
    return { ...DEFAULT_FEATURES };
  }
}

function writeFeatures(features) {
  storage()?.setItem(FEATURES_STORAGE_KEY, JSON.stringify(features));
}

function hasNewSettings() {
  return hasStoredValue(ENABLED_STORAGE_KEY)
    || hasStoredValue(MODEL_STORAGE_KEY)
    || hasStoredValue(FEATURES_STORAGE_KEY);
}

function ensureMigrated() {
  const store = storage();

  if (!store || hasNewSettings()) {
    return;
  }

  const hasLegacyKey = readRawKey() !== '';
  const hadConsent = getLegacyConsent() === CONSENT_GRANTED;

  store.setItem(ENABLED_STORAGE_KEY, hasLegacyKey && hadConsent ? '1' : '0');
  store.setItem(MODEL_STORAGE_KEY, DEFAULT_MODEL);
  writeFeatures(DEFAULT_FEATURES);
}

export { DEFAULT_MODEL };

export function isEnabled() {
  ensureMigrated();
  return getStoredValue(ENABLED_STORAGE_KEY) === '1';
}

export function setEnabled(value) {
  ensureMigrated();
  storage()?.setItem(ENABLED_STORAGE_KEY, value ? '1' : '0');
}

export function getKey() {
  ensureMigrated();
  return readRawKey();
}

export function setKey(value) {
  ensureMigrated();
  const key = typeof value === 'string' ? value.trim() : '';

  if (!key) {
    clearKey();
    return;
  }

  storage()?.setItem(KEY_STORAGE_KEY, key);
}

export function clearKey() {
  ensureMigrated();
  storage()?.removeItem(KEY_STORAGE_KEY);
}

export function hasKey() {
  return getKey() !== '';
}

export function canUseJdParser() {
  return isEnabled() && getFeature('jd') && hasKey();
}

export function canUseCompatAnalysis() {
  return isEnabled() && getFeature('compat') && hasKey();
}

export function getModel() {
  ensureMigrated();
  const model = (getStoredValue(MODEL_STORAGE_KEY) ?? '').trim();
  return model || DEFAULT_MODEL;
}

export function setModel(value) {
  ensureMigrated();
  const model = typeof value === 'string' ? value.trim() : '';
  storage()?.setItem(MODEL_STORAGE_KEY, model || DEFAULT_MODEL);
}

export function getFeature(key) {
  ensureKnownFeature(key);
  ensureMigrated();
  return parseFeatures(getStoredValue(FEATURES_STORAGE_KEY))[key];
}

export function setFeature(key, value) {
  ensureKnownFeature(key);
  ensureMigrated();
  writeFeatures({
    ...parseFeatures(getStoredValue(FEATURES_STORAGE_KEY)),
    [key]: Boolean(value),
  });
}

export function getConnectionStatus(testState) {
  if (!hasKey()) {
    return 'none';
  }

  const status = typeof testState === 'string' ? testState : testState?.status;

  if (status === 'testing') {
    return 'testing';
  }

  if (status === 'error' || testState?.ok === false) {
    return 'error';
  }

  return 'connected';
}

export function getConsent() {
  return hasKey() ? CONSENT_GRANTED : '';
}

export function setConsent() {
  setEnabled(true);
}

export function clearConsent() {
  clearKey();
}

export function hasConsent() {
  return getConsent() === CONSENT_GRANTED;
}
