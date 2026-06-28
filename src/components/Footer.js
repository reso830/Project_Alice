import aliceWhite from '../assets/Alice_White.png';
import { APP_VERSION, ISSUE_URL, LICENSE_NAME, LICENSE_URL } from '../pages/welcome/shared/appMeta.js';

const RELEASES_URL = 'https://github.com/reso830/Project_Alice/releases/latest';
const HOSTED_URL = 'https://project-alice-gamma.vercel.app';

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

function createModeControl(runtime) {
  const link = document.createElement('a');

  if (runtime === 'local') {
    link.className = 'footer__hosted-link';
    link.href = HOSTED_URL;
    link.textContent = 'Open hosted version ↗';
    link.setAttribute('aria-label', 'Open hosted version');
  } else {
    const label = document.createElement('span');
    const version = document.createElement('span');

    link.className = 'footer__download';
    link.href = RELEASES_URL;
    link.setAttribute('aria-label', `Download Project Alice ${APP_VERSION}`);
    label.textContent = 'Download';
    version.className = 'footer__download-version';
    version.textContent = APP_VERSION;
    link.append(label, version);
  }

  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
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

function createLicense() {
  const section = document.createElement('section');
  const label = document.createElement('p');
  const link = document.createElement('a');

  section.className = 'footer__section';
  label.className = 'footer__label';
  label.textContent = 'LICENSE';

  link.className = 'footer__link';
  link.href = LICENSE_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = LICENSE_NAME;

  section.append(label, link);

  return section;
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

export function render({ runtime = 'hosted' } = {}) {
  const footer = document.createElement('footer');
  const inner = document.createElement('div');
  const rule = document.createElement('hr');

  footer.className = 'site-footer';
  inner.className = 'footer__inner';
  rule.className = 'footer__rule';

  inner.append(
    createBrand(),
    createModeControl(runtime),
    rule,
    createSection('VERSION', [APP_VERSION, 'Built May 2026']),
    createSection('STACK', [
      'Vanilla JS \u00b7 Vite',
      'Vercel \u00b7 Supabase',
      'Vitest \u00b7 ESLint \u00b7 Speckit',
    ]),
    createFeedback(),
    createLicense(),
    createText(
      'footer__copyright',
      "\u00a9 2026 Project Alice. All rights reserved. \u00b7 Part of reso's Project Series.",
    ),
  );
  footer.append(inner);

  return footer;
}

export const Footer = { render };
