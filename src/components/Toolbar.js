let _badge = null;

export function updateCount(count) {
  if (_badge) {
    _badge.textContent = String(count);
    _badge.setAttribute('aria-label', `${count} applications`);
  }
}

export function render(count) {
  const toolbar = document.createElement('div');
  const label = document.createElement('span');
  const badge = document.createElement('span');

  toolbar.className = 'toolbar';
  label.className = 'toolbar__label';
  label.textContent = 'All Applications';
  badge.className = 'count-badge';
  badge.setAttribute('aria-live', 'polite');
  badge.setAttribute('aria-label', `${count} applications`);
  badge.textContent = String(count);

  toolbar.append(label, badge);
  _badge = badge;

  return toolbar;
}

export const Toolbar = { render, updateCount };
