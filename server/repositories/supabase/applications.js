import {
  APPLICATION_COLUMNS_WITHOUT_USER_ID,
  DEFAULT_STATUS,
  currentDate,
  toRecord,
  toRow,
} from '../../db/columns.js';

const SELECT_PROJECTION = APPLICATION_COLUMNS_WITHOUT_USER_ID.join(',');

function stripUserId(input) {
  if (input == null) return {};
  const { user_id, ...rest } = input;
  void user_id;
  return rest;
}

// Normalize a row built by the shared `toRow()` (SQLite-shaped: integer
// booleans, JSON-stringified arrays/objects) into the shape Postgres
// expects via PostgREST (native booleans, jsonb values). SQLite's
// permissive typing means `toRow` writes 0/1 for fav/archived and
// `JSON.stringify(...)` for skills/preferred_skills/metadata; Postgres
// strict types reject those. This helper is the Supabase-side
// translation; the SQLite adapter is unchanged.
const JSONB_COLUMNS = ['skills', 'preferred_skills', 'metadata', 'timeline'];
const BOOLEAN_COLUMNS = ['fav', 'archived'];

function normalizeForPostgres(row) {
  if (row == null) return row;
  const out = { ...row };

  for (const col of BOOLEAN_COLUMNS) {
    if (col in out && typeof out[col] !== 'boolean') {
      out[col] = Boolean(out[col]);
    }
  }

  for (const col of JSONB_COLUMNS) {
    if (col in out && typeof out[col] === 'string') {
      try {
        out[col] = JSON.parse(out[col]);
      } catch {
        // Leave as-is — PostgREST will surface a clearer error than we can.
      }
    }
  }

  return out;
}

/**
 * Per-request Supabase adapter for the hosted `applications` table.
 *
 * The `client` argument is constructed by
 * `server/repositories/supabase/client.js` for the current request and
 * carries the caller's JWT, so every PostgREST query runs under RLS as
 * the authenticated user. Server-side `.eq('user_id', userId)` filters
 * layer defense on top of RLS.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId — Supabase auth user id (`req.user.id`).
 * @returns {import('../applications.js').ApplicationsRepository}
 */
export function createSupabaseApplicationsRepository(client, userId) {
  async function getById(id) {
    const { data, error } = await client
      .from('applications')
      .select(SELECT_PROJECTION)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? toRecord(data) : null;
  }

  async function getAll() {
    const { data, error } = await client
      .from('applications')
      .select(SELECT_PROJECTION)
      .eq('user_id', userId)
      .eq('archived', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toRecord);
  }

  async function create(fields, now = currentDate()) {
    const sanitized = stripUserId(fields);
    const row = {
      status: DEFAULT_STATUS,
      compat: 0,
      fav: 0,
      skills: JSON.stringify([]),
      timeline: '[]',
      archived: 0,
      metadata: null,
      ...toRow(sanitized),
    };
    row.created_at = now;
    row.updated_at = now;
    row.last_status_update = now;
    row.user_id = userId;

    const { data, error } = await client
      .from('applications')
      .insert(normalizeForPostgres(row))
      .select(SELECT_PROJECTION)
      .single();
    if (error) throw error;
    return toRecord(data);
  }

  async function update(id, fields, now = currentDate()) {
    const sanitized = stripUserId(fields);
    const row = toRow(sanitized);

    if (Object.keys(row).length === 0) {
      // No translatable fields — nothing to write. Return current state
      // to match the SQLite repository's contract.
      return getById(id);
    }

    row.updated_at = now;

    if (Object.hasOwn(sanitized, 'status')) {
      const current = await getById(id);
      if (!current) return null;
      if (sanitized.status !== current.status) {
        row.last_status_update = now;
      }
    }

    const { data, error } = await client
      .from('applications')
      .update(normalizeForPostgres(row))
      .eq('id', id)
      .eq('user_id', userId)
      .select(SELECT_PROJECTION)
      .maybeSingle();
    if (error) throw error;
    return data ? toRecord(data) : null;
  }

  async function archive(id, now = currentDate()) {
    // SQLite's archive() sets archived=1 AND fav=0 in one statement; mirror
    // that exactly. Calling update({ archived: true }) would also work via
    // toRow's archived→fav side effect, but the explicit form here keeps
    // the archive semantics readable and avoids the conditional fetch in
    // update(). Native booleans here because the Postgres columns are bool.
    const { data, error } = await client
      .from('applications')
      .update({ archived: true, fav: false, updated_at: now })
      .eq('id', id)
      .eq('user_id', userId)
      .select(SELECT_PROJECTION)
      .maybeSingle();
    if (error) throw error;
    return data ? toRecord(data) : null;
  }

  return { getAll, getById, create, update, archive };
}
