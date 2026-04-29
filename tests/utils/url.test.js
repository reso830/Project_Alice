import { describe, expect, it } from 'vitest';
import { getSafeExternalHref } from '../../src/utils/url.js';

describe('url utilities', () => {
  it('allows http and https external hrefs', () => {
    expect(getSafeExternalHref('https://example.com/profile')).toBe('https://example.com/profile');
    expect(getSafeExternalHref('http://example.com/profile')).toBe('http://example.com/profile');
  });

  it('rejects unsafe or malformed hrefs', () => {
    expect(getSafeExternalHref('javascript:alert(1)')).toBe('#');
    expect(getSafeExternalHref('data:text/plain,hello')).toBe('#');
    expect(getSafeExternalHref('not a url')).toBe('#');
  });
});
