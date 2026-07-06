import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FAVICON_LINKS = [
  {
    href: '/favicon.ico',
    file: join('public', 'favicon.ico'),
    html: '<link rel="icon" href="/favicon.ico" sizes="any">',
  },
  {
    href: '/favicon.svg',
    file: join('public', 'favicon.svg'),
    html: '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
  },
  {
    href: '/favicon-32x32.png',
    file: join('public', 'favicon-32x32.png'),
    html: '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
  },
  {
    href: '/apple-touch-icon.png',
    file: join('public', 'apple-touch-icon.png'),
    html: '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  },
];

describe('favicon asset', () => {
  it('uses the staged favicon set instead of the full-size app mark', () => {
    const html = readFileSync('index.html', 'utf8');

    for (const link of FAVICON_LINKS) {
      expect(html).toContain(link.html);
      expect(statSync(link.file).isFile()).toBe(true);
    }
    expect(html).not.toContain('/src/assets/Alice_Colored.png');
    expect(statSync(join('public', 'favicon-32x32.png')).size).toBeLessThan(20_000);
  });
});
