// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickFiltersToolbar } from '../../src/components/QuickFiltersToolbar.js';
import { STATUS_CONFIG } from '../../src/models/application.js';
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_SORT_STATE,
} from '../../src/utils/filterSort.js';

const apps = [
  {
    id: 1,
    status: 'applied',
    companyName: 'Acme',
    salary: 110000,
    compat: 80,
    location: 'Manila',
    shift: 'Day',
    workSetup: 'Remote',
  },
  {
    id: 2,
    status: 'interview',
    companyName: 'Beta',
    salary: 90000,
    compat: 72,
    location: 'Cebu',
    shift: 'Night',
    workSetup: 'Hybrid',
  },
  {
    id: 3,
    status: 'offer',
    companyName: 'Acme',
    salary: 140000,
    compat: 92,
    location: 'Manila',
    shift: 'Mid',
    workSetup: 'Remote',
  },
];

function renderToolbar(overrides = {}) {
  const options = {
    apps,
    totalCount: apps.length,
    filteredCount: apps.length,
    filterState: { ...DEFAULT_FILTER_STATE },
    sortState: { ...DEFAULT_SORT_STATE },
    salaryBounds: { min: 50000, max: 250000, hasSalaryData: true },
    onFilterChange: vi.fn(),
    onSortChange: vi.fn(),
    onClearAll: vi.fn(),
    onAddApplication: vi.fn(),
    onViewChange: vi.fn(),
    ...overrides,
  };
  const toolbar = QuickFiltersToolbar.render(options);

  document.body.append(toolbar);

  return { toolbar, options };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function setRangeTrackRect(_toolbar, { width = 200 } = {}) {
  const track = document.querySelector('.range-track');

  track.getBoundingClientRect = () => ({
    left: 0,
    right: width,
    width,
    top: 0,
    bottom: 4,
    height: 4,
  });
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
}

describe('QuickFiltersToolbar', () => {
  it('renders the default label, count, and inactive filter buttons', () => {
    const { toolbar } = renderToolbar();

    expect(toolbar.querySelector('.toolbar__label')?.textContent).toContain('Applications');
    expect(toolbar.querySelector('.count-badge')?.textContent).toBe(String(apps.length));
    expect(toolbar.querySelector('.toolbar__controls')).not.toBeNull();
    expect(toolbar.classList.contains('subheader')).toBe(true);
    expect(toolbar.querySelector('.toolbar__left')?.contains(toolbar.querySelector('.toolbar__label')))
      .toBe(true);
    expect(toolbar.querySelector('.toolbar__right')?.contains(toolbar.querySelector('.toolbar__controls')))
      .toBe(true);
    expect(toolbar.querySelector('.toolbar__add')?.textContent).toBe('+ New application');
    expect(toolbar.querySelector('.toolbar__add')?.classList.contains('new-app-btn')).toBe(true);
    expect(toolbar.querySelector('[aria-label="Filter by Status"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Salary"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Compatibility"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Company"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Shift"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Work Setup"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Location"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Favorites only"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Sort"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Status"]')?.title).toBe('Status');
    expect(toolbar.querySelector('[aria-label="Filter by Status"]')?.dataset.tooltip).toBeUndefined();
    expect([...toolbar.querySelectorAll('.filter-btn')].every((button) => button.querySelector('svg.icon')))
      .toBe(true);
    expect(toolbar.querySelector('.erase-btn')).toBeNull();
  });

  it('opens the view popup and selects the archived view', () => {
    const onViewChange = vi.fn();
    const { toolbar } = renderToolbar({
      onViewChange,
      currentView: 'active',
      viewCounts: { activeCount: 8, archivedCount: 5 },
    });

    toolbar.querySelector('.app-title-trigger')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('.view-popup')).not.toBeNull();
    expect([...document.querySelectorAll('.view-popup__option-label')]
      .map((node) => node.textContent)).toEqual(['Applications', 'Archived']);
    expect([...document.querySelectorAll('.view-popup__count')]
      .map((node) => node.textContent)).toEqual(['8', '5']);

    [...document.querySelectorAll('.view-popup__option')]
      .find((button) => button.textContent.includes('Archived'))
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onViewChange).toHaveBeenCalledWith('archived');
    expect(document.querySelector('.view-popup')).toBeNull();
  });

  it('uses unfiltered popup counts while the chip uses the filtered current-view count', () => {
    const { toolbar } = renderToolbar({
      currentView: 'archived',
      filteredCount: 1,
      totalCount: 5,
      viewCounts: { activeCount: 8, archivedCount: 5 },
      filterState: { ...DEFAULT_FILTER_STATE, statuses: ['interview'] },
    });

    expect(toolbar.querySelector('.app-title-trigger')?.textContent).toContain('Archived');
    expect(toolbar.querySelector('.count-badge')?.textContent).toBe('1');

    toolbar.querySelector('.app-title-trigger')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect([...document.querySelectorAll('.view-popup__count')]
      .map((node) => node.textContent)).toEqual(['8', '5']);
  });

  it('refreshes view popup counts when count props change', () => {
    const { toolbar } = renderToolbar({
      viewCounts: { activeCount: 8, archivedCount: 5 },
    });

    toolbar.querySelector('.app-title-trigger')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect([...document.querySelectorAll('.view-popup__count')]
      .map((node) => node.textContent)).toEqual(['8', '5']);

    QuickFiltersToolbar.update(toolbar, {
      apps,
      totalCount: apps.length,
      filteredCount: apps.length,
      filterState: DEFAULT_FILTER_STATE,
      sortState: DEFAULT_SORT_STATE,
      viewCounts: { activeCount: 7, archivedCount: 6 },
    });

    expect([...document.querySelectorAll('.view-popup__count')]
      .map((node) => node.textContent)).toEqual(['7', '6']);
  });

  it('marks the view chip busy while a view change is in flight', () => {
    const { toolbar } = renderToolbar();
    const chip = toolbar.querySelector('.view-chip');

    expect(chip?.hasAttribute('aria-busy')).toBe(false);

    QuickFiltersToolbar.update(toolbar, {
      apps,
      totalCount: apps.length,
      filteredCount: apps.length,
      filterState: DEFAULT_FILTER_STATE,
      sortState: DEFAULT_SORT_STATE,
      viewBusy: true,
    });

    expect(chip?.getAttribute('aria-busy')).toBe('true');

    QuickFiltersToolbar.update(toolbar, {
      apps,
      totalCount: apps.length,
      filteredCount: apps.length,
      filterState: DEFAULT_FILTER_STATE,
      sortState: DEFAULT_SORT_STATE,
      viewBusy: false,
    });

    expect(chip?.hasAttribute('aria-busy')).toBe(false);
  });

  it('closes the view popup on Escape and outside click', () => {
    const { toolbar } = renderToolbar();
    const trigger = toolbar.querySelector('.app-title-trigger');

    trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.view-popup')).not.toBeNull();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.view-popup')).toBeNull();

    trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.view-popup')).not.toBeNull();
    document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.view-popup')).toBeNull();
  });

  it('renders the new filter buttons after the existing filters', () => {
    const { toolbar } = renderToolbar();

    expect([...toolbar.querySelectorAll('.toolbar__filters .filter-btn')]
      .map((button) => button.getAttribute('aria-label'))).toEqual([
      'Favorites only',
      'Filter by Status',
      'Filter by Salary',
      'Filter by Compatibility',
      'Filter by Company',
      'Filter by Shift',
      'Filter by Work Setup',
      'Filter by Location',
    ]);
  });

  it('updates the label, count, and status pressed state for active filters', () => {
    const { toolbar } = renderToolbar();

    QuickFiltersToolbar.update(toolbar, {
      apps,
      totalCount: apps.length,
      filteredCount: 1,
      filterState: { ...DEFAULT_FILTER_STATE, statuses: ['applied'] },
      sortState: DEFAULT_SORT_STATE,
    });

    expect(toolbar.querySelector('.toolbar__label')?.textContent).toContain('Applications');
    expect(toolbar.querySelector('.count-badge')?.textContent).toBe('1');
    expect(toolbar.querySelector('[aria-label="Filter by Status"]')?.getAttribute('aria-pressed'))
      .toBe('true');
  });

  it('updates sort pressed state when sort changes', () => {
    const { toolbar } = renderToolbar();

    QuickFiltersToolbar.update(toolbar, {
      apps,
      totalCount: apps.length,
      filteredCount: apps.length,
      filterState: DEFAULT_FILTER_STATE,
      sortState: { field: 'compat', direction: 'desc' },
    });

    expect(toolbar.querySelector('[aria-label="Sort"]')?.getAttribute('aria-pressed'))
      .toBe('true');
  });

  it('calls onFilterChange with updated status selections from the panel', () => {
    const onFilterChange = vi.fn();
    const { toolbar } = renderToolbar({ onFilterChange });
    const statusButton = toolbar.querySelector('[aria-label="Filter by Status"]');

    statusButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    document.querySelector('[data-value="applied"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onFilterChange).toHaveBeenCalledOnce();
    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTER_STATE,
      statuses: ['applied'],
    });
  });

  it('toggles favorites-only filtering from the toolbar button', () => {
    const onFilterChange = vi.fn();
    const { toolbar } = renderToolbar({ onFilterChange });

    toolbar.querySelector('[aria-label="Favorites only"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTER_STATE,
      favoritesOnly: true,
    });
  });

  it('opens the shift panel and calls onFilterChange with selected shifts', () => {
    const onFilterChange = vi.fn();
    const { toolbar } = renderToolbar({ onFilterChange });

    toolbar.querySelector('[aria-label="Filter by Shift"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect([...document.querySelectorAll('.filter-panel__option-label')]
      .map((label) => label.textContent)).toEqual(['(Not set)', 'Day', 'Mid', 'Night', 'Flexible']);

    document.querySelector('[data-value="Day"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTER_STATE,
      shifts: ['Day'],
    });

    document.querySelector('[data-value=""]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onFilterChange).toHaveBeenLastCalledWith({
      ...DEFAULT_FILTER_STATE,
      shifts: [''],
    });
  });

  it('opens work setup and location panels and updates the matching arrays', () => {
    const onFilterChange = vi.fn();
    const { toolbar } = renderToolbar({ onFilterChange });

    toolbar.querySelector('[aria-label="Filter by Work Setup"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect([...document.querySelectorAll('.filter-panel__option-label')]
      .map((label) => label.textContent)).toEqual(['(Not set)', 'Remote', 'Hybrid', 'On-site', 'Field']);

    document.querySelector('[data-value="Remote"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    toolbar.querySelector('[aria-label="Filter by Location"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect([...document.querySelectorAll('.filter-panel__option-label')]
      .map((label) => label.textContent)).toEqual(['(Not set)', 'Cebu', 'Manila']);

    document.querySelector('[data-value="Manila"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onFilterChange).toHaveBeenNthCalledWith(1, {
      ...DEFAULT_FILTER_STATE,
      workSetups: ['Remote'],
    });
    expect(onFilterChange).toHaveBeenNthCalledWith(2, {
      ...DEFAULT_FILTER_STATE,
      locations: ['Manila'],
    });
  });

  it('positions the sort panel with viewport-fixed coordinates', () => {
    const { toolbar } = renderToolbar();
    const sortButton = toolbar.querySelector('[aria-label="Sort"]');
    sortButton.getBoundingClientRect = () => ({
      left: 320,
      right: 348,
      top: 540,
      bottom: 568,
      width: 28,
      height: 28,
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });

    sortButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    const panel = document.querySelector('.sort-panel');

    expect(panel).not.toBeNull();
    expect(panel.style.top).toBe('576px');
    expect(panel.style.left).toBe('128px');
  });

  it('updates favorites-only pressed state for active filters', () => {
    const { toolbar } = renderToolbar();

    QuickFiltersToolbar.update(toolbar, {
      apps,
      totalCount: apps.length,
      filteredCount: 1,
      filterState: { ...DEFAULT_FILTER_STATE, favoritesOnly: true },
      sortState: DEFAULT_SORT_STATE,
    });

    expect(toolbar.querySelector('[aria-label="Favorites only"]')?.getAttribute('aria-pressed'))
      .toBe('true');
    expect(toolbar.dataset.activeFilterCount).toBe('1');
  });

  it('counts and presses the new filter arrays', () => {
    const { toolbar } = renderToolbar();

    QuickFiltersToolbar.update(toolbar, {
      apps,
      totalCount: apps.length,
      filteredCount: 1,
      filterState: {
        ...DEFAULT_FILTER_STATE,
        shifts: ['Day', 'Night'],
        workSetups: ['Remote'],
        locations: ['Manila'],
      },
      sortState: DEFAULT_SORT_STATE,
    });

    expect(toolbar.dataset.activeFilterCount).toBe('4');
    expect(toolbar.querySelector('[aria-label="Filter by Shift"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(toolbar.querySelector('[aria-label="Filter by Work Setup"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(toolbar.querySelector('[aria-label="Filter by Location"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders status filter dots from STATUS_CONFIG colors', () => {
    const { toolbar } = renderToolbar();
    const statusButton = toolbar.querySelector('[aria-label="Filter by Status"]');

    statusButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    const appliedDot = document.querySelector('[data-value="applied"] .filter-panel__dot');

    expect(appliedDot.style.backgroundColor).toBe(hexToRgb(STATUS_CONFIG.applied.borderAccent));
    expect(appliedDot.style.border).toBe('');
  });

  it('calls onAddApplication from the primary toolbar action', () => {
    const onAddApplication = vi.fn();
    const { toolbar } = renderToolbar({ onAddApplication });

    toolbar.querySelector('.toolbar__add')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onAddApplication).toHaveBeenCalledOnce();
  });

  it('disables filter buttons when there are no applications and re-enables on update', () => {
    const { toolbar } = renderToolbar({
      apps: [],
      totalCount: 0,
      filteredCount: 0,
    });
    const buttons = [...toolbar.querySelectorAll('.filter-btn')];

    expect(buttons).toHaveLength(9);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(buttons.every((button) => button.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect(toolbar.querySelector('.erase-btn')).toBeNull();

    QuickFiltersToolbar.update(toolbar, {
      apps,
      totalCount: apps.length,
      filteredCount: apps.length,
      filterState: DEFAULT_FILTER_STATE,
      sortState: DEFAULT_SORT_STATE,
    });

    expect(buttons.every((button) => !button.disabled)).toBe(true);
    expect(buttons.every((button) => button.getAttribute('aria-disabled') === 'false')).toBe(true);
  });

  it('converts full-extent salary and compatibility commits back to null bounds', () => {
    const onFilterChange = vi.fn();
    const { toolbar } = renderToolbar({
      filterState: { ...DEFAULT_FILTER_STATE, salaryMin: 50000 },
      onFilterChange,
    });

    toolbar.querySelector('[aria-label="Filter by Salary"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    setRangeTrackRect(toolbar);
    document.querySelector('.range-thumb--min')
      .dispatchEvent(new window.MouseEvent('mousedown', { clientX: 50, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 0, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));

    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTER_STATE,
      salaryMin: null,
      salaryMax: null,
    });

    document.body.replaceChildren();
    onFilterChange.mockClear();

    const { toolbar: compatToolbar } = renderToolbar({
      filterState: { ...DEFAULT_FILTER_STATE, compatMin: 10 },
      onFilterChange,
    });

    compatToolbar.querySelector('[aria-label="Filter by Compatibility"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    setRangeTrackRect(compatToolbar, { width: 100 });
    document.querySelector('.range-thumb--min')
      .dispatchEvent(new window.MouseEvent('mousedown', { clientX: 10, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 0, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));

    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTER_STATE,
      compatMin: null,
      compatMax: null,
    });
  });

  it('converts partial salary range commits with full max back to a null upper bound', () => {
    const onFilterChange = vi.fn();
    const { toolbar } = renderToolbar({
      onFilterChange,
    });

    toolbar.querySelector('[aria-label="Filter by Salary"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    setRangeTrackRect(toolbar);
    document.querySelector('.range-thumb--min')
      .dispatchEvent(new window.MouseEvent('mousedown', { clientX: 0, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 50, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));

    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTER_STATE,
      salaryMin: 100000,
      salaryMax: null,
    });
  });

  it('rounds salary and compatibility labels during drag', () => {
    const { toolbar } = renderToolbar();

    toolbar.querySelector('[aria-label="Filter by Salary"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    setRangeTrackRect(toolbar, { width: 100 });
    document.querySelector('.range-thumb--max')
      .dispatchEvent(new window.MouseEvent('mousedown', { clientX: 100, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 55, bubbles: true }));

    expect(document.querySelector('.range-value--max').textContent).toBe('₱160k');

    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    toolbar.querySelector('[aria-label="Filter by Compatibility"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    setRangeTrackRect(toolbar, { width: 100 });
    document.querySelector('.range-thumb--min')
      .dispatchEvent(new window.MouseEvent('mousedown', { clientX: 0, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 33.4, bubbles: true }));

    expect(document.querySelector('.range-value--min').textContent).toBe('33%');
  });

  it('disables only the salary button when there is no salary data', () => {
    const { toolbar } = renderToolbar({
      salaryBounds: { min: 0, max: 200000, hasSalaryData: false },
    });
    const salaryButton = toolbar.querySelector('[aria-label="Filter by Salary (no salary data)"]');

    expect(salaryButton.disabled).toBe(true);
    expect(salaryButton.getAttribute('aria-disabled')).toBe('true');
    expect(toolbar.querySelector('[aria-label="Filter by Status"]').disabled).toBe(false);
    expect(toolbar.querySelector('[aria-label="Filter by Compatibility"]').disabled).toBe(false);
    expect(toolbar.querySelector('[aria-label="Filter by Company"]').disabled).toBe(false);
    expect(toolbar.querySelector('[aria-label="Filter by Location"]').disabled).toBe(false);
  });

  it('renders salary range bounds in Philippine Peso with the top bucket label', () => {
    const { toolbar } = renderToolbar();

    toolbar.querySelector('[aria-label="Filter by Salary"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('.range-bounds').textContent).toBe('₱50k₱250k+');
  });

  it('calls onSortChange from the sort panel and restores default sort', () => {
    const onSortChange = vi.fn();
    const { toolbar } = renderToolbar({
      sortState: { field: 'id', direction: 'asc' },
      onSortChange,
    });
    const sortButton = toolbar.querySelector('[aria-label="Sort"]');

    sortButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    [...document.querySelectorAll('.sort-panel__option')]
      .find((option) => option.textContent === 'Compatibility')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onSortChange).toHaveBeenCalledWith({ field: 'compat', direction: 'asc' });

    document.body.replaceChildren();
    onSortChange.mockClear();

    const { toolbar: sortedToolbar } = renderToolbar({
      sortState: { field: 'compat', direction: 'desc' },
      onSortChange,
    });

    sortedToolbar.querySelector('[aria-label="Sort"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    [...document.querySelectorAll('.sort-panel__option')]
      .find((option) => option.textContent === 'Restore default')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onSortChange).toHaveBeenCalledWith(DEFAULT_SORT_STATE);
    expect(document.querySelector('.sort-panel')).toBeNull();
  });

  it('shows erase-all for active filters and calls onClearAll', () => {
    const onClearAll = vi.fn();
    const { toolbar } = renderToolbar({ onClearAll });

    expect(toolbar.querySelector('.erase-btn')).toBeNull();

    QuickFiltersToolbar.update(toolbar, {
      apps,
      totalCount: apps.length,
      filteredCount: 1,
      filterState: { ...DEFAULT_FILTER_STATE, statuses: ['applied'] },
      sortState: DEFAULT_SORT_STATE,
    });

    const eraseButton = toolbar.querySelector('.erase-btn');

    expect(eraseButton).not.toBeNull();
    expect(eraseButton.title).toBe('Clear all filters');

    eraseButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it('keeps erase-all absent when total count is zero even with active filters', () => {
    const { toolbar } = renderToolbar({
      apps: [],
      totalCount: 0,
      filteredCount: 0,
      filterState: { ...DEFAULT_FILTER_STATE, statuses: ['applied'] },
    });

    expect(toolbar.querySelector('.erase-btn')).toBeNull();
  });

  it('shows zero-result filter state with erase-all available', () => {
    const { toolbar } = renderToolbar();

    QuickFiltersToolbar.update(toolbar, {
      apps,
      totalCount: apps.length,
      filteredCount: 0,
      filterState: { ...DEFAULT_FILTER_STATE, statuses: ['applied'] },
      sortState: DEFAULT_SORT_STATE,
    });

    expect(toolbar.querySelector('.toolbar__label')?.textContent).toContain('Applications');
    expect(toolbar.querySelector('.count-badge')?.textContent).toBe('0');
    expect(toolbar.querySelector('.erase-btn')).not.toBeNull();
  });

  it('renders required ARIA attributes for toolbar controls and panels', () => {
    const { toolbar } = renderToolbar();

    for (const label of [
      'Filter by Status',
      'Filter by Salary',
      'Filter by Compatibility',
      'Filter by Company',
      'Filter by Shift',
      'Filter by Work Setup',
      'Filter by Location',
      'Favorites only',
      'Sort',
    ]) {
      const button = toolbar.querySelector(`[aria-label="${label}"]`);

      expect(button).not.toBeNull();
      expect(button.hasAttribute('aria-pressed')).toBe(true);
    }

    toolbar.querySelector('[aria-label="Filter by Status"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    const checkbox = document.querySelector('[data-value="applied"]');

    expect(checkbox.getAttribute('role')).toBe('checkbox');
    expect(checkbox.hasAttribute('aria-checked')).toBe(true);

    toolbar.querySelector('[aria-label="Sort"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('[aria-label="Restore default sort"]')).not.toBeNull();
  });

  it('returns focus to each trigger when Escape closes an open panel', () => {
    const { toolbar } = renderToolbar();

    for (const label of [
      'Filter by Status',
      'Filter by Salary',
      'Filter by Compatibility',
      'Filter by Company',
      'Filter by Shift',
      'Filter by Work Setup',
      'Filter by Location',
      'Sort',
    ]) {
      const button = toolbar.querySelector(`[aria-label="${label}"]`);

      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      expect(document.querySelector('.filter-panel, .sort-panel')).not.toBeNull();

      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(document.querySelector('.filter-panel, .sort-panel')).toBeNull();
      expect(document.activeElement).toBe(button);
    }
  });
});
