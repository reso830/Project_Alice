const NETWORK_ERROR_MESSAGE = 'Cannot connect to the backend — is the server running?';

export async function getHealth() {
  let response;

  try {
    response = await globalThis.fetch('/api/health');
  } catch (error) {
    if (error instanceof TypeError) {
      throw {
        code: 'NETWORK_ERROR',
        message: NETWORK_ERROR_MESSAGE,
      };
    }
    throw error;
  }

  if (!response.ok) {
    throw {
      code: 'INTERNAL_ERROR',
      message: 'Health check failed',
    };
  }

  return response.json();
}
