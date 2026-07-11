import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('vercel.json security headers (issue #139)', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const rule = config.headers?.find((entry) => entry.source === '/(.*)');
  const header = (key) => rule?.headers.find((h) => h.key === key)?.value;

  it('applies to every route', () => {
    expect(rule).toBeDefined();
  });

  it('sets a CSP allowing only the hosts the browser bundle actually calls', () => {
    const csp = header('Content-Security-Policy');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co https://openrouter.ai");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('sets frame, content-type, referrer, and permissions headers', () => {
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('Permissions-Policy')).toContain('camera=()');
  });
});
