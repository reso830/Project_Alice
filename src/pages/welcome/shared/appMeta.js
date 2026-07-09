// Centralized app-level metadata for chrome (footer + welcome mini footer).
// APP_VERSION is derived from package.json at build/test time via Vite's
// `define` (see vite.config.js) — release bumps only need to touch
// package.json and package-lock.json now, not this file too.

export const APP_VERSION = `v${__APP_VERSION__}`;

export const ISSUE_URL = 'https://github.com/reso830/Project_Alice/issues/new';

export const LICENSE_NAME = 'PolyForm Noncommercial 1.0.0';

export const LICENSE_URL = 'https://polyformproject.org/licenses/noncommercial/1.0.0';
