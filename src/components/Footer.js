const ISSUE_URL = 'https://github.com/reso830/Project_Alice/issues/new';

function createText(className, text) {
  const element = document.createElement('p');

  element.className = className;
  element.textContent = text;

  return element;
}

function createSection(labelText, values) {
  const section = document.createElement('section');
  const label = document.createElement('h2');

  section.className = 'footer__section';
  label.className = 'footer__label';
  label.textContent = labelText;
  section.append(label);

  for (const value of values) {
    section.append(createText('footer__value', value));
  }

  return section;
}

function createBrandIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.classList.add('footer__brand-icon');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');

  rect.setAttribute('x', '1');
  rect.setAttribute('y', '1');
  rect.setAttribute('width', '18');
  rect.setAttribute('height', '18');
  rect.setAttribute('rx', '4');
  rect.setAttribute('fill', '#4F46E5');

  path.setAttribute('d', 'M6 10.5L9 13.5L14 7');
  path.setAttribute('stroke', 'white');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');

  svg.append(rect, path);

  return svg;
}

function createBrand() {
  const brand = document.createElement('div');
  const name = document.createElement('span');
  const tagline = document.createElement('span');

  brand.className = 'footer__brand';
  name.className = 'footer__brand-name';
  tagline.className = 'footer__tagline';
  name.textContent = 'Project Alice';
  tagline.textContent = 'Your job search, organized.';

  brand.append(createBrandIcon(), name, tagline);

  return brand;
}

function createFeedbackLink(text, label) {
  const link = document.createElement('a');

  link.className = 'footer__link';
  link.href = ISSUE_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = text;
  link.setAttribute('aria-label', label);

  return link;
}

function createFeedback() {
  const section = document.createElement('section');
  const label = document.createElement('h2');

  section.className = 'footer__section footer__feedback';
  label.className = 'footer__label';
  label.textContent = 'FEEDBACK';
  section.append(
    label,
    createFeedbackLink('Report an issue', 'Report an issue on GitHub'),
    createFeedbackLink('Request a feature', 'Request a feature on GitHub'),
  );

  return section;
}

export function render() {
  const footer = document.createElement('footer');
  const inner = document.createElement('div');
  const rule = document.createElement('hr');

  footer.className = 'site-footer';
  inner.className = 'footer__inner';
  rule.className = 'footer__rule';

  inner.append(
    createBrand(),
    rule,
    createSection('VERSION', ['v0.2.0', 'Built Apr 2026']),
    createSection('STACK', ['Vanilla JS \u00b7 Vite', 'Vitest \u00b7 ESLint']),
    createFeedback(),
    createText(
      'footer__copyright',
      "\u00a9 2026 Project Alice. All rights reserved. \u00b7 Part of reso's Project Series.",
    ),
  );
  footer.append(inner);

  return footer;
}

export const Footer = { render };
