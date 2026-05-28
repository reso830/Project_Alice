// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
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
  unarchive: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../src/components/ConfirmDialog.js', () => ({
  ConfirmDialog: { show: vi.fn() },
}));

import * as api from '../../src/services/api.js';
import { ConfirmDialog } from '../../src/components/ConfirmDialog.js';
import { CreationPicker } from '../../src/components/CreationPicker.js';
import { Tracker, normalizeStoredFilterState } from '../../src/pages/Tracker.js';

const mainCss = readFileSync(join(cwd(), 'src/styles/main.css'), 'utf8');

afterEach(() => {
  Tracker.unmount();
  document.body.replaceChildren();
  window.history.replaceState({}, '', '/');
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
  it('initializes archived view from the URL and fetches archived rows first', async () => {
    const container = document.createElement('main');
    const archived = createApplication(9, { archived: true, archivedDate: '2026-05-01' });

    window.scrollTo = vi.fn();
    window.history.replaceState({}, '', '/?view=archived');
    api.getAll.mockImplementation((options) => (
      options?.view === 'archived' ? Promise.resolve([archived]) : Promise.resolve([])
    ));

    await Tracker.mount(container);

    expect(api.getAll).toHaveBeenCalledWith({ view: 'archived' });
    expect(toolbarRenderOptions[0].currentView).toBe('archived');
    expect(container.textContent).toContain('Role 9');
  });

  it('switches views through toolbar props, syncs URL, and preserves filters and sort', async () => {
    const container = document.createElement('main');
    const active = createApplication(1, { status: 'interview' });
    const archived = createApplication(2, { status: 'interview', archived: true, archivedDate: '2026-05-01' });
    const sortState = { field: 'salary', direction: 'desc' };

    window.scrollTo = vi.fn();
    window.history.replaceState({}, '', '/');
    api.getAll.mockImplementation((options) => (
      options?.view === 'archived' ? Promise.resolve([archived]) : Promise.resolve([active])
    ));

    await Tracker.mount(container);
    toolbarRenderOptions[0].onFilterChange({
      ...toolbarRenderOptions[0].filterState,
      statuses: ['interview'],
    });
    toolbarRenderOptions[0].onSortChange(sortState);
    await toolbarRenderOptions[0].onViewChange('archived');

    expect(window.location.search).toBe('?view=archived');
    expect(api.getAll).toHaveBeenLastCalledWith({ view: 'archived' });
    expect(toolbarUpdateOptions.at(-1).filterState.statuses).toEqual(['interview']);
    expect(toolbarUpdateOptions.at(-1).sortState).toEqual(sortState);
    expect(container.textContent).toContain('Role 2');

    await toolbarRenderOptions[0].onViewChange('active');

    expect(window.location.search).toBe('');
    expect(api.getAll).toHaveBeenLastCalledWith({});
    expect(container.textContent).toContain('Role 1');
  });

  it('keeps an active status filter applied when switching to archived rows with no matches', async () => {
    const container = document.createElement('main');
    const active = createApplication(1, { status: 'interview' });
    const archived = createApplication(2, { status: 'offer', archived: true, archivedDate: '2026-05-01' });

    window.scrollTo = vi.fn();
    api.getAll.mockImplementation((options) => (
      options?.view === 'archived' ? Promise.resolve([archived]) : Promise.resolve([active])
    ));

    await Tracker.mount(container);
    toolbarRenderOptions[0].onFilterChange({
      ...toolbarRenderOptions[0].filterState,
      statuses: ['interview'],
    });

    expect(container.textContent).toContain('Role 1');

    await toolbarRenderOptions[0].onViewChange('archived');

    expect(toolbarUpdateOptions.at(-1).filterState.statuses).toEqual(['interview']);
    expect(container.querySelector('.empty-state--filter')?.innerHTML)
      .toBe('No archived items match<br>the active filters.');
    expect(container.textContent).not.toContain('Role 2');
  });

  it('keeps salary sort applied when switching to archived rows', async () => {
    const container = document.createElement('main');
    const sortState = { field: 'salary', direction: 'desc' };

    window.scrollTo = vi.fn();
    api.getAll.mockImplementation((options) => (
      options?.view === 'archived'
        ? Promise.resolve([
          createApplication(2, { salary: 90000, archived: true }),
          createApplication(3, { salary: 130000, archived: true }),
        ])
        : Promise.resolve([createApplication(1, { salary: 110000 })])
    ));

    await Tracker.mount(container);
    toolbarRenderOptions[0].onSortChange(sortState);
    await toolbarRenderOptions[0].onViewChange('archived');

    const cards = [...container.querySelectorAll('.card')].map((card) => card.textContent);

    expect(toolbarUpdateOptions.at(-1).sortState).toEqual(sortState);
    expect(cards[0]).toContain('Role 3');
    expect(cards[1]).toContain('Role 2');
  });

  it('resets pagination to page 1 when switching views', async () => {
    const container = document.createElement('main');

    window.scrollTo = vi.fn();
    api.getAll.mockImplementation((options) => (
      options?.view === 'archived'
        ? Promise.resolve(Array.from({ length: 14 }, (_, index) => createApplication(index + 40, { archived: true })))
        : Promise.resolve(Array.from({ length: 25 }, (_, index) => createApplication(index + 1)))
    ));

    await Tracker.mount(container);
    toolbarRenderOptions[0].onSortChange({ field: 'id', direction: 'asc' });
    [...container.querySelectorAll('.pagination__btn')]
      .find((button) => button.textContent === '3')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('3');

    await toolbarRenderOptions[0].onViewChange('archived');

    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('1');
    expect(container.textContent).toContain('Role 40');
    expect(container.textContent).not.toContain('Role 50');
  });

  it('hides creation affordances in archived view and restores them on active view', async () => {
    const container = document.createElement('main');

    window.scrollTo = vi.fn();
    window.history.replaceState({}, '', '/?view=archived');
    api.getAll.mockImplementation((options) => (
      options?.view === 'archived' ? Promise.resolve([createApplication(2, { archived: true })]) : Promise.resolve([createApplication(1)])
    ));

    await Tracker.mount(container);

    expect(toolbarRenderOptions[0].showAddButton).toBe(false);
    expect(container.querySelector('.fab')).toBeNull();

    await toolbarRenderOptions[0].onViewChange('active');

    expect(toolbarUpdateOptions.at(-1).showAddButton).toBe(true);
    expect(container.querySelector('.fab')).not.toBeNull();
  });

  it('renders active and archived empty-state copy variants', async () => {
    const container = document.createElement('main');

    window.scrollTo = vi.fn();
    window.history.replaceState({}, '', '/');
    api.getAll.mockResolvedValue([]);

    await Tracker.mount(container);
    expect(container.querySelector('.empty-state')?.textContent)
      .toBe('No applications yet. Add your first one!');

    await toolbarRenderOptions[0].onViewChange('archived');
    expect(container.querySelector('.empty-state')?.innerHTML)
      .toBe('Nothing archived yet.<br>Archived applications will appear here.');

    api.getAll.mockImplementation((options) => (
      options?.view === 'archived'
        ? Promise.resolve([createApplication(2, { status: 'rejected', archived: true })])
        : Promise.resolve([createApplication(1, { status: 'applied' })])
    ));
    await toolbarRenderOptions[0].onViewChange('active');
    toolbarRenderOptions[0].onFilterChange({
      ...toolbarRenderOptions[0].filterState,
      favoritesOnly: true,
    });
    expect(container.querySelector('.empty-state--filter')?.innerHTML)
      .toBe('No applications match<br>the active filters.');

    await toolbarRenderOptions[0].onViewChange('archived');
    expect(container.querySelector('.empty-state--filter')?.innerHTML)
      .toBe('No archived items match<br>the active filters.');
  });

  it('unarchives archived cards locally, updates counts, and keeps rows on failure', async () => {
    const container = document.createElement('main');
    const archived = createApplication(2, { archived: true, archivedDate: '2026-05-01' });
    const restored = { ...archived, archived: false, archivedDate: null };

    window.scrollTo = vi.fn();
    window.history.replaceState({}, '', '/?view=archived');
    api.getAll.mockImplementation((options) => (
      options?.view === 'archived' ? Promise.resolve([archived]) : Promise.resolve([createApplication(1)])
    ));
    api.unarchive.mockResolvedValue(restored);

    await Tracker.mount(container);
    container.querySelector('.card-btn--unarchive').click();
    await Promise.resolve();

    expect(api.unarchive).toHaveBeenCalledWith(2);
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(0);
    expect(document.body.textContent).toContain('Unarchived.');
    expect(toolbarUpdateOptions.at(-1).viewCounts).toEqual({ activeCount: 2, archivedCount: 0 });

    api.unarchive.mockRejectedValue(new Error('server error'));
    api.getAll.mockImplementation((options) => (
      options?.view === 'archived' ? Promise.resolve([archived]) : Promise.resolve([])
    ));
    await toolbarRenderOptions[0].onViewChange('active');
    await toolbarRenderOptions[0].onViewChange('archived');
    container.querySelector('.card-btn--unarchive').click();
    await Promise.resolve();

    expect(container.querySelectorAll('.card-list .card')).toHaveLength(1);
    expect(document.body.textContent).toContain('Unarchive failed');
  });

  it('updates view summary counts after archive without switching views', async () => {
    const container = document.createElement('main');
    const original = createApplication(1);

    window.scrollTo = vi.fn();
    ConfirmDialog.show.mockResolvedValue(true);
    api.getAll.mockImplementation((options) => (
      options?.view === 'archived'
        ? Promise.resolve(Array.from({ length: 5 }, (_, index) => createApplication(index + 20, { archived: true })))
        : Promise.resolve(Array.from({ length: 8 }, (_, index) => createApplication(index + 1)))
    ));
    api.archive.mockResolvedValue({ ...original, archived: true, archivedDate: '2026-05-01' });

    await Tracker.mount(container);
    container.querySelector('.card-btn--archive').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(toolbarUpdateOptions.at(-1).viewCounts).toEqual({ activeCount: 7, archivedCount: 6 });
  });

  it('shows application skeleton cards while the application list is loading', async () => {
    const container = document.createElement('main');
    let resolveApplications;

    window.scrollTo = vi.fn();
    api.getAll.mockReturnValue(new Promise((resolve) => {
      resolveApplications = resolve;
    }));

    const mountPromise = Tracker.mount(container);

    expect(container.querySelector('.loading-skeleton--applications')).not.toBeNull();
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(3);
    expect(container.querySelector('.loading-skeleton')?.getAttribute('aria-busy')).toBe('true');

    resolveApplications([]);
    await mountPromise;

    expect(container.querySelector('.loading-skeleton--applications')).toBeNull();
  });

  it('shows an inline error with retry when the initial application list fails', async () => {
    const container = document.createElement('main');
    const retried = createApplication(7);
    let resolveRetry;

    document.body.append(container);
    window.scrollTo = vi.fn();
    api.getAll
      .mockRejectedValueOnce(new Error('server down'))
      .mockReturnValueOnce(Promise.resolve([]))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveRetry = resolve;
      }))
      .mockReturnValue(Promise.resolve([]));

    await Tracker.mount(container);

    const errorBlock = container.querySelector('.inline-error');
    const retryButton = container.querySelector('.inline-error__retry');

    expect(errorBlock).not.toBeNull();
    expect(errorBlock.querySelector('.inline-error__message')?.textContent)
      .toBe("Couldn't load your applications. Check your connection or try again.");
    expect(retryButton).not.toBeNull();
    expect(document.activeElement).toBe(retryButton);
    expect(document.body.textContent).not.toContain('Applications failed to load');

    retryButton.click();

    expect(api.getAll).toHaveBeenCalledTimes(4);
    expect(container.querySelector('.loading-skeleton--applications')).not.toBeNull();

    resolveRetry([retried]);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(container.querySelector('.inline-error')).toBeNull();
    expect(container.querySelector('.loading-skeleton--applications')).toBeNull();
    expect(container.textContent).toContain('Role 7');
  });

  it('shows a destination skeleton and view chip busy state while switching views', async () => {
    const container = document.createElement('main');
    const active = createApplication(1);
    const archived = createApplication(2, { archived: true, archivedDate: '2026-05-01' });
    let resolveArchived;

    window.scrollTo = vi.fn();
    let viewSwitchStarted = false;
    api.getAll.mockImplementation((options) => {
      if (options?.view === 'archived') {
        if (!viewSwitchStarted) {
          return Promise.resolve([]);
        }
        return new Promise((resolve) => {
          resolveArchived = resolve;
        });
      }
      return Promise.resolve([active]);
    });

    await Tracker.mount(container);
    viewSwitchStarted = true;
    const switchPromise = toolbarRenderOptions[0].onViewChange('archived');

    expect(container.querySelector('.loading-skeleton--applications')).not.toBeNull();
    expect(container.textContent).not.toContain('Role 1');
    expect(toolbarUpdateOptions.at(-1).viewBusy).toBe(true);

    resolveArchived([archived]);
    await switchPromise;

    expect(container.querySelector('.loading-skeleton--applications')).toBeNull();
    expect(container.textContent).toContain('Role 2');
    expect(toolbarUpdateOptions.at(-1).viewBusy).toBe(false);
  });

  it('renders a mobile FAB that uses the same add-application callback surface as the toolbar', async () => {
    const container = document.createElement('main');

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([]);

    await Tracker.mount(container);

    const fab = container.querySelector('.fab');

    expect(fab).not.toBeNull();
    expect(fab.type).toBe('button');
    expect(fab.getAttribute('aria-label')).toBe('New application');
    // Phase 13: FAB renders an inline plus SVG instead of a "+" text glyph.
    expect(fab.querySelector('svg.fab__icon')).not.toBeNull();
    expect(toolbarRenderOptions[0].onAddApplication).toBeTypeOf('function');
  });

  it('opens create mode from New application and prepends created records', async () => {
    const container = document.createElement('main');
    const existing = createApplication(1);
    const created = createApplication(42, {
      jobTitle: 'New Role',
      companyName: 'New Company',
      salary: 250000,
    });
    const openSpy = vi.spyOn(CreationPicker, 'open').mockImplementation(() => {});

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([existing]);

    await Tracker.mount(container);
    toolbarRenderOptions[0].onAddApplication();

    expect(openSpy).toHaveBeenCalledWith(expect.objectContaining({
      onApplicationCreate: expect.any(Function),
    }));

    openSpy.mock.calls.at(-1)[0].onApplicationCreate(created);

    expect(toolbarUpdateOptions.at(-1).apps[0]).toEqual(created);
    expect(toolbarUpdateOptions.at(-1).salaryBounds.max).toBe(250000);
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(2);
    expect(container.textContent).toContain('New Role');
  });

  it('renders the first created record after mounting with an empty list', async () => {
    const container = document.createElement('main');
    const created = createApplication(42, {
      jobTitle: 'First Role',
      companyName: 'First Company',
    });
    const openSpy = vi.spyOn(CreationPicker, 'open').mockImplementation(() => {});

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([]);

    await Tracker.mount(container);
    toolbarRenderOptions[0].onAddApplication();
    openSpy.mock.calls.at(-1)[0].onApplicationCreate(created);

    expect(container.querySelector('.empty-state')).toBeNull();
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(1);
    expect(container.textContent).toContain('First Role');
  });

  it('defines responsive FAB, safe-area, desktop-hidden, and modal stacking styles', () => {
    // Phase 13: FAB sits above the bottom tab bar at 72px + safe area, anchored at
    // right: 16px; z-index uses the --z-nav stack (FAB is one above the nav layer).
    expect(mainCss).toContain('bottom: calc(72px + env(safe-area-inset-bottom));');
    expect(mainCss).toContain('right: 16px;');
    expect(mainCss).toContain('z-index: calc(var(--z-nav) + 1);');
    expect(mainCss).toContain('width: 56px;');
    expect(mainCss).toContain('height: 56px;');
    expect(mainCss).toContain('border-radius: 50%;');
    // FAB visibility flipped from <=768px to <=639px to match the design's mobile breakpoint.
    expect(mainCss).toContain('@media (max-width: 639px)');
    expect(mainCss).toMatch(/\.fab \{\r?\n    display: inline-flex;/);
    expect(mainCss).toMatch(/\.new-app-btn \{\r?\n    display: none;/);
    expect(mainCss).toContain('--z-modal: 300;');
    expect(mainCss).toMatch(
      /\.modal-backdrop \{\r?\n  position: fixed;\r?\n  inset: 0;\r?\n  z-index: var\(--z-modal\);/,
    );
  });

  it('disables skeleton shimmer when reduced motion is requested', () => {
    expect(mainCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.skeleton-line,[\s\S]*animation: none !important;/,
    );
    expect(mainCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.skeleton-line \{[\s\S]*background: #ECE7DF !important;/,
    );
  });

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

  it('shows an empty state when favorites-only is enabled with zero favorite records', async () => {
    const container = document.createElement('main');

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([
      createApplication(1, { fav: false }),
      createApplication(2, { fav: false }),
    ]);

    await Tracker.mount(container);
    toolbarRenderOptions[0].onFilterChange({
      ...toolbarRenderOptions[0].filterState,
      favoritesOnly: true,
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

  it('keeps overlay status changes local until save exists', async () => {
    const container = document.createElement('main');
    const original = createApplication(1, { status: 'applied' });

    window.scrollTo = vi.fn();
    api.getAll.mockResolvedValue([original]);
    api.getById.mockResolvedValue(original);

    await Tracker.mount(container);
    container.querySelector('.card').click();
    await Promise.resolve();
    document.querySelector('.modal-quick-action--status').click();
    document.querySelector('[data-status="offer"]').click();
    await Promise.resolve();

    expect(api.update).not.toHaveBeenCalled();
    expect(document.querySelector('#modal-status-badge').textContent).toBe('Offer');
    expect(container.querySelector('.status-badge').textContent).toBe('Applied');
  });

  it('removes cards after overlay archive confirmation', async () => {
    const container = document.createElement('main');
    const original = createApplication(1);

    window.scrollTo = vi.fn();
    ConfirmDialog.show.mockResolvedValue(true);
    api.getAll.mockResolvedValue([original]);
    api.getById.mockResolvedValue(original);
    api.archive.mockResolvedValue({ ...original, archived: true, fav: false });

    await Tracker.mount(container);
    container.querySelector('.card').click();
    await Promise.resolve();
    document.querySelector('.modal-quick-action--archive').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.archive).toHaveBeenCalledWith(1);
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(0);
  });

  it('asks for confirmation before archiving from a card action', async () => {
    const container = document.createElement('main');
    const original = createApplication(1);

    window.scrollTo = vi.fn();
    ConfirmDialog.show.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    api.getAll.mockResolvedValue([original]);
    api.archive.mockResolvedValue({ ...original, archived: true, fav: false });

    await Tracker.mount(container);
    container.querySelector('.card-btn--archive').click();
    await Promise.resolve();

    expect(ConfirmDialog.show).toHaveBeenCalledWith('Archive this application?');
    expect(api.archive).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(1);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    container.querySelector('.card-btn--archive').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.archive).toHaveBeenCalledWith(1);
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(0);
  });

  it('keeps cards visible when overlay archive confirmation fails', async () => {
    const container = document.createElement('main');
    const original = createApplication(1);

    window.scrollTo = vi.fn();
    ConfirmDialog.show.mockResolvedValue(true);
    api.getAll.mockResolvedValue([original]);
    api.getById.mockResolvedValue(original);
    api.archive.mockRejectedValue(new Error('server error'));

    await Tracker.mount(container);
    container.querySelector('.card').click();
    await Promise.resolve();
    document.querySelector('.modal-quick-action--archive').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.archive).toHaveBeenCalledWith(1);
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();
    expect(container.querySelectorAll('.card-list .card')).toHaveLength(1);
    expect(document.body.textContent).toContain('Archive failed');
  });
});

describe('Tracker stored filter validation', () => {
  it('discards unknown statuses and corrupted favorites values', () => {
    expect(normalizeStoredFilterState({
      statuses: ['applied', 'missing'],
      favoritesOnly: 'yes',
      shifts: ['Day', 'InvalidValue'],
      workSetups: ['Remote', 'Bad'],
      locations: ['Manila', 42, null],
    })).toEqual(expect.objectContaining({
      statuses: ['applied'],
      favoritesOnly: false,
      shifts: ['Day'],
      workSetups: ['Remote'],
      locations: ['Manila'],
    }));
  });

  it('defaults missing new filter arrays to empty arrays', () => {
    expect(normalizeStoredFilterState({})).toEqual(expect.objectContaining({
      shifts: [],
      workSetups: [],
      locations: [],
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

  it('round-trips new filter arrays through serialized storage', () => {
    const restored = normalizeStoredFilterState(JSON.parse(JSON.stringify({
      shifts: ['Day'],
      workSetups: ['Remote'],
      locations: ['Manila'],
    })));

    expect(restored).toEqual(expect.objectContaining({
      shifts: ['Day'],
      workSetups: ['Remote'],
      locations: ['Manila'],
    }));
  });

  it('strips invalid new filter values after serialized storage restore', () => {
    const restored = normalizeStoredFilterState(JSON.parse(JSON.stringify({
      shifts: ['Day', 'InvalidValue'],
      workSetups: ['Remote', 'Invalid'],
      locations: ['Manila', 123],
    })));

    expect(restored).toEqual(expect.objectContaining({
      shifts: ['Day'],
      workSetups: ['Remote'],
      locations: ['Manila'],
    }));
  });
});
