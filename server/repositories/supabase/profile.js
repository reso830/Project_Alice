import { PROFILE_COLUMNS_WITHOUT_USER_ID } from '../../db/columns.js';
import { normaliseProfile } from '../../../src/models/profile.js';

const SELECT_PROJECTION = PROFILE_COLUMNS_WITHOUT_USER_ID.join(',');

function parseProfileData(value) {
  if (value == null) {
    return null;
  }
  // Postgres JSONB columns return pre-parsed objects; TEXT columns return
  // JSON strings (matching SQLite's `JSON.parse(row.data)` behavior).
  // Accept both shapes so the adapter is backend-agnostic.
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Per-request Supabase adapter for the hosted `profile` table.
 *
 * One profile row per user, enforced at the database layer via the
 * `UNIQUE (user_id)` constraint added by 019's migration
 * (data-model.md §1.2). The first user-driven upsert creates the row;
 * subsequent upserts update it in place. The seed step does NOT
 * pre-create profile rows — empty profile is intentional onboarding
 * (spec FR-012).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId — Supabase auth user id (`req.user.id`).
 * @returns {import('../profile.js').ProfileRepository}
 */
export function createSupabaseProfileRepository(client, userId) {
  async function get() {
    const { data: row, error } = await client
      .from('profile')
      .select(SELECT_PROJECTION)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    return parseProfileData(row.data);
  }

  async function upsert(profile) {
    const normalised = normaliseProfile(profile);
    const { data: row, error } = await client
      .from('profile')
      .upsert(
        {
          user_id: userId,
          data: JSON.stringify(normalised),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select(SELECT_PROJECTION)
      .single();
    if (error) throw error;
    return parseProfileData(row.data);
  }

  return { get, upsert };
}
