// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Footer } from '../../src/components/Footer.js';
import { APP_VERSION } from '../../src/pages/welcome/shared/appMeta.js';

describe('Footer', () => {
  it('renders a footer element', () => {
    const footer = Footer.render();

    expect(footer?.tagName).toBe('FOOTER');
    expect(footer?.className).toBe('site-footer');
  });

  it('renders feedback links to GitHub issues in new tabs', () => {
    const footer = Footer.render();
    const links = [...footer.querySelectorAll('.footer__feedback .footer__link')];

    expect(links).toHaveLength(2);

    for (const link of links) {
      expect(link.href).toContain('github.com/reso830/Project_Alice/issues');
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.rel).toContain('noreferrer');
    }
  });

  it('adds accessible labels to feedback links', () => {
    const footer = Footer.render();
    const links = [...footer.querySelectorAll('.footer__feedback .footer__link')];

    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Report an issue on GitHub',
      'Request a feature on GitHub',
    ]);
  });

  it('renders the license link to PolyForm in a new tab', () => {
    const footer = Footer.render();
    const links = [...footer.querySelectorAll('.footer__link')];
    const licenseLink = links.find((l) => l.href.includes('polyformproject.org'));

    expect(licenseLink).toBeTruthy();
    expect(licenseLink.textContent).toBe('PolyForm Noncommercial 1.0.0');
    expect(licenseLink.target).toBe('_blank');
    expect(licenseLink.rel).toContain('noopener');
    expect(licenseLink.rel).toContain('noreferrer');
  });

  it('renders the copyright text', () => {
    const footer = Footer.render();

    expect(footer.textContent).toContain('© 2026 Project Alice');
  });

  it('renders the current static app version', () => {
    const footer = Footer.render();

    expect(footer.textContent).toContain(APP_VERSION);
    expect(footer.textContent).toContain('Built May 2026');
  });

  it('uses visual labels without adding footer headings', () => {
    const footer = Footer.render();

    expect(footer.querySelectorAll('.footer__label')).toHaveLength(4);
    expect(footer.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0);
  });
});
