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

  it('tolerates a request object without a get() method', () => {
    // Defensive: some tests pass plain objects; do not throw.
    expect(resolveRequestDate({})).toBe(currentDate());
  });
});
