// Server-side counterpart to src/pages/welcome/shared/appMeta.js's
// APP_VERSION. The frontend derives its copy from package.json via Vite's
// `define` (__APP_VERSION__), which only exists inside Vite's build/dev
// pipeline — server code runs as plain Node (both `node server/index.js`
// and the Vercel function in api/index.js), so it reads package.json
// directly instead. Two read mechanisms, one source of truth.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export const APP_VERSION = `v${pkg.version}`;
