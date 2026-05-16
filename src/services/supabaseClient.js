import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const emailRedirectUrl = import.meta.env.VITE_AUTH_EMAIL_REDIRECT_URL;

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isHostedAuthAvailable = supabase !== null;

// Expose the client on `window` so operators can run the bypass test from
// DevTools (`await window.supabase.auth.signUp({ email, password })`) per
// quickstart.md §7 negative paths. This adds no attack surface: the anon key
// and URL are already inlined into the Vite bundle and constructable from
// the source by anyone with browser dev tools.
if (typeof globalThis !== 'undefined' && supabase) {
  globalThis.supabase = supabase;
}
