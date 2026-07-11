import { readFileSync } from 'node:fs';
import process from 'node:process';
import { defineConfig } from 'vite';
import { stripStartupLoaderMarkup } from './shared/startupLoader.js';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

const HOSTED_FRONTEND_REQUIRED = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_AUTH_EMAIL_REDIRECT_URL',
];

export function assertHostedFrontendEnv() {
  return {
    name: 'alice:assert-hosted-frontend-env',
    config(_userConfig, env) {
      if (env.mode !== 'production') return;
      const missing = HOSTED_FRONTEND_REQUIRED.filter(
        (key) => !process.env[key],
      );
      if (missing.length) {
        throw new Error(
          `Production build requires ${missing.join(', ')} — set them in your build environment.`,
        );
      }
    },
  };
}

export function stripStartupLoaderInDev() {
  return {
    name: 'alice:strip-startup-loader-in-dev',
    apply: 'serve',
    transformIndexHtml(html) {
      return stripStartupLoaderMarkup(html);
    },
  };
}

export default defineConfig({
  plugins: [assertHostedFrontendEnv(), stripStartupLoaderInDev()],
  define: {
    __BUILD_MONTH__: JSON.stringify(
      new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    ),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    // The main entry chunk (core app + Supabase SDK, everything not lazy-
    // loaded per-page) sits just over Vite's 500kB default at ~508kB —
    // already gzips to ~141kB, and the page-level chunks (Calendar, Profile,
    // ProfileEdit) are already code-split via dynamic import. Raising the
    // limit stops the warning firing on every build without silencing a
    // limit so high it'd miss genuine future bloat.
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
