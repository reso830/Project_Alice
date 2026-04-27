// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickFiltersToolbar } from '../../src/components/QuickFiltersToolbar.js';
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_SORT_STATE,
} from '../../src/utils/filterSort.js';

const apps = [
  {
    id: 1,
    status: 'applied',
    companyName: 'Acme',
    salary: '$110k-$130k',
    compat: 80,
  },
  {
    id: 2,
    status: 'interview',
    companyName: 'Beta',
    salary: '$90k-$120k',
    compat: 72,
  },
  {
    id: 3,
    status: 'offer',
    companyName: 'Acme',
    salary: '$140k',
    compat: 92,
  },
];

function renderToolbar(overrides = {}) {
  const options = {
    apps,
    totalCount: apps.length,
    filteredCount: apps.length,
    filterState: { ...DEFAULT_FILTER_STATE },
    sortState: { ...DEFAULT_SORT_STATE },
    salaryBounds: { min: 90000, max: 140000, hasSalaryData: true },
    onFilterChange: vi.fn(),
    onSortChange: vi.fn(),
    onClearAll: vi.fn(),
    onAddApplication: vi.fn(),
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

function setRangeTrackRect(toolbar, { width = 200 } = {}) {
  const track = toolbar.querySelector('.range-track');

  track.getBoundingClientRect = () => ({
    left: 0,
    right: width,
    width,
    top: 0,
    bottom: 4,
    height: 4,
  });
}

describe('QuickFiltersToolbar', () => {
  it('renders the default label, count, and inactive filter buttons', () => {
    const { toolbar } = renderToolbar();

    expect(toolbar.querySelector('.toolbar__label')?.textContent).toContain('All Applications');
    expect(toolbar.querySelector('.count-badge')?.textContent).toBe(String(apps.length));
    expect(toolbar.querySelector('[aria-label="Filter by Status"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Salary"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Compatibility"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Company"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Sort"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('.erase-btn')).toBeNull();
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

    expect(toolbar.querySelector('.toolbar__label')?.textContent).toBe('Results');
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
    toolbar.querySelector('[data-value="applied"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onFilterChange).toHaveBeenCalledOnce();
    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTER_STATE,
      statuses: ['applied'],
    });
  });

  it('disables filter buttons when there are no applications and re-enables on update', () => {
    const { toolbar } = renderToolbar({
      apps: [],
      totalCount: 0,
      filteredCount: 0,
    });
    const buttons = [...toolbar.querySelectorAll('.filter-btn')];

    expect(buttons).toHaveLength(5);
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
      salaryBounds: { min: 0, max: 200000, hasSalaryData: true },
      onFilterChange,
    });

    toolbar.querySelector('[aria-label="Filter by Salary"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    setRangeTrackRect(toolbar);
    toolbar.querySelector('.range-thumb--min')
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
    compatToolbar.querySelector('.range-thumb--min')
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
      salaryBounds: { min: 0, max: 200000, hasSalaryData: true },
      onFilterChange,
    });

    toolbar.querySelector('[aria-label="Filter by Salary"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    setRangeTrackRect(toolbar);
    toolbar.querySelector('.range-thumb--min')
      .dispatchEvent(new window.MouseEvent('mousedown', { clientX: 0, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 50, bubbles: true }));
    document.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));

    expect(onFilterChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTER_STATE,
      salaryMin: 50000,
      salaryMax: null,
    });
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
  });

  it('calls onSortChange from the sort panel and restores default sort', () => {
    const onSortChange = vi.fn();
    const { toolbar } = renderToolbar({
      sortState: { field: 'id', direction: 'asc' },
      onSortChange,
    });
    const sortButton = toolbar.querySelector('[aria-label="Sort"]');

    sortButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    [...toolbar.querySelectorAll('.sort-panel__option')]
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
    [...sortedToolbar.querySelectorAll('.sort-panel__option')]
      .find((option) => option.textContent === 'Restore default')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onSortChange).toHaveBeenCalledWith(DEFAULT_SORT_STATE);
    expect(sortedToolbar.querySelector('.sort-panel')).toBeNull();
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

    eraseButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onClearAll).toHaveBeenCalledOnce();
  });
});
