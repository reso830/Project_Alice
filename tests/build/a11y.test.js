import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('index.html landmarks (issue #139 Lighthouse audit)', () => {
  it('wraps the app root in a <main> landmark', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toMatch(/<main id="app">/);
    expect(html).not.toMatch(/<div id="app">/);
  });
});
