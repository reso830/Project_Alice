import { supabase, isHostedAuthAvailable } from '../services/supabaseClient.js';
import * as demoStore from './demoStore.js';

// Status value for the portfolio demo (feature 020). Demo is opt-in from
// the welcome page; refresh always exits the demo because `init()` has no
// path that restores this status.
export const DEMO_STATUS = 'demo';

// Feature 045: Supabase's `detectSessionInUrl` (supabaseClient.js) auto-
// consumes a password-recovery link's URL fragment/query on load. Verified
// directly against the installed @supabase/auth-js@2.105.4 source
// (GoTrueClient.js `_initialize()`/`onAuthStateChange()`; see
// specs/045-auth-password-reset/research.md D1 for the exact lines): a
// freshly-registered onAuthStateChange callback receives an INITIAL_SESSION
// event (carrying whatever session is currently in storage — the just-saved
// recovery session, in this scenario) before the macrotask-deferred
// PASSWORD_RECOVERY event fires. The guard below does not special-case
// INITIAL_SESSION by name — it holds *any* event that isn't literally
// PASSWORD_RECOVERY while armed, which is correct regardless of exactly
// which other event(s) arrive first or what they're called. Left unguarded,
// an early event carrying a real session would transiently resolve
// `authenticated` and could let main.js mount the real app shell for a
// frame before PASSWORD_RECOVERY corrects it — the marker/timeout below
// exist to prevent that.
// Exported so other modules that need to recognize a recovery-shaped URL
// (e.g. WelcomePage.js's verification-callback banner check, which must not
// fire for a recovery link even though it shares the same redirect URL —
// see research.md D4) share this one definition instead of duplicating the
// literal string and risking drift.
export const RECOVERY_URL_MARKER = 'type=recovery';
const RECOVERY_GUARD_TIMEOUT_MS = 8000;

let state = { status: 'initializing', user: null, accessToken: null };
const subscribers = new Set();

function notify() {
  for (const fn of subscribers) {
    fn(state);
  }
}

function sessionToUserAndToken(session) {
  if (session?.user && session.access_token) {
    return { user: { id: session.user.id, email: session.user.email }, accessToken: session.access_token };
  }
  return { user: null, accessToken: null };
}

function applySession(session) {
  const { user, accessToken } = sessionToUserAndToken(session);
  state = { status: user ? 'authenticated' : 'unauthenticated', user, accessToken };
  notify();
}

// Reads the recovery marker synchronously, before any `await` in `init()`,
// so the guard below is armed (or not) deterministically rather than racing
// `getSession()`/`onAuthStateChange`. Mirrors WelcomePage.js's existing
// defensive `typeof globalThis.location === 'undefined'` handling — the
// default Vitest environment for this module's tests is `node`, where
// `location` does not exist at all.
function hasRecoveryUrlMarker() {
  if (typeof globalThis.location === 'undefined') {
    return false;
  }
  const { hash = '', search = '' } = globalThis.location;
  return hash.includes(RECOVERY_URL_MARKER) || search.includes(RECOVERY_URL_MARKER);
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

  // Feature 045: armed only when the URL carries Supabase's recovery marker.
  // While armed, a bare SIGNED_IN is held (not resolved to `authenticated`);
  // only a confirmed PASSWORD_RECOVERY event — or the timeout, for a dead/
  // malformed/already-consumed link — resolves the state. See research.md D1.
  // `guardWasArmed` is immutable (captured once, for the getSession() check
  // below); `guardArmed` is mutable and tracks "still waiting to resolve".
  const guardWasArmed = hasRecoveryUrlMarker();
  let guardArmed = guardWasArmed;
  let guardTimer = null;

  function disarmGuard() {
    guardArmed = false;
    if (guardTimer) {
      clearTimeout(guardTimer);
      guardTimer = null;
    }
  }

  function resolveRecoveryExpired() {
    if (!guardArmed) return;
    disarmGuard();
    state = { status: 'recovery-expired', user: null, accessToken: null };
    notify();
  }

  function resolvePasswordRecovery(session) {
    disarmGuard();
    const { user, accessToken } = sessionToUserAndToken(session);
    state = { status: 'password-recovery', user, accessToken };
    notify();
  }

  if (guardArmed) {
    guardTimer = setTimeout(resolveRecoveryExpired, RECOVERY_GUARD_TIMEOUT_MS);
  }

  // Registered before awaiting getSession() (previously the reverse) so a
  // PASSWORD_RECOVERY event arriving during that await is never missed.
  supabase.auth.onAuthStateChange((evt, session) => {
    // Feature 020: while the visitor is in the portfolio demo, ignore
    // Supabase auth events. Demo is exited explicitly via `exitDemo()`
    // or by a page refresh (FR-005). Letting a SIGNED_IN/SIGNED_OUT
    // event from another tab silently flip state to 'authenticated'
    // would leave the app shell mounted while the tracker keeps
    // showing in-memory demo rows AND the service-layer mode switch
    // re-routes to the real backend — so a click on a demo seed id
    // would mutate the signed-in user's actual data.
    if (state.status === DEMO_STATUS) return;
    if (guardArmed) {
      if (evt === 'PASSWORD_RECOVERY') {
        resolvePasswordRecovery(session);
      }
      // Any other event (notably INITIAL_SESSION, which auth-js emits to
      // every newly-registered subscriber and would carry the just-saved
      // recovery session here) is held while armed — intentionally not
      // applied, regardless of the event's name.
      return;
    }
    applySession(session);
  });

  const { data } = await supabase.auth.getSession();
  // Skip entirely if the guard was ever armed (whether still pending or
  // already resolved by an event) — once armed, the guard's own handlers
  // are the sole source of truth; `getSession()`'s result here would
  // otherwise re-resolve `authenticated` and clobber a just-set
  // `password-recovery` state on the arrived-before-getSession-resolved race.
  if (!guardWasArmed) {
    applySession(data?.session ?? null);
  }
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
