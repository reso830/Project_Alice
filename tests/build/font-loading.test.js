import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

// WS5 (044): Sora + DM Mono are self-hosted (@fontsource) instead of a
// render-blocking fonts.googleapis.com <link> in index.html's <head>.
describe('WS5 font loading', () => {
  it('has no render-blocking third-party font request in the built index.html, and self-hosts the font files', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-ws5-build-'));

    try {
      execFileSync(
        process.execPath,
        [path.resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir, '--emptyOutDir'],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            VITE_SUPABASE_URL: 'https://example.supabase.co',
            VITE_SUPABASE_ANON_KEY: 'dummy-anon-key',
            VITE_AUTH_EMAIL_REDIRECT_URL: 'https://example.com/auth/callback',
          },
          timeout: 60_000,
          stdio: 'pipe',
        },
      );

      const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');

      expect(html).not.toContain('fonts.googleapis.com');
      expect(html).not.toContain('fonts.gstatic.com');

      // The self-hosted @font-face rules land in the app's own CSS bundle
      // (already loaded async relative to first paint — see main.js), not a
      // new render-blocking link.
      const cssFile = fs.readdirSync(path.join(outDir, 'assets')).find((file) => file.endsWith('.css'));
      expect(cssFile).toBeDefined();
      const css = fs.readFileSync(path.join(outDir, 'assets', cssFile), 'utf8');

      expect(css).toMatch(/font-family:['"]?Sora['"]?/);
      expect(css).toMatch(/font-family:['"]?DM Mono['"]?/);
      expect(css).toMatch(/font-display:swap/);

      // Font files themselves are self-hosted (woff2) alongside the CSS.
      const assetFiles = fs.readdirSync(path.join(outDir, 'assets'));
      expect(assetFiles.some((file) => /^sora-.*\.woff2$/.test(file))).toBe(true);
      expect(assetFiles.some((file) => /^dm-mono-.*\.woff2$/.test(file))).toBe(true);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }, 60_000);

  it('does not reference Google Fonts in the source index.html', () => {
    const html = fs.readFileSync('index.html', 'utf8');

    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('imports the self-hosted font weights actually used by the app (Sora 400/500/600/700, DM Mono 400/500)', () => {
    const css = fs.readFileSync('src/styles/main.css', 'utf8');

    for (const weight of ['400', '500', '600', '700']) {
      expect(css).toContain(`@import '@fontsource/sora/${weight}.css';`);
    }
    for (const weight of ['400', '500']) {
      expect(css).toContain(`@import '@fontsource/dm-mono/${weight}.css';`);
    }
  });
});
