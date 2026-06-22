// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createClampText } from '../../src/utils/clampText.js';

const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

function setElementMetric(name, value) {
  Object.defineProperty(HTMLElement.prototype, name, {
    configurable: true,
    get() {
      return value;
    },
  });
}

function restoreElementMetric(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(HTMLElement.prototype, name, descriptor);
  } else {
    delete HTMLElement.prototype[name];
  }
}

afterEach(() => {
  restoreElementMetric('scrollHeight', originalScrollHeight);
  restoreElementMetric('clientHeight', originalClientHeight);
  document.body.replaceChildren();
});

describe('createClampText', () => {
  it('renders clamped text with configured desktop and mobile line counts', () => {
    const root = createClampText('A concise value.', { lines: 2, mlines: 4, className: 'custom-value' });
    const text = root.querySelector('.clamp-text');

    expect(root.className).toBe('clamp-wrap');
    expect(text.classList.contains('mfield-val')).toBe(true);
    expect(text.classList.contains('clamped')).toBe(true);
    expect(text.classList.contains('custom-value')).toBe(true);
    expect(text.style.getPropertyValue('--lines')).toBe('2');
    expect(text.style.getPropertyValue('--mlines')).toBe('4');
    expect(text.textContent).toBe('A concise value.');
  });

  it('does not render a toggle when measurement reports no overflow', async () => {
    setElementMetric('scrollHeight', 40);
    setElementMetric('clientHeight', 40);

    const root = createClampText('Short text.');
    document.body.append(root);
    await Promise.resolve();

    expect(root.querySelector('.clamp-toggle')).toBeNull();
    expect(root.querySelector('.clamp-text').classList.contains('clamped')).toBe(true);
  });

  it('renders a toggle for overflowing text and switches Show more / Show less', async () => {
    setElementMetric('scrollHeight', 80);
    setElementMetric('clientHeight', 40);

    const root = createClampText('A long value that overflows.');
    document.body.append(root);
    await Promise.resolve();

    const toggle = root.querySelector('.clamp-toggle');
    const text = root.querySelector('.clamp-text');

    expect(toggle).not.toBeNull();
    expect(toggle.textContent).toBe('Show more');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(text.classList.contains('clamped')).toBe(true);

    toggle.click();

    expect(toggle.textContent).toBe('Show less');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(text.classList.contains('clamped')).toBe(false);

    toggle.click();

    expect(toggle.textContent).toBe('Show more');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(text.classList.contains('clamped')).toBe(true);
  });
});
