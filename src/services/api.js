import { getAccessToken } from '../data/authStore.js';

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

export function create(fields) {
  return request('POST', '/api/applications', fields);
}

export function getAll() {
  return request('GET', '/api/applications');
}

export function getProfile() {
  return request('GET', '/api/profile');
}

export function getById(id) {
  return request('GET', `/api/applications/${id}`);
}

export function update(id, fields, { signal } = {}) {
  return request('PATCH', `/api/applications/${id}`, fields, { signal });
}

export function archive(id) {
  return request('POST', `/api/applications/${id}/archive`);
}

export function saveProfile(profile) {
  return request('PUT', '/api/profile', profile);
}
