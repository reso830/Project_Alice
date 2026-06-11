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
});
