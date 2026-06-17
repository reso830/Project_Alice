// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CompatBar } from '../../src/components/CompatBar.js';

function labelFor(score) {
  return CompatBar.render(score).querySelector('.compat-bar__label')?.textContent;
}

describe('CompatBar', () => {
  it.each([
    [0, 'Low'],
    [39, 'Low'],
    [40, 'Medium'],
    [64, 'Medium'],
    [65, 'High'],
    [84, 'High'],
    [85, 'Great'],
    [100, 'Great'],
  ])('renders the compatibility band label at %i', (score, label) => {
    expect(labelFor(score)).toContain(label);
  });

  it('renders the numeric score and label as text, not color alone', () => {
    const bar = CompatBar.render(85);

    expect(bar.querySelector('.compat-bar__label')?.textContent).toBe('85% Great');
  });

  it.each([
    [20, 'rgb(17, 24, 39)'],
    [50, 'rgb(17, 24, 39)'],
    [70, 'rgb(255, 255, 255)'],
    [90, 'rgb(255, 255, 255)'],
  ])('uses a readable flat text color at %i', (score, color) => {
    const label = CompatBar.render(score).querySelector('.compat-bar__label');

    expect(label.style.color).toBe(color);
  });

  it('uses a brighter blue fill for Great compatibility', () => {
    const fill = CompatBar.render(90).querySelector('.compat-bar__fill');

    expect(fill.style.backgroundColor).toBe('rgb(37, 99, 235)');
  });

  it('uses a WCAG-compliant green fill for High compatibility', () => {
    const fill = CompatBar.render(70).querySelector('.compat-bar__fill');

    expect(fill.style.backgroundColor).toBe('rgb(21, 128, 61)');
  });
});
