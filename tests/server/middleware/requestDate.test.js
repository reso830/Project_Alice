import { describe, expect, it } from 'vitest';
import { currentDate } from '../../../server/db/columns.js';
import { resolveRequestDate } from '../../../server/middleware/requestDate.js';

// Issue #43 — server trusts the client's local "today" for audit-column
// stamping. The header carries YYYY-MM-DD in the user's local timezone.
// Malformed / missing values fall back to UTC `currentDate()` so direct
// API consumers (curl, tests, scripts) still work.

function makeReq(headerValue) {
  return {
    get(name) {
      if (typeof name !== 'string') return undefined;
      if (name.toLowerCase() !== 'x-client-date') return undefined;
      return headerValue;
    },
  };
}

describe('resolveRequestDate', () => {
  it('returns the X-Client-Date header value when it is a valid YYYY-MM-DD string', () => {
    expect(resolveRequestDate(makeReq('2030-06-15'))).toBe('2030-06-15');
  });

  it('falls back to currentDate() when the header is missing', () => {
    expect(resolveRequestDate(makeReq(undefined))).toBe(currentDate());
  });

  it('falls back to currentDate() when the header is an empty string', () => {
    expect(resolveRequestDate(makeReq(''))).toBe(currentDate());
  });

  it('falls back to currentDate() when the header is malformed', () => {
    expect(resolveRequestDate(makeReq('not-a-date'))).toBe(currentDate());
    expect(resolveRequestDate(makeReq('2030/06/15'))).toBe(currentDate());
    expect(resolveRequestDate(makeReq('15-06-2030'))).toBe(currentDate());
    expect(resolveRequestDate(makeReq('2030-6-15'))).toBe(currentDate());
    expect(resolveRequestDate(makeReq('2030-06-15T00:00:00Z'))).toBe(currentDate());
  });

  it('falls back to currentDate() when the header is shape-valid but an impossible calendar date (PR #46 review)', () => {
    // Shape matches /^\d{4}-\d{2}-\d{2}$/ but the date cannot exist —
    // round-trip parse must reject. Otherwise SQLite would persist
    // garbage text into the audit columns and Supabase `date` columns
    // would reject the write and 500 the request.
    expect(resolveRequestDate(makeReq('2030-13-40'))).toBe(currentDate());
    expect(resolveRequestDate(makeReq('2030-02-30'))).toBe(currentDate());
    expect(resolveRequestDate(makeReq('2030-00-15'))).toBe(currentDate());
    expect(resolveRequestDate(makeReq('2030-06-00'))).toBe(currentDate());
    expect(resolveRequestDate(makeReq('2030-99-99'))).toBe(currentDate());
    // Non-leap-year Feb 29 is also impossible.
    expect(resolveRequestDate(makeReq('2030-02-29'))).toBe(currentDate());
  });

  it('accepts a real leap-day Feb 29 in a leap year', () => {
    expect(resolveRequestDate(makeReq('2028-02-29'))).toBe('2028-02-29');
  });

  it('tolerates a request object without a get() method', () => {
    // Defensive: some tests pass plain objects; do not throw.
    expect(resolveRequestDate({})).toBe(currentDate());
  });
});
