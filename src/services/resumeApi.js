const NETWORK_ERROR = {
  code: 'NETWORK_ERROR',
  message: 'Cannot connect to the backend — is the server running?',
};

export async function parseResume(file) {
  const body = new globalThis.FormData();
  let response;

  body.append('resume', file);

  try {
    response = await globalThis.fetch('/api/resume/parse', {
      method: 'POST',
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
