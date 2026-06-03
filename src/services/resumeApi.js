import { DEMO_STATUS, getAccessToken, getAuthState } from '../data/authStore.js';

const NETWORK_ERROR = {
  code: 'NETWORK_ERROR',
  message: 'Cannot connect to the backend — is the server running?',
};

const DEMO_ERROR = {
  code: 'DEMO_FEATURE_UNAVAILABLE',
  message: 'Resume import is available after signing in.',
};

function assertNotDemo() {
  // Demo-mode guard (feature 020). Defense in depth: `ResumeImport.js`
  // already hides the upload affordance in demo via `VISIBLE_STATUSES`,
  // and `ProfileEdit.js` renders an inline note in the slot. If a future
  // call site reaches this function while in demo anyway, fail loudly
  // instead of attempting an unauthenticated POST to `/api/resume/parse`
  // (which `requireAuth` would reject with 401).
  if (getAuthState().status === DEMO_STATUS) {
    throw { ...DEMO_ERROR };
  }
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function requestJson(url, options) {
  let response;

  try {
    response = await globalThis.fetch(url, options);
  } catch (error) {
    if (error instanceof TypeError) {
      throw { ...NETWORK_ERROR };
    }

    throw error;
  }

  const payload = await response.json();

  if (!response.ok) {
    throw payload.error ?? {
      code: 'INTERNAL_ERROR',
      message: 'Request failed',
    };
  }

  return payload.data;
}

export async function parseResume(file) {
  assertNotDemo();
  const body = new globalThis.FormData();

  body.append('resume', file);

  return requestJson('/api/resume/parse', {
    method: 'POST',
    headers: authHeaders(),
    body,
  });
}

export async function extractText(file) {
  assertNotDemo();
  const body = new globalThis.FormData();

  body.append('resume', file);

  const data = await requestJson('/api/resume/extract', {
    method: 'POST',
    headers: authHeaders(),
    body,
  });

  return data.text;
}

export async function parseText(text) {
  assertNotDemo();

  return requestJson('/api/resume/parse', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text }),
  });
}
