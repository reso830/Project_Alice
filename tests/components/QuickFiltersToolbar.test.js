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

describe('QuickFiltersToolbar', () => {
  it('renders the default label, count, and inactive filter buttons', () => {
    const { toolbar } = renderToolbar();

    expect(toolbar.querySelector('.toolbar__label')?.textContent).toContain('All Applications');
    expect(toolbar.querySelector('.count-badge')?.textContent).toBe(String(apps.length));
    expect(toolbar.querySelector('[aria-label="Filter by Status"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(toolbar.querySelector('[aria-label="Filter by Company"]')?.getAttribute('aria-pressed'))
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

    expect(buttons).toHaveLength(2);
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
});
