import process from 'node:process';
import { defineConfig } from 'vite';
import { stripStartupLoaderMarkup } from './shared/startupLoader.js';

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
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
