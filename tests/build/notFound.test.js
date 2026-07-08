import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Issue #93: Vercel's static-output convention auto-serves a top-level
// dist/404.html (i.e. public/404.html, post-build) as the hosted not-found
// response — that behavior can't be exercised through Express at all
// (api/index.js never gets serveStatic), so this is the only guard for it.
describe('branded 404 page', () => {
  it('exists and carries the expected branding and a way back into the app', () => {
    const file = join('public', '404.html');
    expect(statSync(file).isFile()).toBe(true);

    const html = readFileSync(file, 'utf8');

    expect(html).toContain('This page did a disappearing act.');
    expect(html).toContain('role="alert"');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('self-hosts the Sora 800 weight the app does not otherwise load', () => {
    const html = readFileSync(join('public', '404.html'), 'utf8');
    expect(html).toContain("font-weight: 800; font-display: swap; src: url('/fonts/sora-latin-800-normal.woff2')");
    expect(statSync(join('public', 'fonts', 'sora-latin-800-normal.woff2')).isFile()).toBe(true);
  });
});
