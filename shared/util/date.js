// Cross-stack date helpers. Lives in `shared/` (not `src/utils/` or
// `server/`) because both the client (form validation, display) and the
// server (X-Client-Date middleware, issue #43) need real calendar-date
// validation — not just YYYY-MM-DD shape matching.

export function isValidISODate(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  // Round-trip via Date — Date constructor silently wraps invalid values
  // (e.g. month=13 → next year's January). Comparing the round-tripped
  // components back to the input rejects impossible dates like
  // 2030-02-30 or 2030-13-40.
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
  );
}
