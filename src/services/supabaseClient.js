import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const emailRedirectUrl = import.meta.env.VITE_AUTH_EMAIL_REDIRECT_URL;

// All three VITE_* vars must be present for hosted auth to be considered
// available. The build-time `assertHostedFrontendEnv` plugin already enforces
// this on production builds, but `npm run dev` and custom build modes skip
// that plugin — gating the runtime client construction here so a missing
// `VITE_AUTH_EMAIL_REDIRECT_URL` falls into local mode (or triggers
// ConfigError under hosted runtime) rather than silently sending verification
// emails with `emailRedirectTo: undefined`.
export const supabase = url && anonKey && emailRedirectUrl
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
