// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATUS_CONFIG, STATUS_DISPLAY_PRIORITY } from '../../src/models/application.js';
import {
  mountStatusFilterPopup,
  renderStatusFilterPanel,
} from '../../src/components/QuickFiltersStatusPopup.js';

function anchor() {
  const button = document.createElement('button');
  button.getBoundingClientRect = () => ({
    left: 40,
    right: 70,
    top: 20,
    bottom: 50,
    width: 30,
    height: 30,
  });
  document.body.append(button);
  return button;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('QuickFiltersStatusPopup', () => {
  it('renders the same status panel surface used by Tracker quick filters', () => {
    const panel = renderStatusFilterPanel({
      options: STATUS_DISPLAY_PRIORITY,
      selected: ['assessment'],
      onChange: vi.fn(),
      onClear: vi.fn(),
    });

    document.body.append(panel);

    expect(panel.classList).toContain('filter-panel');
    expect(panel.dataset.surface).toBe('quick-status-filter');
    expect([...panel.querySelectorAll('.filter-panel__option')].map((row) => row.dataset.value))
      .toEqual(STATUS_DISPLAY_PRIORITY);
    expect(panel.querySelector('[data-value="assessment"] .filter-panel__option-label').textContent)
      .toBe('Technical');
    expect(panel.querySelector('[data-value="assessment"] .filter-panel__dot').style.backgroundColor)
      .toBe('rgb(224, 170, 255)');
    expect(STATUS_CONFIG.assessment.label).toBe('Technical');
  });

  it('mounts a single-select popup and maps clear to null', () => {
    const onSelect = vi.fn();
    const mounted = mountStatusFilterPopup({
      anchor: anchor(),
      value: 'interview',
      onSelect,
      onClose: vi.fn(),
    });

    expect(document.querySelector('.filter-panel').dataset.surface).toBe('quick-status-filter');
    document.querySelector('[data-value="offer"]').click();
    expect(onSelect).toHaveBeenCalledWith('offer');

    mountStatusFilterPopup({
      anchor: anchor(),
      value: 'interview',
      onSelect,
      onClose: vi.fn(),
    });
    document.querySelector('.filter-panel__clear').click();
    expect(onSelect).toHaveBeenCalledWith(null);

    mounted.close();
    expect(document.querySelector('.filter-panel')).toBeNull();
  });
});
