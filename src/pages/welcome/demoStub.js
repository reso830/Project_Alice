// Entry point for the portfolio demo CTA (feature 020). Both the
// welcome page's "Try the demo" button (`WelcomePage.js`) and the auth
// modal's footer demo button (`AuthOverlay.js`) call `enterDemo()` from
// this module. The wrapper exists so tests can stub at this boundary
// independently of `authStore`, and so future demo entry points (e.g.
// a URL-based deep link) have one place to land.
//
// The actual mode flip and seed load live in `authStore.enterDemo()`;
// do NOT also call `demoStore.loadSeed()` here — single source of truth.

import { enterDemo as authEnterDemo } from '../../data/authStore.js';

export function enterDemo() {
  authEnterDemo();
}
