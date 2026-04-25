import { STATUS_CONFIG } from '../models/application.js';

export function displayValue(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : '\u2014';
}

export function createStatusBadge(status, { id } = {}) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;
  const badge = document.createElement('span');

  if (id) {
    badge.id = id;
  }

  badge.className = 'status-badge';
  badge.textContent = config.label;
  badge.style.backgroundColor = config.badgeBg;
  badge.style.color = config.badgeText;

  return badge;
}
