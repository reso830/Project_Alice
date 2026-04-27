// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const toolbarRenderOptions = vi.hoisted(() => []);
const toolbarUpdateOptions = vi.hoisted(() => []);

vi.mock('../../src/components/QuickFiltersToolbar.js', () => ({
  QuickFiltersToolbar: {
    render: vi.fn((options) => {
      toolbarRenderOptions.push(options);
      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';
      return toolbar;
    }),
    update: vi.fn((toolbar, options) => {
      toolbarUpdateOptions.push(options);
    }),
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
  toolbarUpdateOptions.length = 0;
  vi.clearAllMocks();
});

function createApplication(id, overrides = {}) {
  return {
    id,
    jobTitle: `Role ${id}`,
    companyName: `Company ${id}`,
    status: 'applied',
    lastStatusUpdate: '2026-04-27',
    compat: id,
    salary: `$${80 + id}k-$${90 + id}k`,
    fav: false,
    skills: [],
    responsibilities: '',
    recruiter: '',
    jobPostingUrl: '',
    ...overrides,
  };
}

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

  it('resets pagination to page 1 when sort changes', async () => {
    const container = document.createElement('main');

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue(Array.from({ length: 12 }, (_, index) => createApplication(index + 1)));

    await Tracker.mount(container);
    [...container.querySelectorAll('.pagination__btn')]
      .find((button) => button.textContent === '2')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('2');

    toolbarRenderOptions[0].onSortChange({ field: 'compat', direction: 'desc' });

    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('1');
  });

  it('preserves sort state when filters are cleared', async () => {
    const container = document.createElement('main');
    const sortState = { field: 'compat', direction: 'desc' };

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([createApplication(1)]);

    await Tracker.mount(container);
    toolbarRenderOptions[0].onSortChange(sortState);
    toolbarRenderOptions[0].onClearAll();

    expect(toolbarUpdateOptions.at(-1).sortState).toEqual(sortState);
  });
});
