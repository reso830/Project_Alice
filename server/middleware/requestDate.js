import { isValidISODate } from '../../shared/util/date.js';
import { currentDate } from '../db/columns.js';

// Issue #43 — derive "today" from the client's local timezone rather than
// the server's. The client (src/services/api.js) sends its local
// YYYY-MM-DD in the `X-Client-Date` header; routes thread that value into
// the repository as the `now` arg so audit columns (created_at,
// updated_at, last_status_update) reflect the user's wall-clock day.
//
// `isValidISODate` does a round-trip parse, so impossible dates like
// `2030-13-40` or `2030-02-30` fall back to UTC. Without that, SQLite
// would persist garbage strings into date columns and Supabase `date`
// columns would reject the write and turn it into a 500.

export function resolveRequestDate(req) {
  const header = typeof req?.get === 'function' ? req.get('X-Client-Date') : undefined;
  if (isValidISODate(header)) {
    return header;
  }
  return currentDate();
}
