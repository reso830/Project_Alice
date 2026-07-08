import errorPaneIcon from '../assets/icons/error-pane-icon.svg';

export function render({ title, message, onRetry, retryLabel = 'Try again', code = 'ERROR' } = {}) {
  const wrapper = document.createElement('div');
  const art = document.createElement('div');
  const icon = document.createElement('img');
  const badge = document.createElement('p');
  const badgeDot = document.createElement('span');
  const badgeLabel = document.createElement('span');
  const titleEl = document.createElement('h2');
  const copy = document.createElement('p');

  wrapper.className = 'error-pane';
  wrapper.setAttribute('role', 'alert');
  wrapper.setAttribute('aria-live', 'polite');
  art.className = 'error-pane__art';
  icon.className = 'error-pane__icon';
  icon.src = errorPaneIcon;
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  art.setAttribute('aria-hidden', 'true');
  art.append(icon);

  badge.className = 'error-pane__badge';
  badgeDot.className = 'error-pane__badge-dot';
  badgeDot.setAttribute('aria-hidden', 'true');
  badgeLabel.textContent = `ERROR · ${code}`;
  badge.append(badgeDot, badgeLabel);

  titleEl.className = 'error-pane__title';
  titleEl.textContent = title;

  copy.className = 'error-pane__copy';
  copy.textContent = message;

  wrapper.append(art, badge, titleEl, copy);

  if (typeof onRetry === 'function') {
    const actions = document.createElement('div');
    const retryButton = document.createElement('button');
    const hint = document.createElement('span');

    actions.className = 'error-pane__actions';
    retryButton.className = 'error-pane__retry';
    retryButton.type = 'button';
    retryButton.textContent = retryLabel;
    retryButton.addEventListener('click', () => onRetry());

    hint.className = 'error-pane__hint';
    hint.textContent = 'or check back in a moment';

    actions.append(retryButton, hint);
    wrapper.append(actions);
  }

  return wrapper;
}

export const ErrorPane = { render };
