import aliceLogo from '../assets/logo/alice-sigil-full.svg';
import { APP_VERSION, ISSUE_URL, LICENSE_NAME, LICENSE_URL } from '../pages/welcome/shared/appMeta.js';

const RELEASES_URL = 'https://github.com/reso830/Project_Alice/releases/latest';
const REPOSITORY_URL = 'https://github.com/reso830/Project_Alice';
const HOSTED_URL = 'https://alice-os.app';
const PORTFOLIO_URL = 'https://alvinresoso.com';

function displayVersion(version) {
  return String(version).startsWith('v') ? String(version) : `v${version}`;
}

function createBrandIcon() {
  const img = document.createElement('img');

  img.className = 'footer__brand-icon';
  img.src = aliceLogo;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');

  return img;
}

function createBrand() {
  const brand = document.createElement('div');
  const text = document.createElement('div');
  const line1 = document.createElement('div');
  const name = document.createElement('span');
  const tagline = document.createElement('span');
  const version = document.createElement('span');

  brand.className = 'footer__brand';
  text.className = 'footer__brand-text';
  line1.className = 'footer__brand-line1';
  name.className = 'footer__brand-name';
  tagline.className = 'footer__tagline';
  version.className = 'footer__version-inline';
  name.textContent = 'Project Alice';
  tagline.textContent = 'Your Career OS.';
  version.textContent = displayVersion(APP_VERSION);

  line1.append(name, tagline);
  text.append(line1, version);
  brand.append(createBrandIcon(), text);

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
    link.className = 'footer__download';
    link.href = RELEASES_URL;
    link.setAttribute('aria-label', 'Download Project Alice Portable');
    link.textContent = 'Download Portable Alice';
  }

  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function createFeedbackLink(text, href, label) {
  const link = document.createElement('a');

  link.className = 'footer__link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = text;
  link.setAttribute('aria-label', label);

  return link;
}

function createLegalLink(text, type, onLegalLink) {
  const link = document.createElement('button');

  link.type = 'button';
  link.className = 'footer__link';
  link.textContent = text;
  link.addEventListener('click', () => onLegalLink?.(type));

  return link;
}

function createLicense(onLegalLink) {
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

  section.append(
    label,
    link,
    createLegalLink('Terms & Conditions', 'terms', onLegalLink),
    createLegalLink('Privacy Policy', 'privacy', onLegalLink),
  );

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
    createFeedbackLink('GitHub', REPOSITORY_URL, 'Open Project Alice repository'),
    createFeedbackLink('Report an issue', ISSUE_URL, 'Report an issue on GitHub'),
    createFeedbackLink('Request a feature', ISSUE_URL, 'Request a feature on GitHub'),
  );

  return section;
}

function createCopyright() {
  const p = document.createElement('p');
  const link = document.createElement('a');

  p.className = 'footer__copyright';
  link.className = 'footer__link footer__portfolio-link';
  link.href = PORTFOLIO_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'alvinresoso.com';

  p.append(
    document.createTextNode('© 2026 Project Alice. All rights reserved.'),
    document.createElement('br'),
    document.createTextNode("Part of reso's Project Series."),
    document.createElement('br'),
    link,
  );

  return p;
}

export function render({ runtime = 'hosted', onLegalLink } = {}) {
  const footer = document.createElement('footer');
  const inner = document.createElement('div');

  footer.className = 'site-footer';
  inner.className = 'footer__inner';

  const brand = createBrand();
  brand.append(createModeControl(runtime));

  inner.append(
    brand,
    createFeedback(),
    createLicense(onLegalLink),
    createCopyright(),
  );
  footer.append(inner);

  return footer;
}

export const Footer = { render };
