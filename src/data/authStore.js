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
