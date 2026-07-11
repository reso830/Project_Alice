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

// Feature 045, live-verification finding (2026-07-10, Browser Smoke Test):
// Supabase's *success*-path redirect carries `type=recovery`, but its
// *failure*-path redirect for an expired/invalid/already-used recovery
// token does not — it goes straight to `#error=...&error_code=otp_expired
// &error_description=...` with no recovery marker at all. RECOVERY_URL_
// MARKER alone therefore cannot detect a failed recovery attempt: neither
// this guard nor WelcomePage.js's verification-banner check could tell it
// apart from an ordinary page load, so the app fell through to a plain
// `unauthenticated` boot and wrongly showed the signup-verification "Email
// verified" banner instead of a dedicated expired-link state.
//
// Fixed by having ForgotPasswordForm.js's `resetPasswordForEmail` call
// append this marker to its own `redirectTo` (via `withRecoveryFlowMarker`
// below) — Supabase preserves whatever base URL it's given as `redirect_to`
// on *both* success and failure (it only appends its own tokens/`type=
// recovery`, or `error=...`, on top), so this marker survives regardless of
// outcome. Deliberately a distinct query param (not reusing `type`) so it
// can't collide with any current or future Supabase-native parameter, and
// deliberately scoped to the recovery flow only — SignupForm.js's plain,
// unmarked `emailRedirectUrl` is unaffected, so an expired *signup*-
// verification link can never be misclassified as an expired *password-
// reset* link.
export const RECOVERY_FLOW_MARKER = 'flow=recovery';
const [RECOVERY_FLOW_PARAM, RECOVERY_FLOW_VALUE] = RECOVERY_FLOW_MARKER.split('=');

/**
 * Appends RECOVERY_FLOW_MARKER to a redirect URL. Used by ForgotPasswordForm.js
 * when calling `resetPasswordForEmail`; falls back to the raw input
 * unmodified if it isn't a parseable absolute URL (defensive only — the
 * documented `VITE_AUTH_EMAIL_REDIRECT_URL` value is always absolute).
 */
export function withRecoveryFlowMarker(redirectUrl) {
  try {
    const url = new URL(redirectUrl);
    url.searchParams.set(RECOVERY_FLOW_PARAM, RECOVERY_FLOW_VALUE);
    return url.toString();
  } catch {
    return redirectUrl;
  }
}

const RECOVERY_GUARD_TIMEOUT_MS = 8000;

let state = { status: 'initializing', user: null, accessToken: null };
const subscribers = new Set();
// Module-level (not local to init()) so `clearRecoveryGuard()` below can
// release it from outside init()'s own closure — see that function's own
// comment for why an external release path is needed at all. Reset at the
// top of every init() call (matches every other per-boot guard variable).
let recoveryGuardResolved = false;

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

// Mirrors WelcomePage.js's existing defensive `typeof globalThis.location
// === 'undefined'` handling — the default Vitest environment for this
// module's tests is `node`, where `location` does not exist at all.
function currentUrlIncludes(marker) {
  if (typeof globalThis.location === 'undefined') {
    return false;
  }
  const { hash = '', search = '' } = globalThis.location;
  return hash.includes(marker) || search.includes(marker);
}

// Reads the recovery marker synchronously, before any `await` in `init()`,
// so the guard below is armed (or not) deterministically rather than racing
// `getSession()`/`onAuthStateChange`. True for either marker — Supabase's
// own success-path `type=recovery`, or our own failure-surviving `flow=
// recovery` (see RECOVERY_FLOW_MARKER above).
function hasRecoveryUrlMarker() {
  return currentUrlIncludes(RECOVERY_URL_MARKER) || currentUrlIncludes(RECOVERY_FLOW_MARKER);
}

// True when the current URL is both a recovery attempt (per the above) and
// carries a Supabase-reported failure (`error=...`/`error_code=...`) — i.e.
// an expired/invalid/already-used recovery link, confirmed by Supabase
// itself rather than merely inferred from a timeout. Deliberately gated on
// hasRecoveryUrlMarker() first: a bare `error=...` with neither recovery
// marker present (e.g. a failed *signup*-verification link, which shares
// the same redirect URL but never carries flow=recovery) must not be
// treated as an expired password-reset link.
function hasRecoveryErrorMarker() {
  return hasRecoveryUrlMarker() && (currentUrlIncludes('error=') || currentUrlIncludes('error_code='));
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

  // Feature 045: armed only when the URL carries a recovery marker (either
  // Supabase's own success-path `type=recovery`, or our own failure-
  // surviving `flow=recovery` — see RECOVERY_FLOW_MARKER above). While
  // armed, a bare SIGNED_IN is held (not resolved to `authenticated`); only
  // a confirmed PASSWORD_RECOVERY event, an explicit Supabase-reported
  // failure, or the timeout (for a dead/malformed link with no explicit
  // error) resolves the state. See research.md D1.
  // `guardWasArmed` is immutable (captured once, for the getSession() check
  // below); `guardArmed` is mutable and tracks "still waiting to resolve".
  const guardWasArmed = hasRecoveryUrlMarker();
  let guardArmed = guardWasArmed;
  let guardTimer = null;
  // Live-browser finding (2026-07-11, via temporary diagnostic logging):
  // a real deployed build can deliver a SECOND event — an extra
  // INITIAL_SESSION — after PASSWORD_RECOVERY has already fired and
  // resolved, contradicting research.md D1's assumption (based on a single
  // registration's expected ordering) that PASSWORD_RECOVERY is the last
  // word. The original design fully "opened the gate" the instant
  // PASSWORD_RECOVERY resolved (`guardArmed = false`), so that second event
  // fell straight through to `applySession()` and silently overwrote
  // `password-recovery` with `authenticated` — main.js briefly mounted the
  // Reset Password overlay, then immediately swapped it for Tracker.
  //
  // The same gap existed for `recovery-expired` too (found in a follow-up
  // real-browser test, same day): a later unguarded event resolving
  // `applySession(null)` -> `unauthenticated` tripped main.js's Phase 04
  // "an ended recovery session returns to login" logic, silently bouncing
  // the user off the expired-link screen onto the login view before they
  // could see it.
  //
  // `recoveryGuardResolved` (module-level — see its own declaration) closes
  // both gaps: once EITHER outcome is reached, only an explicit SIGNED_OUT
  // (the real success/abandon paths' own `signOut()` call) or an explicit
  // `clearRecoveryGuard()` call is allowed through; every other event is
  // held for the rest of this page load, regardless of what session it
  // carries. `recovery-expired`'s own legitimate actions ("Request a new
  // link", closing the overlay) never fire a SIGNED_OUT — there was never a
  // session to sign out of — so without `clearRecoveryGuard()`, the guard
  // would latch permanently and silently swallow the user's next ordinary
  // sign-in for the rest of the page load (code-review finding, 2026-07-11
  // — see that function's own comment). AuthOverlay.js calls it when
  // leaving the `recovery-expired` view for any reason other than a real
  // sign-out.
  recoveryGuardResolved = false;

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
    recoveryGuardResolved = true;
    state = { status: 'recovery-expired', user: null, accessToken: null };
    notify();
  }

  function resolvePasswordRecovery(session) {
    disarmGuard();
    recoveryGuardResolved = true;
    const { user, accessToken } = sessionToUserAndToken(session);
    state = { status: 'password-recovery', user, accessToken };
    notify();
  }

  if (guardArmed) {
    if (hasRecoveryErrorMarker()) {
      // Supabase has already told us this attempt failed (expired/invalid/
      // already-used token) — resolve immediately rather than waiting out
      // the full guard timeout for a PASSWORD_RECOVERY event a failed
      // attempt will never produce (which would otherwise leave the app
      // rendering nothing — still `initializing` — for up to 8s).
      resolveRecoveryExpired();
    } else {
      guardTimer = setTimeout(resolveRecoveryExpired, RECOVERY_GUARD_TIMEOUT_MS);
    }
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
    if (recoveryGuardResolved) {
      // The recovery guard has already resolved (password-recovery or
      // recovery-expired) — hold everything except a genuine sign-out (the
      // success path's post-update signOut(), or the abandon path's
      // close()-triggered one). See recoveryGuardResolved's own comment
      // above for why this exists.
      if (evt === 'SIGNED_OUT') {
        recoveryGuardResolved = false;
        applySession(session);
      }
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

/**
 * Releases a latched recovery guard without a real sign-out. Code-review
 * finding (2026-07-11): `recovery-expired` sets the same
 * `recoveryGuardResolved` latch `password-recovery` does, but never
 * establishes a session in the first place — its own legitimate exits
 * ("Request a new link", closing the overlay) have nothing to sign out of,
 * so they never fire the `SIGNED_OUT` event that's the only other thing
 * that clears it. Left uncleared, the guard would hold every subsequent
 * auth event — including the user's next ordinary, successful sign-in —
 * for the rest of the page load, forcing a hard refresh to log in.
 * AuthOverlay.js calls this when leaving the `recovery-expired` view any
 * other way. Idempotent / safe to call when nothing is latched.
 */
export function clearRecoveryGuard() {
  recoveryGuardResolved = false;
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
