// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '../../src/components/Footer.js';
import { APP_VERSION } from '../../src/pages/welcome/shared/appMeta.js';

describe('Footer', () => {
  it('renders a footer element', () => {
    const footer = Footer.render();

    expect(footer?.tagName).toBe('FOOTER');
    expect(footer?.className).toBe('site-footer');
  });

  it('renders the vector brand sigil', () => {
    const footer = Footer.render();
    const icon = footer.querySelector('.footer__brand-icon');

    expect(icon).not.toBeNull();
    expect(icon.tagName).toBe('IMG');
    expect(icon.getAttribute('src')).toContain('alice-sigil-full');
  });

  it('renders the app version inline under the brand tagline, not as a VERSION section', () => {
    const footer = Footer.render();

    expect(footer.querySelector('.footer__version-inline')?.textContent).toBe(APP_VERSION);
    expect([...footer.querySelectorAll('.footer__label')].some((l) => l.textContent === 'VERSION')).toBe(false);
  });

  it('does not render a STACK section', () => {
    const footer = Footer.render();

    expect([...footer.querySelectorAll('.footer__label')].some((l) => l.textContent === 'STACK')).toBe(false);
  });

  it('does not render the removed horizontal rule', () => {
    const footer = Footer.render();

    expect(footer.querySelector('.footer__rule')).toBeNull();
    expect(footer.querySelector('hr')).toBeNull();
  });

  it('renders a GitHub repo-root link as the first feedback item, plus the issue links, all in new tabs', () => {
    const footer = Footer.render();
    const links = [...footer.querySelectorAll('.footer__feedback .footer__link')];

    expect(links).toHaveLength(3);
    expect(links[0].textContent).toBe('GitHub');
    expect(links[0].href).toBe('https://github.com/reso830/Project_Alice');

    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.rel).toContain('noreferrer');
    }

    expect(links[1].href).toContain('github.com/reso830/Project_Alice/issues');
    expect(links[2].href).toContain('github.com/reso830/Project_Alice/issues');
  });

  it('adds accessible labels to feedback links', () => {
    const footer = Footer.render();
    const links = [...footer.querySelectorAll('.footer__feedback .footer__link')];

    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Open Project Alice repository',
      'Report an issue on GitHub',
      'Request a feature on GitHub',
    ]);
  });

  it('renders the license link to PolyForm in a new tab', () => {
    const footer = Footer.render();
    const links = [...footer.querySelectorAll('.footer__link')];
    const licenseLink = links.find((l) => l.href?.includes('polyformproject.org'));

    expect(licenseLink).toBeTruthy();
    expect(licenseLink.textContent).toBe('PolyForm Noncommercial 1.0.0');
    expect(licenseLink.target).toBe('_blank');
    expect(licenseLink.rel).toContain('noopener');
    expect(licenseLink.rel).toContain('noreferrer');
  });

  it('renders active Terms & Conditions / Privacy Policy triggers in the License section that call onLegalLink', () => {
    const onLegalLink = vi.fn();
    const footer = Footer.render({ onLegalLink });
    const licenseSection = [...footer.querySelectorAll('.footer__section')]
      .find((section) => section.querySelector('.footer__label')?.textContent === 'LICENSE');

    const termsBtn = [...licenseSection.querySelectorAll('button.footer__link')]
      .find((b) => b.textContent === 'Terms & Conditions');
    const privacyBtn = [...licenseSection.querySelectorAll('button.footer__link')]
      .find((b) => b.textContent === 'Privacy Policy');

    expect(termsBtn).toBeTruthy();
    expect(privacyBtn).toBeTruthy();

    termsBtn.click();
    expect(onLegalLink).toHaveBeenCalledWith('terms');

    privacyBtn.click();
    expect(onLegalLink).toHaveBeenCalledWith('privacy');
  });

  it('renders a 3-line copyright block with a link to alvinresoso.com', () => {
    const footer = Footer.render();
    const copyright = footer.querySelector('.footer__copyright');

    expect(copyright.querySelectorAll('br')).toHaveLength(2);
    expect(copyright.textContent).toContain('© 2026 Project Alice. All rights reserved.');
    expect(copyright.textContent).toContain("Part of reso's Project Series.");

    const portfolioLink = copyright.querySelector('a');
    expect(portfolioLink.textContent).toBe('alvinresoso.com');
    expect(portfolioLink.href).toBe('https://alvinresoso.com/');
    expect(portfolioLink.target).toBe('_blank');
    expect(portfolioLink.rel).toContain('noopener');
  });

  it('renders the current static app version', () => {
    const footer = Footer.render();

    expect(footer.textContent).toContain(APP_VERSION);
  });

  it('renders a hosted download button by default', () => {
    const footer = Footer.render();
    const link = footer.querySelector('.footer__download');

    expect(link).not.toBeNull();
    expect(link.href).toBe('https://github.com/reso830/Project_Alice/releases/latest');
    expect(link.textContent).toContain('Download Portable Alice');
    expect(link.textContent).toContain(APP_VERSION);
  });

  it('renders the hosted-version link for local runtime', () => {
    const footer = Footer.render({ runtime: 'local' });
    const link = footer.querySelector('.footer__hosted-link');

    expect(footer.querySelector('.footer__download')).toBeNull();
    expect(link).not.toBeNull();
    expect(link.textContent).toBe('Open hosted version ↗');
    expect(link.href).toBe('https://alice-os.app/');
  });

  it('uses visual labels without adding footer headings', () => {
    const footer = Footer.render();

    expect(footer.querySelectorAll('.footer__label')).toHaveLength(2);
    expect(footer.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0);
  });
});
