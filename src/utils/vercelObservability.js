// Shared gate for both Vercel vendor telemetry packages (constitution
// Amendments 1.5.0 / 1.7.0 / 1.7.1). Both @vercel/speed-insights and
// @vercel/analytics decide "production" vs "development" purely from
// `process.env.NODE_ENV`, which only reflects the Vite build mode — a
// portable/local `vite build` is also a "production" build, and neither
// package has any concept of this app's Demo Mode (a client-side auth state,
// not a build or deployment). Relying on the packages' own env detection was
// inaccurate: `npm run dev` still loads an external Vercel debug script, and
// Demo Mode visitors on the real hosted deployment were tracked exactly like
// authenticated users. This module makes both guarantees actually true in
// code instead of only in prose:
//   - injection only happens once the health check confirms `runtime === 'hosted'`
//   - a shared `beforeSend` drops every event for the lifetime of any session
//     that becomes Demo Mode, checked fresh per event (not just at injection time)
//   - the same `beforeSend` also redacts Supabase auth-callback URL artifacts
//     (`#access_token=...`, `?auth=callback`) from whatever URL is about to be
//     reported, as defense-in-depth against the callback URL not yet being
//     scrubbed by the time the first event fires (see WelcomePage's
//     handleVerificationCallback, which strips the query param but not the hash)
import { inject as injectWebAnalytics, pageview } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { DEMO_STATUS, getAuthState } from '../data/authStore.js';

const PAGE_PATHS = {
  tracker: '/',
  calendar: '/calendar',
  profile: '/profile',
  'profile-edit': '/profile/edit',
};

function redactAuthArtifacts(url) {
  if (typeof url !== 'string') {
    return url;
  }
  const [withoutHash] = url.split('#');
  return withoutHash.replace(/([?&])auth=callback(&|$)/, (_match, lead, trail) => (trail ? lead : '')).replace(/[?&]$/, '');
}

function beforeSend(event) {
  if (getAuthState().status === DEMO_STATUS) {
    return null;
  }
  return { ...event, url: redactAuthArtifacts(event.url) };
}

let _enabled = false;

/**
 * Call once the boot-time health check has resolved. No-ops unless
 * `runtime === 'hosted'`, so local mode, the portable package, and dev
 * never load either vendor script at all — not merely a package-level
 * "no-op", an app-level gate.
 */
export function reportVercelObservability({ runtime } = {}) {
  if (runtime !== 'hosted') {
    return;
  }
  _enabled = true;
  injectSpeedInsights({ beforeSend });
  // Auto-track only detects History API navigation; this app's hand-rolled
  // router never calls pushState/replaceState between top-level pages, so
  // auto-track would only ever see the very first load. Manual pageview()
  // calls from navigate() (see reportPageview) cover every navigation after
  // that; auto-track stays on to cover the first load itself.
  injectWebAnalytics({ beforeSend });
}

/**
 * Report an in-app SPA navigation as a Web Analytics pageview. Safe to call
 * unconditionally — a no-op when observability was never enabled (local
 * mode) because the underlying `window.va` queue simply doesn't exist yet.
 */
export function reportPageview(page) {
  if (!_enabled) {
    return;
  }
  pageview({ path: PAGE_PATHS[page] ?? `/${page}` });
}

// Test-only reset for the module-scoped enabled flag.
export function _resetForTesting() {
  _enabled = false;
}
