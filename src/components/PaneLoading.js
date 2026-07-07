export function render() {
  const wrapper = document.createElement('div');
  const spinner = document.createElement('div');
  const message = document.createElement('p');

  wrapper.className = 'pane-loading';
  wrapper.setAttribute('aria-busy', 'true');
  wrapper.setAttribute('aria-live', 'polite');
  spinner.className = 'pane-loading__spinner';
  spinner.setAttribute('aria-hidden', 'true');
  message.className = 'pane-loading__message';
  message.textContent = 'Loading application details…';

  wrapper.append(spinner, message);

  return wrapper;
}

export const PaneLoading = { render };
