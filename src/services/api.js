import { DEMO_STATUS, getAccessToken, getAuthState, handleAuthFailure } from '../data/authStore.js';
import * as demoStore from '../data/demoStore.js';
import { toISODate } from '../utils/date.js';

const NETWORK_ERROR_MESSAGE = 'Cannot connect to the backend — is the server running?';

export async function request(method, path, body, { signal } = {}) {
  let response;

  // X-Client-Date carries the user's *local* YYYY-MM-DD. The server uses
  // it to stamp audit columns (created_at, updated_at, last_status_update)
  // in the user's wall-clock timezone instead of the deploy region's UTC.
  // See server/middleware/requestDate.js and issue #43.
  const headers = {
    'Content-Type': 'application/json',
    'X-Client-Date': toISODate(),
  };
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    response = await globalThis.fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw {
        code: 'NETWORK_ERROR',
        message: NETWORK_ERROR_MESSAGE,
      };
    }

    throw error;
  }

  const payload = await response.json();

  if (!response.ok) {
    const error = payload.error ?? {};
    const code = error.code ?? 'INTERNAL_ERROR';

    // Session revalidation (feature 030 FR-011a). When an authenticated
    // request fails in a way that could mean the account was deleted from
    // another device, revalidate out-of-band and reroute to Welcome if it's
    // gone. Triggers on UNAUTHORIZED, a 404/500 (the stale-session delete-race
    // surfaces as those — see specs/030 research R-4), or INVALID_PASSWORD (a
    // deleted account makes the delete endpoint's password recheck fail with
    // that code even though the password is correct). Excludes 400 validation
    // errors. Safe across the board because handleAuthFailure() no-ops when
    // getUser() confirms the account still exists — a genuinely wrong password
    // keeps the modal's inline error and never signs the user out.
    // Fire-and-forget so the original rejection still propagates.
    if (
      token
      && (code === 'UNAUTHORIZED'
        || code === 'INVALID_PASSWORD'
        || response.status === 404
        || response.status === 500)
    ) {
      handleAuthFailure();
    }

    throw {
      code,
      message: error.message ?? 'Request failed',
      fields: error.fields,
    };
  }

  return payload.data;
}

// Demo-mode mode switch (feature 020). When the visitor is in the
// portfolio demo, every service-layer write/read delegates to the
// in-memory `demoStore` and `globalThis.fetch` is never called. The
// canonical regression guard lives in `tests/services/api.demo.test.js`
// — keep this single seam intact; new service exports MUST add a demo
// branch and a no-fetch assertion.
function isDemo() {
  return getAuthState().status === DEMO_STATUS;
}

// Synchronous demoStore calls can throw `{ code, message, fields? }`
// objects that the network branch would surface as a rejected Promise
// from a 400/404 response. Bridge sync throws into rejections so callers
// can `await` either branch identically.
function fromDemo(fn) {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err);
  }
}

export function create(fields) {
  if (isDemo()) return fromDemo(() => demoStore.create(fields));
  return request('POST', '/api/applications', fields);
}

export function getAll({ view } = {}) {
  if (isDemo()) {
    return Promise.resolve(
      view === 'archived' ? demoStore.getAllArchived() : demoStore.getAll(),
    );
  }
  const query = view === 'archived' ? '?view=archived' : '';
  return request('GET', `/api/applications${query}`);
}

export function getProfile() {
  if (isDemo()) return Promise.resolve(demoStore.getProfile());
  return request('GET', '/api/profile');
}

export function getById(id) {
  if (isDemo()) return Promise.resolve(demoStore.getById(id));
  return request('GET', `/api/applications/${id}`);
}

export function update(id, fields, { signal } = {}) {
  if (isDemo()) return fromDemo(() => demoStore.update(id, fields));
  return request('PATCH', `/api/applications/${id}`, fields, { signal });
}

export function archive(id) {
  if (isDemo()) return fromDemo(() => demoStore.archive(id));
  return request('POST', `/api/applications/${id}/archive`);
}

export function unarchive(id) {
  if (isDemo()) return fromDemo(() => demoStore.unarchive(id));
  return request('POST', `/api/applications/${id}/unarchive`);
}

export function saveProfile(profile) {
  if (isDemo()) return fromDemo(() => demoStore.saveProfile(profile));
  return request('PUT', '/api/profile', profile);
}

export function saveCompatNotes(id, { summary, body }) {
  if (isDemo()) return fromDemo(() => demoStore.saveCompatNotes(id, { summary, body }));
  return request('POST', `/api/applications/${id}/compat-notes`, { summary, body });
}

// Account deletion (hosted) / clear all data (local). The caller passes the
// mode-appropriate body: hosted `{ password }`, local `{ confirm: 'DELETE' }`.
// Demo has no real account — short-circuit with a no-fetch rejection to keep
// the 020 demo seam intact (the UI disables the control, so this is unreached).
export function deleteAccount(payload = {}) {
  if (isDemo()) {
    return fromDemo(() => {
      throw {
        code: 'DEMO_UNAVAILABLE',
        message: 'Account deletion is not available in the demo.',
      };
    });
  }
  return request('DELETE', '/api/account', payload);
}
