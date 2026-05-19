import { DEMO_STATUS, getAccessToken, getAuthState } from '../data/authStore.js';
import * as demoStore from '../data/demoStore.js';

const NETWORK_ERROR_MESSAGE = 'Cannot connect to the backend — is the server running?';

export async function request(method, path, body, { signal } = {}) {
  let response;

  const headers = { 'Content-Type': 'application/json' };
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
    throw {
      code: error.code ?? 'INTERNAL_ERROR',
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

export function getAll() {
  if (isDemo()) return Promise.resolve(demoStore.getAll());
  return request('GET', '/api/applications');
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

export function saveProfile(profile) {
  if (isDemo()) return fromDemo(() => demoStore.saveProfile(profile));
  return request('PUT', '/api/profile', profile);
}
