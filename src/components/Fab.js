const SVG_NS = 'http://www.w3.org/2000/svg';

function createPlusIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'fab__icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M12 5v14M5 12h14');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.4');
  path.setAttribute('stroke-linecap', 'round');

  svg.append(path);
  return svg;
}

export function render({ onClick, ariaLabel = 'New application' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fab';
  button.setAttribute('aria-label', ariaLabel);

  button.append(createPlusIcon());

  if (typeof onClick === 'function') {
    button.addEventListener('click', onClick);
  }

  return button;
}

export const Fab = { render };
