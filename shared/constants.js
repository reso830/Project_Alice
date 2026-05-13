import { STATUS_CONFIG, STATUS_VALUES } from '../src/models/application.js';

export { STATUS_VALUES };
export { getValidTransitions, isValidTransition, TERMINAL_STATES } from '../src/models/application.js';

export const STATUS_COLORS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([status, config]) => [status, config.borderAccent]),
);

export const STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([status, config]) => [status, config.label]),
);
