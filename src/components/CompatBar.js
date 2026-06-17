import { getCompatLabel } from '../models/compatibility.js';

function clampScore(score) {
  const number = Number(score);
  if (Number.isNaN(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

function getFillColor(score) {
  const label = getCompatLabel(score);

  if (label === 'Great') {
    return '#2563EB';
  }

  if (label === 'High') {
    return '#15803D';
  }

  if (label === 'Medium') {
    return '#EAB308';
  }

  return '#EF4444';
}

function getLabelColor(score) {
  const label = getCompatLabel(score);

  return label === 'High' || label === 'Great' ? '#FFFFFF' : '#111827';
}

export function render(score) {
  const safeScore = clampScore(score);
  const compatLabel = getCompatLabel(safeScore);
  const bar = document.createElement('div');
  const fill = document.createElement('div');
  const label = document.createElement('span');

  bar.className = 'compat-bar';
  fill.className = 'compat-bar__fill';
  label.className = 'compat-bar__label';

  fill.style.width = `${safeScore}%`;
  fill.style.backgroundColor = getFillColor(safeScore);
  label.style.color = getLabelColor(safeScore);
  label.textContent = `${safeScore}% ${compatLabel}`;

  bar.append(fill, label);

  return bar;
}

export const CompatBar = { render };
