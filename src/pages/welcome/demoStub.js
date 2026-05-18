import { Toast } from '../../components/Toast.js';

// Phase 14 stub for the "Try the demo" CTA on the welcome page and the
// Auth Modal demo button (the modal wiring lands in Phase 17). When feature
// 020 ships the real demo-route handler, replace this file's call sites in
// `WelcomePage.js` and `AuthOverlay.js` with the actual navigation/load —
// this is the single call site to update.
//
// Per FR-023: `window.alert()` is forbidden; the user-facing surface MUST
// be the existing Toast component.

const DEMO_COMING_SOON_MESSAGE =
  'Demo coming soon — the public preview lands in a later release.';

export function showDemoComingSoon() {
  Toast.show(DEMO_COMING_SOON_MESSAGE, 'success');
}
