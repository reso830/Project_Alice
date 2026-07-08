// @vitest-environment jsdom
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

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
    expect(html).toContain('href="/"');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    
    // Accessibility: decorative elements are hidden
    expect(html).toContain('class="twinkles" aria-hidden="true"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('self-hosts the Sora 800 weight the app does not otherwise load', () => {
    const html = readFileSync(join('public', '404.html'), 'utf8');
    expect(html).toMatch(/font-weight:\s*800/);
    expect(html).toMatch(/src:\s*url\(['"]?\/fonts\/sora-latin-800-normal\.woff2['"]?\)/);
    expect(statSync(join('public', 'fonts', 'sora-latin-800-normal.woff2')).isFile()).toBe(true);
  });

  it('runs the sparkle animation logic and cleans up the overlays in browser context', () => {
    const html = readFileSync(join('public', '404.html'), 'utf8');
    
    // Inject page structure into JSDOM
    document.documentElement.innerHTML = html;
    
    const scriptEl = document.querySelector('script');
    expect(scriptEl).not.toBeNull();

    // Compile and run the IIFE in the JSDOM context
    const runAnimation = new Function(scriptEl.textContent);
    
    // Verify initial state
    expect(document.body.classList.contains('anim')).toBe(false);

    vi.useFakeTimers();
    runAnimation();

    // Verify anim class is added and sparkles are generated under prefers-reduced-motion: false
    expect(document.body.classList.contains('anim')).toBe(true);
    const sparks = document.querySelectorAll('.burst-spark');
    expect(sparks.length).toBe(20);

    // Fast-forward animation timeout (3600ms)
    vi.advanceTimersByTime(3600);

    // Overlay stage and burst should be completely removed from DOM
    expect(document.querySelector('.stage')).toBeNull();
    expect(document.querySelector('.burst')).toBeNull();

    vi.useRealTimers();
  });
});
