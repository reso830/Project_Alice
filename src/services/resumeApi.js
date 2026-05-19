import { DEMO_STATUS, getAccessToken, getAuthState } from '../data/authStore.js';

const NETWORK_ERROR = {
  code: 'NETWORK_ERROR',
  message: 'Cannot connect to the backend — is the server running?',
};

export async function parseResume(file) {
  // Demo-mode guard (feature 020). Defense in depth: `ResumeImport.js`
  // already hides the upload affordance in demo via `VISIBLE_STATUSES`,
  // and `ProfileEdit.js` renders an inline note in the slot. If a future
  // call site reaches this function while in demo anyway, fail loudly
  // instead of attempting an unauthenticated POST to `/api/resume/parse`
  // (which `requireAuth` would reject with 401).
  if (getAuthState().status === DEMO_STATUS) {
    throw {
      code: 'DEMO_FEATURE_UNAVAILABLE',
      message: 'Resume import is available after signing in.',
    };
  }

  const body = new globalThis.FormData();
  let response;

  body.append('resume', file);

  const headers = {};
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    response = await globalThis.fetch('/api/resume/parse', {
      method: 'POST',
      headers,
      body,
    });
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
