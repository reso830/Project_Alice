import aliceWhite from '../assets/Alice_White.png';

const ISSUE_URL = 'https://github.com/reso830/Project_Alice/issues/new';

function createText(className, text) {
  const element = document.createElement('p');

  element.className = className;
  element.textContent = text;

  return element;
}

function createSection(labelText, values) {
  const section = document.createElement('section');
  const label = document.createElement('p');

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
  const img = document.createElement('img');

  img.className = 'footer__brand-icon';
  img.src = aliceWhite;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');

  return img;
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
  const label = document.createElement('p');

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
    createSection('VERSION', ['v0.3.0', 'Built Apr 2026']),
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
