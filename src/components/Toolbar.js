let _badge = null;

function getCountLabel(count) {
  return `${count} Applications`;
}

export function updateCount(count) {
  if (_badge) {
    _badge.textContent = getCountLabel(count);
  }
}

export function render(count) {
  const toolbar = document.createElement('div');
  const badge = document.createElement('span');

  toolbar.className = 'toolbar';
  badge.className = 'count-badge';
  badge.setAttribute('aria-live', 'polite');
  badge.textContent = getCountLabel(count);

  toolbar.append(badge);
  _badge = badge;

  return toolbar;
}

export const Toolbar = { render, updateCount };
