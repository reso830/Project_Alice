export function createLlmError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  if (status) {
    error.status = status;
  }
  return error;
}

export function mapErrorToReason(errorOrStatus) {
  const status = typeof errorOrStatus === 'number'
    ? errorOrStatus
    : errorOrStatus?.status;
  const code = typeof errorOrStatus === 'string'
    ? errorOrStatus
    : errorOrStatus?.code;
  const name = errorOrStatus?.name;

  if (code === 'NO_TEXT' || code === 'LLM_EMPTY_RESPONSE') {
    return 'NO_TEXT';
  }

  if (code === 'LLM_TIMEOUT' || name === 'AbortError' || status === 408) {
    return 'timeout';
  }

  if (code === 'LLM_NETWORK_ERROR') {
    return 'network';
  }

  if (status === 401 || status === 403) {
    return 'invalid_key';
  }

  if (status === 402) {
    return 'quota';
  }

  if (status === 429) {
    return 'rate_limit';
  }

  if (status >= 400 && status <= 499) {
    return 'bad_request';
  }

  if (status >= 500 && status <= 599) {
    return 'server';
  }

  return 'server';
}
