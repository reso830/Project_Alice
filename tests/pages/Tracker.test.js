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
import { Tracker, normalizeStoredFilterState } from '../../src/pages/Tracker.js';

afterEach(() => {
  Tracker.unmount();
  document.body.replaceChildren();
  toolbarRenderOptions.length = 0;
  toolbarUpdateOptions.length = 0;
  window.localStorage.clear();
  vi.restoreAllMocks();
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
    salary: (80 + id) * 1000,
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

  it('renders the filter empty state when active filters match no applications', async () => {
    const container = document.createElement('main');

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([createApplication(1, { salary: 80000 })]);

    await Tracker.mount(container);
    toolbarRenderOptions[0].onFilterChange({
      statuses: [],
      companies: [],
      salaryMin: 200000,
      salaryMax: null,
      compatMin: null,
      compatMax: null,
    });

    expect(container.querySelector('.empty-state--filter')).not.toBeNull();
    expect(container.querySelector('.empty-state--filter')?.innerHTML)
      .toBe('No applications match<br>the active filters.');
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(0);
  });

  it('persists favorites-only filter changes and restores them on mount', async () => {
    const container = document.createElement('main');

    window.scrollTo = vi.fn();
    window.localStorage.clear();
    api.getAll.mockResolvedValue([
      createApplication(1, { fav: true }),
      createApplication(2, { fav: false }),
    ]);

    await Tracker.mount(container);
    toolbarRenderOptions[0].onFilterChange({
      ...toolbarRenderOptions[0].filterState,
      favoritesOnly: true,
    });

    expect(JSON.parse(window.localStorage.getItem('apptracker_filters')).favoritesOnly).toBe(true);
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(1);

    Tracker.unmount();
    await Tracker.mount(container);

    expect(toolbarRenderOptions[1].filterState.favoritesOnly).toBe(true);
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(1);
  });

  it('removes an unfavorited card while favorites-only is active', async () => {
    const container = document.createElement('main');
    const original = createApplication(1, { fav: true });

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([original]);
    api.update.mockResolvedValue({ ...original, fav: false });

    await Tracker.mount(container);
    toolbarRenderOptions[0].onFilterChange({
      ...toolbarRenderOptions[0].filterState,
      favoritesOnly: true,
    });
    container.querySelector('.card-btn--star')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(api.update).toHaveBeenCalledWith(1, { fav: false });
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(0);
    expect(container.querySelector('.empty-state--filter')).not.toBeNull();
  });

  it('validates stored filter state before mounting', async () => {
    const container = document.createElement('main');

    window.scrollTo = vi.fn();
    window.localStorage.setItem('apptracker_filters', JSON.stringify({
      statuses: ['applied', 'unknown'],
      salaryMin: 200000,
      salaryMax: 100000,
      favoritesOnly: 'true',
    }));
    api.getAll.mockResolvedValue([createApplication(1, { status: 'applied' })]);

    await Tracker.mount(container);

    expect(toolbarRenderOptions[0].filterState).toEqual(expect.objectContaining({
      statuses: ['applied'],
      salaryMin: null,
      salaryMax: null,
      favoritesOnly: false,
    }));
  });

  it('falls back to default filters when stored filters are unavailable', async () => {
    const container = document.createElement('main');

    window.scrollTo = vi.fn();
    vi.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    api.getAll.mockResolvedValue([createApplication(1)]);

    await Tracker.mount(container);

    expect(toolbarRenderOptions[0].filterState.favoritesOnly).toBe(false);
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(1);
  });

  it('re-renders cards after overlay favorite updates', async () => {
    const container = document.createElement('main');
    const original = createApplication(1, { fav: false });
    const updated = { ...original, fav: true };

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([original]);
    api.getById.mockResolvedValue(original);
    api.update.mockResolvedValue(updated);

    await Tracker.mount(container);
    container.querySelector('.card').click();
    await Promise.resolve();
    document.querySelector('.modal-quick-action--favorite').click();
    await Promise.resolve();

    expect(api.update).toHaveBeenCalledWith(1, { fav: true });
    expect(container.querySelector('.card-btn--star').classList.contains('card-btn--starred'))
      .toBe(true);
  });

  it('re-renders cards after overlay status updates', async () => {
    const container = document.createElement('main');
    const original = createApplication(1, { status: 'applied' });
    const updated = { ...original, status: 'offer' };

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([original]);
    api.getById.mockResolvedValue(original);
    api.update.mockResolvedValue(updated);

    await Tracker.mount(container);
    container.querySelector('.card').click();
    await Promise.resolve();
    document.querySelector('.modal-quick-action--status').click();
    document.querySelector('[data-status="offer"]').click();
    await Promise.resolve();

    expect(api.update).toHaveBeenCalledWith(1, { status: 'offer' });
    expect(container.querySelector('.status-badge').textContent).toBe('Offer');
  });

  it('removes cards after overlay archive confirmation', async () => {
    const container = document.createElement('main');
    const original = createApplication(1);

    window.scrollTo = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.getAll.mockResolvedValue([original]);
    api.getById.mockResolvedValue(original);
    api.update.mockResolvedValue({ ...original, archived: true, fav: false });

    await Tracker.mount(container);
    container.querySelector('.card').click();
    await Promise.resolve();
    document.querySelector('.modal-quick-action--archive').click();
    await Promise.resolve();

    expect(api.update).toHaveBeenCalledWith(1, { archived: true, fav: false });
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(0);
  });
});

describe('Tracker stored filter validation', () => {
  it('discards unknown statuses and corrupted favorites values', () => {
    expect(normalizeStoredFilterState({
      statuses: ['applied', 'missing'],
      favoritesOnly: 'yes',
    })).toEqual(expect.objectContaining({
      statuses: ['applied'],
      favoritesOnly: false,
    }));
  });

  it('resets inverted salary ranges', () => {
    expect(normalizeStoredFilterState({
      salaryMin: 200000,
      salaryMax: 100000,
    })).toEqual(expect.objectContaining({
      salaryMin: null,
      salaryMax: null,
    }));
  });
});
