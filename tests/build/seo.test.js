import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('SEO meta (issue #139)', () => {
  const html = readFileSync('index.html', 'utf8');

  it('has a description and canonical link', () => {
    expect(html).toContain('<meta name="description" content="Your Career OS — track applications, tailor resumes and cover letters, and prep for interviews, all in one place.">');
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+"\s*>/);
  });

  it('has Open Graph tags pointing at the static social-card image', () => {
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('<meta property="og:title" content="Project Alice — Your Career OS">');
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/[^"]+\/og-image\.png"\s*>/);
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
  });

  it('has a Twitter Card pointing at the same social-card image', () => {
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toMatch(/<meta name="twitter:image" content="https:\/\/[^"]+\/og-image\.png"\s*>/);
  });

  it('ships the static og-image.png referenced above (no per-request generation)', () => {
    const file = join('public', 'og-image.png');
    expect(statSync(file).isFile()).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(1_000);
  });
});

describe('robots.txt (issue #139)', () => {
  it('disallows /api/ and nothing else, since the SPA never leaves "/"', () => {
    const robots = readFileSync(join('public', 'robots.txt'), 'utf8');
    expect(robots).toMatch(/User-agent:\s*\*/);
    expect(robots).toContain('Disallow: /api/');
  });
});
