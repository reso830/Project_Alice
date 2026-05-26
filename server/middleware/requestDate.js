import { currentDate } from '../db/columns.js';

// Issue #43 — derive "today" from the client's local timezone rather than
// the server's. The client (src/services/api.js) sends its local
// YYYY-MM-DD in the `X-Client-Date` header; routes thread that value into
// the repository as the `now` arg so audit columns (created_at,
// updated_at, last_status_update) reflect the user's wall-clock day.
//
// Strict regex validation prevents a malformed/malicious header from
// writing arbitrary strings into date columns. Anything that does not
// parse falls back to the UTC `currentDate()` — the same fallback used
// when the header is missing entirely (curl, tests, scripts).

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRequestDate(req) {
  const header = typeof req?.get === 'function' ? req.get('X-Client-Date') : undefined;
  if (typeof header === 'string' && ISO_DATE.test(header)) {
    return header;
  }
  return currentDate();
}
