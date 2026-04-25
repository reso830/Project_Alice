function clampScore(score) {
  const number = Number(score);
  if (Number.isNaN(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, number));
}

function getFillColor(score) {
  if (score >= 80) {
    return '#22C55E';
  }

  if (score >= 60) {
    return '#EAB308';
  }

  return '#4F46E5';
}

export function render(score) {
  const safeScore = clampScore(score);
  const bar = document.createElement('div');
  const fill = document.createElement('div');
  const label = document.createElement('span');

  bar.className = 'compat-bar';
  fill.className = 'compat-bar__fill';
  label.className = 'compat-bar__label';

  fill.style.width = `${safeScore}%`;
  fill.style.backgroundColor = getFillColor(safeScore);
  label.style.color = safeScore >= 50 ? '#FFFFFF' : '#4B5563';
  label.textContent = `${safeScore}%`;

  bar.append(fill, label);

  return bar;
}

export const CompatBar = { render };
