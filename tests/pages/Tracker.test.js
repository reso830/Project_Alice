// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const toolbarRenderOptions = vi.hoisted(() => []);

vi.mock('../../src/components/QuickFiltersToolbar.js', () => ({
  QuickFiltersToolbar: {
    render: vi.fn((options) => {
      toolbarRenderOptions.push(options);
      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';
      return toolbar;
    }),
    update: vi.fn(),
  },
}));

vi.mock('../../src/services/api.js', () => ({
  archive: vi.fn(),
  getAll: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
}));

import * as api from '../../src/services/api.js';
import { Tracker } from '../../src/pages/Tracker.js';

afterEach(() => {
  Tracker.unmount();
  document.body.replaceChildren();
  toolbarRenderOptions.length = 0;
  vi.clearAllMocks();
});

describe('Tracker quick filter toolbar integration', () => {
  it('preserves sort state across unmount and remount in the same session', async () => {
    const container = document.createElement('main');
    const sortState = { field: 'compat', direction: 'desc' };

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([]);

    await Tracker.mount(container);
    toolbarRenderOptions[0].onSortChange(sortState);
    Tracker.unmount();

    await Tracker.mount(container);

    expect(toolbarRenderOptions[1].sortState).toEqual(sortState);
  });
});
