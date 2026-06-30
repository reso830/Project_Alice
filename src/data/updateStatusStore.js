const DEFAULT_STATUS = Object.freeze({ status: 'idle' });

let currentStatus = { ...DEFAULT_STATUS };
const subscribers = new Set();

function normalizeStatus(status) {
  return { ...currentStatus, ...(status ?? {}) };
}

function isSameStatus(nextStatus) {
  const currentKeys = Object.keys(currentStatus);
  const nextKeys = Object.keys(nextStatus);
  return currentKeys.length === nextKeys.length
    && currentKeys.every((key) => Object.is(currentStatus[key], nextStatus[key]));
}

export function getUpdateStatus() {
  return { ...currentStatus };
}

export function setUpdateStatus(status) {
  const nextStatus = normalizeStatus(status);
  if (isSameStatus(nextStatus)) {
    return getUpdateStatus();
  }

  currentStatus = nextStatus;
  const snapshot = getUpdateStatus();
  for (const subscriber of [...subscribers]) {
    subscriber(snapshot);
  }
  return snapshot;
}

export function subscribeUpdateStatus(subscriber, { emit = false } = {}) {
  subscribers.add(subscriber);
  if (emit) {
    subscriber(getUpdateStatus());
  }
  return () => {
    subscribers.delete(subscriber);
  };
}

export function resetUpdateStatusForTesting() {
  currentStatus = { ...DEFAULT_STATUS };
  subscribers.clear();
}
