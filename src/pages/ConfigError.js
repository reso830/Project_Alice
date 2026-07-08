import aliceSigil from '../assets/logo/alice-sigil-full.svg';

let _container = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

export function mount(container) {
  if (_container) {
    unmount();
  }
  _container = container;

  const page = el('div', 'config-error');
  page.setAttribute('role', 'alert');

  const brand = el('div', 'config-error__brand');
  const mark = document.createElement('img');
  mark.className = 'config-error__brand-mark';
  mark.src = aliceSigil;
  mark.alt = '';
  const wordmark = el('span', 'config-error__brand-text', 'Project Alice');
  brand.append(mark, wordmark);

  const headline = el('h1', 'config-error__headline', 'Configuration Error');
  const body = el(
    'p',
    'config-error__body',
    'This deployment is misconfigured. Contact the operator.',
  );

  page.append(brand, headline, body);
  container.replaceChildren(page);
}

export function unmount() {
  if (_container) {
    _container.replaceChildren();
  }
  _container = null;
}

export const ConfigError = { mount, unmount };
