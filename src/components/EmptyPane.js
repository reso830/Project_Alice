import emptyPaneIcon from '../assets/icons/empty-pane-icon.svg';

export function render() {
  const wrapper = document.createElement('div');
  const art = document.createElement('div');
  const icon = document.createElement('img');
  const title = document.createElement('h2');
  const copy = document.createElement('p');

  wrapper.className = 'empty-pane';
  art.className = 'empty-pane__art';
  icon.className = 'empty-pane__icon';
  icon.src = emptyPaneIcon;
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  title.className = 'empty-pane__title';
  title.textContent = 'Nothing open yet';
  copy.className = 'empty-pane__copy';
  copy.textContent = 'Pick an application on the left and its full breakdown — compatibility, skills, timeline and notes — lands right here.';

  art.setAttribute('aria-hidden', 'true');
  art.append(icon);
  wrapper.append(art, title, copy);

  return wrapper;
}

export const EmptyPane = { render };
