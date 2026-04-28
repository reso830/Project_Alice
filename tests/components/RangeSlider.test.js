// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RangeSlider } from '../../src/components/RangeSlider.js';

function renderSlider(overrides = {}) {
  const options = {
    min: 0,
    max: 200000,
    step: 1000,
    valueMin: 50000,
    valueMax: 150000,
    formatValue: (value) => `$${value / 1000}k`,
    ariaLabelMin: 'Minimum salary',
    ariaLabelMax: 'Maximum salary',
    onCommit: vi.fn(),
    ...overrides,
  };
  const slider = RangeSlider.render(options);
  const track = slider.querySelector('.range-track');

  track.getBoundingClientRect = () => ({
    left: 0,
    right: 200,
    width: 200,
    top: 0,
    bottom: 4,
    height: 4,
  });
  document.body.append(slider);

  return { slider, options };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('RangeSlider', () => {
  it('renders accessible thumbs, value labels, and bounds', () => {
    const { slider } = renderSlider();
    const thumbs = slider.querySelectorAll('.range-thumb');
    const values = slider.querySelectorAll('.range-value');
    const bounds = slider.querySelectorAll('.range-bounds span');

    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].getAttribute('role')).toBe('slider');
    expect(thumbs[0].getAttribute('aria-valuemin')).toBe('0');
    expect(thumbs[0].getAttribute('aria-valuemax')).toBe('200000');
    expect(thumbs[0].getAttribute('aria-valuenow')).toBe('50000');
    expect(thumbs[0].getAttribute('aria-label')).toBe('Minimum salary');
    expect(thumbs[1].getAttribute('aria-valuenow')).toBe('150000');
    expect(thumbs[1].getAttribute('aria-label')).toBe('Maximum salary');
    expect(values[0].textContent).toBe('$50k');
    expect(values[1].textContent).toBe('$150k');
    expect(bounds[0].textContent).toBe('$0k');
    expect(bounds[1].textContent).toBe('$200k');
  });

  it('updates during drag and commits a snapped value on release', () => {
    const { slider, options } = renderSlider();
    const minThumb = slider.querySelector('.range-thumb--min');

    minThumb.dispatchEvent(new window.MouseEvent('mousedown', { clientX: 50, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 60, bubbles: true }));

    expect(options.onCommit).not.toHaveBeenCalled();

    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));

    expect(options.onCommit).toHaveBeenCalledOnce();
    expect(options.onCommit).toHaveBeenCalledWith(60000, 150000);
  });

  it('enforces minimum spacing when a thumb is released past the other thumb', () => {
    const { slider, options } = renderSlider();
    const minThumb = slider.querySelector('.range-thumb--min');

    minThumb.dispatchEvent(new window.MouseEvent('mousedown', { clientX: 50, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 200, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));

    expect(options.onCommit).toHaveBeenCalledWith(149000, 150000);
  });

  it('commits keyboard changes immediately and clamps at bounds', () => {
    const { slider, options } = renderSlider();
    const minThumb = slider.querySelector('.range-thumb--min');

    minThumb.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    minThumb.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(options.onCommit).toHaveBeenNthCalledWith(1, 51000, 150000);
    expect(options.onCommit).toHaveBeenNthCalledWith(2, 50000, 150000);
  });

  it('prevents keyboard movement past the opposite thumb', () => {
    const { slider, options } = renderSlider({
      valueMin: 149000,
      valueMax: 150000,
    });
    const minThumb = slider.querySelector('.range-thumb--min');

    minThumb.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(options.onCommit).toHaveBeenCalledWith(149000, 150000);
  });
});
