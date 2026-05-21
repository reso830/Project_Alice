import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const faviconPath = join('public', 'favicon-32x32.png');

describe('favicon asset', () => {
  it('uses a dedicated small favicon instead of the full-size app mark', () => {
    const html = readFileSync('index.html', 'utf8');
    const favicon = statSync(faviconPath);

    expect(html).toContain('href="/favicon-32x32.png"');
    expect(html).not.toContain('/src/assets/Alice_Colored.png');
    expect(favicon.size).toBeLessThan(20_000);
  });
});
