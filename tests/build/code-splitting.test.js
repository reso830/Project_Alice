import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

// WS4 (044): Calendar/Profile/ProfileEdit are dynamic-imported inside
// navigate() and must land in their own build chunks; Tracker (the landing
// route) stays statically imported and must stay out of those chunks —
// i.e. remain part of the initial/main bundle (N5).
describe('WS4 route-level code splitting', () => {
  it('builds Calendar/Profile/ProfileEdit as separate chunks, with Tracker eager in the main bundle', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alice-ws4-build-'));

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

      const assetsDir = path.join(outDir, 'assets');
      const jsFiles = fs.readdirSync(assetsDir).filter((file) => file.endsWith('.js'));

      const calendarChunk = jsFiles.find((file) => file.startsWith('Calendar-'));
      const profileChunk = jsFiles.find((file) => file.startsWith('Profile-') && !file.startsWith('ProfileEdit-'));
      const profileEditChunk = jsFiles.find((file) => file.startsWith('ProfileEdit-'));
      const mainChunk = jsFiles.find((file) => file.startsWith('index-'));

      expect(mainChunk).toBeDefined();
      expect(calendarChunk).toBeDefined();
      expect(profileChunk).toBeDefined();
      expect(profileEditChunk).toBeDefined();

      // Split routes must not be part of the main entry chunk.
      expect(calendarChunk).not.toBe(mainChunk);
      expect(profileChunk).not.toBe(mainChunk);
      expect(profileEditChunk).not.toBe(mainChunk);

      // Tracker (N5) stays out of the split chunks — it's eager, so its
      // code (a string unique to Tracker.js, not shared via skeletons.js)
      // must appear in the main chunk instead.
      const mainSource = fs.readFileSync(path.join(assetsDir, mainChunk), 'utf8');
      const calendarSource = fs.readFileSync(path.join(assetsDir, calendarChunk), 'utf8');
      const profileSource = fs.readFileSync(path.join(assetsDir, profileChunk), 'utf8');
      const profileEditSource = fs.readFileSync(path.join(assetsDir, profileEditChunk), 'utf8');
      const trackerMarker = "Couldn't load your applications. Check your connection or try again.";

      expect(mainSource).toContain(trackerMarker);
      expect(calendarSource).not.toContain(trackerMarker);
      expect(profileSource).not.toContain(trackerMarker);
      expect(profileEditSource).not.toContain(trackerMarker);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }, 60_000);
});
