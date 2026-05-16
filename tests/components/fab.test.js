// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { Fab } from '../../src/components/Fab.js';

describe('Fab', () => {
  it('renders a button with class `fab` and the default aria-label', () => {
    const fab = Fab.render({ onClick: () => {} });
    expect(fab.tagName).toBe('BUTTON');
    expect(fab.className).toBe('fab');
    expect(fab.getAttribute('aria-label')).toBe('New application');
  });

  it('renders an inline plus SVG with aria-hidden', () => {
    const fab = Fab.render({ onClick: () => {} });
    const icon = fab.querySelector('svg.fab__icon');
    expect(icon).not.toBeNull();
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('invokes the click handler when clicked', () => {
    const onClick = vi.fn();
    const fab = Fab.render({ onClick });
    fab.click();
    fab.click();
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('accepts a custom aria-label', () => {
    const fab = Fab.render({ onClick: () => {}, ariaLabel: 'Compose' });
    expect(fab.getAttribute('aria-label')).toBe('Compose');
  });

  it('renders without throwing when onClick is omitted', () => {
    expect(() => Fab.render()).not.toThrow();
  });
});
