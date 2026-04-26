const NETWORK_ERROR_MESSAGE = 'Cannot connect to the backend — is the server running?';

export async function request(method, path, body) {
  let response;

  try {
    response = await globalThis.fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
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

export function update(id, fields) {
  return request('PATCH', `/api/applications/${id}`, fields);
}
