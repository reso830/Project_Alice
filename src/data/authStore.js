import { supabase, isHostedAuthAvailable } from '../services/supabaseClient.js';
import * as demoStore from './demoStore.js';

// Status value for the portfolio demo (feature 020). Demo is opt-in from
// the welcome page; refresh always exits the demo because `init()` has no
// path that restores this status.
export const DEMO_STATUS = 'demo';

let state = { status: 'initializing', user: null, accessToken: null };
const subscribers = new Set();

function notify() {
  for (const fn of subscribers) {
    fn(state);
  }
}

function applySession(session) {
  if (session?.user && session.access_token) {
    state = {
      status: 'authenticated',
      user: { id: session.user.id, email: session.user.email },
      accessToken: session.access_token,
    };
  } else {
    state = { status: 'unauthenticated', user: null, accessToken: null };
  }
  notify();
}

export function getAuthState() {
  return state;
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function getAccessToken() {
  return state.accessToken;
}

export async function init() {
  if (!isHostedAuthAvailable) {
    state = { status: 'local-mode', user: null, accessToken: null };
    notify();
    return;
  }

  const { data } = await supabase.auth.getSession();
  applySession(data?.session ?? null);
  supabase.auth.onAuthStateChange((_evt, session) => {
    // Feature 020: while the visitor is in the portfolio demo, ignore
    // Supabase auth events. Demo is exited explicitly via `exitDemo()`
    // or by a page refresh (FR-005). Letting a SIGNED_IN/SIGNED_OUT
    // event from another tab silently flip state to 'authenticated'
    // would leave the app shell mounted while the tracker keeps
    // showing in-memory demo rows AND the service-layer mode switch
    // re-routes to the real backend — so a click on a demo seed id
    // would mutate the signed-in user's actual data.
    if (state.status === DEMO_STATUS) return;
    applySession(session);
  });
}

export async function signOut() {
  if (supabase) {
    await supabase.auth.signOut();
  }
}

// One-shot message surfaced after a sign-out reroute to Welcome (feature 030).
// Carried here (not shown here — the data layer stays UI-free) because the
// reroute clears document.body, so a toast shown before sign-out would vanish.
// Covers both the involuntary deleted-account case (FR-011a) and the voluntary
// account-deletion success confirmation (FR-013 / US1).
export const ACCOUNT_DELETED_NOTICE = 'Your account no longer exists.';
let _authNotice = null;

/**
 * Stage a one-shot notice `{ message, type }` to be shown by the Welcome-mount
 * path after the next sign-out reroute. `type` matches Toast's API
 * (`'success'` | `'error'`). Passing a falsy message clears any pending notice.
 */
export function setAuthNotice(message, type = 'error') {
  _authNotice = message ? { message, type } : null;
}

/**
 * Read and clear the pending sign-out notice (one-shot). Returns
 * `{ message, type }` or `null` when there is nothing to show.
 */
export function consumeAuthNotice() {
  const notice = _authNotice;
  _authNotice = null;
  return notice;
}

// Re-entrancy guard so a burst of failed requests triggers at most one
// `getUser()` round-trip (feature 030 FR-011a).
let _revalidating = false;

/**
 * Revalidate the current session after an authenticated request failed in a
 * way that could mean the account no longer exists (e.g. it was deleted from
 * another device — feature 030). An unexpired access token still passes
 * `requireAuth`, so the failure surfaces as a 500/404 rather than a clean
 * 401; this confirms the account's existence out-of-band via `getUser()` and,
 * if it is gone, signs out so the app routes to the Welcome page.
 *
 * A still-valid user is a no-op — a legitimate transient 404/500 never signs
 * the user out. Network errors during the check are swallowed for the same
 * reason. No-ops in demo / local mode (no hosted account to revalidate).
 */
export async function handleAuthFailure() {
  if (!isHostedAuthAvailable || !supabase) {
    return;
  }
  if (state.status === DEMO_STATUS || state.status === 'local-mode') {
    return;
  }
  if (_revalidating) {
    return;
  }

  _revalidating = true;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      // Carry the reason so the Welcome-mount path can surface it (FR-011a).
      setAuthNotice(ACCOUNT_DELETED_NOTICE, 'error');
      await signOut();
    }
  } catch {
    // Transient failure (e.g. network) — cannot confirm the account is gone,
    // so do not sign out.
  } finally {
    _revalidating = false;
  }
}

export function enterDemo() {
  demoStore.loadSeed();
  state = { status: DEMO_STATUS, user: null, accessToken: null };
  notify();
}

export function exitDemo() {
  demoStore.clear();
  state = { status: 'unauthenticated', user: null, accessToken: null };
  notify();
}
