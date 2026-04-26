// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Footer } from '../../src/components/Footer.js';

describe('Footer', () => {
  it('renders a footer element', () => {
    const footer = Footer.render();

    expect(footer?.tagName).toBe('FOOTER');
    expect(footer?.className).toBe('site-footer');
  });

  it('renders feedback links to GitHub issues in new tabs', () => {
    const footer = Footer.render();
    const links = [...footer.querySelectorAll('.footer__link')];

    expect(links).toHaveLength(2);

    for (const link of links) {
      expect(link.href).toContain('github.com/reso830/Project_Alice/issues');
      expect(link.target).toBe('_blank');
    }
  });

  it('adds accessible labels to feedback links', () => {
    const footer = Footer.render();
    const links = [...footer.querySelectorAll('.footer__link')];

    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Report an issue on GitHub',
      'Request a feature on GitHub',
    ]);
  });

  it('renders the copyright text', () => {
    const footer = Footer.render();

    expect(footer.textContent).toContain('\u00a9 2026 Project Alice');
  });
});
