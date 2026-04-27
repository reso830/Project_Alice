import { describe, expect, it } from 'vitest';
import { STATUS_VALUES } from '../../shared/constants.js';
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_SORT_STATE,
  applyFilters,
  filterByCompany,
  filterByCompat,
  filterBySalary,
  filterByStatus,
  getAvailableCompanies,
  getAvailableStatuses,
  getSalaryBounds,
  isAnyFilterActive,
  isDefaultSort,
  parseSalaryLower,
  parseSalaryRange,
  sortApplications,
  syncDynamicSelections,
} from '../../src/utils/filterSort.js';

const apps = [
  { id: 1, status: 'wishlisted', companyName: 'Zenith', salary: '$110k-$130k', compat: 84 },
  { id: 2, status: 'applied', companyName: 'Acme', salary: '$95k-$115k', compat: 72 },
  { id: 3, status: 'phone_screen', companyName: 'Beta', salary: '$80k-$90k', compat: 55 },
  { id: 4, status: 'interview', companyName: 'Acme', salary: '$125k-$145k', compat: 91 },
  { id: 5, status: 'assessment', companyName: 'Delta', salary: '$150k-$170k', compat: 64 },
  { id: 6, status: 'offer', companyName: 'Cobalt', salary: '$120k', compat: 99 },
  { id: 7, status: 'rejected', companyName: 'Beta', salary: '', compat: 15 },
  { id: 8, status: 'withdrawn', companyName: 'Echo', salary: 'competitive', compat: 0 },
  { id: 9, status: 'ghosted', companyName: 'Foxtrot', salary: '$95,000-$115,000', compat: 72 },
  { id: 10, status: 'applied', companyName: 'Acme', salary: '$95k-$125k', compat: 72 },
];

function ids(records) {
  return records.map((app) => app.id);
}

describe('salary parsing', () => {
  it('parses the lower salary amount from supported formats', () => {
    expect(parseSalaryLower('$110k-$130k')).toBe(110000);
    expect(parseSalaryLower('$95,000-$115,000')).toBe(95000);
    expect(parseSalaryLower('')).toBeNull();
    expect(parseSalaryLower('competitive')).toBeNull();
  });

  it('parses salary ranges and falls back to a single-value range', () => {
    expect(parseSalaryRange('$110k-$130k')).toEqual({ min: 110000, max: 130000 });
    expect(parseSalaryRange('$120k')).toEqual({ min: 120000, max: 120000 });
    expect(parseSalaryRange('$120k+')).toEqual({ min: 120000, max: 120000 });
  });

  it('computes salary bounds and reports when no salary data exists', () => {
    expect(getSalaryBounds(apps)).toEqual({ min: 80000, max: 170000, hasSalaryData: true });
    expect(getSalaryBounds([{ salary: '' }, { salary: 'competitive' }]))
      .toEqual({ min: 0, max: 200000, hasSalaryData: false });
  });
});

describe('filter helpers', () => {
  it('filters by status with empty, single, multiple, and missing matches', () => {
    expect(filterByStatus(apps, [])).toBe(apps);
    expect(ids(filterByStatus(apps, ['applied']))).toEqual([2, 10]);
    expect(ids(filterByStatus(apps, ['applied', 'offer']))).toEqual([2, 6, 10]);
    expect(filterByStatus(apps, ['missing'])).toEqual([]);
  });

  it('filters by company with empty, matching, and missing selections', () => {
    expect(filterByCompany(apps, [])).toBe(apps);
    expect(ids(filterByCompany(apps, ['Acme']))).toEqual([2, 4, 10]);
    expect(filterByCompany(apps, ['Missing'])).toEqual([]);
  });

  it('filters by salary overlap and excludes missing salaries only when active', () => {
    expect(filterBySalary(apps, null, null)).toBe(apps);
    expect(ids(filterBySalary(apps, 100000, 120000))).toEqual([1, 2, 6, 9, 10]);
    expect(ids(filterBySalary(apps, 90000, 100000))).toEqual([2, 3, 9, 10]);
    expect(ids(filterBySalary(apps, 140000, 160000))).toEqual([4, 5]);
    expect(ids(filterBySalary(apps, 180000, 190000))).toEqual([]);
  });

  it('filters by compatibility with null and boundary values', () => {
    expect(filterByCompat(apps, null, null)).toBe(apps);
    expect(ids(filterByCompat(apps, 72, 91))).toEqual([1, 2, 4, 9, 10]);
    expect(ids(filterByCompat(apps, 0, 0))).toEqual([8]);
  });
});

describe('applyFilters', () => {
  it('applies cumulative AND logic across active filters', () => {
    expect(ids(applyFilters(apps, {
      ...DEFAULT_FILTER_STATE,
      statuses: ['applied'],
      companies: ['Acme'],
    }))).toEqual([2, 10]);
    expect(ids(applyFilters(apps, {
      ...DEFAULT_FILTER_STATE,
      statuses: ['applied'],
      salaryMin: 120000,
      salaryMax: 130000,
    }))).toEqual([10]);
    expect(applyFilters(apps, DEFAULT_FILTER_STATE)).toBe(apps);
  });
});

describe('isAnyFilterActive', () => {
  it('detects active filter dimensions', () => {
    expect(isAnyFilterActive(DEFAULT_FILTER_STATE)).toBe(false);
    expect(isAnyFilterActive({ ...DEFAULT_FILTER_STATE, statuses: ['applied'] })).toBe(true);
    expect(isAnyFilterActive({ ...DEFAULT_FILTER_STATE, salaryMin: 100000 })).toBe(true);
    expect(isAnyFilterActive({ ...DEFAULT_FILTER_STATE, compatMax: 90 })).toBe(true);
  });
});

describe('dynamic options', () => {
  it('returns available statuses after non-status filters in status order', () => {
    expect(getAvailableStatuses(apps, {
      ...DEFAULT_FILTER_STATE,
      statuses: ['applied'],
      salaryMin: 120000,
      salaryMax: 130000,
    })).toEqual(['wishlisted', 'applied', 'interview', 'offer']);
    expect(getAvailableStatuses(apps, DEFAULT_FILTER_STATE)).toEqual(STATUS_VALUES);
  });

  it('returns available companies after non-company filters alphabetically', () => {
    expect(getAvailableCompanies(apps, {
      ...DEFAULT_FILTER_STATE,
      companies: ['Acme'],
      statuses: ['applied'],
    })).toEqual(['Acme']);
    expect(getAvailableCompanies(apps, DEFAULT_FILTER_STATE))
      .toEqual(['Acme', 'Beta', 'Cobalt', 'Delta', 'Echo', 'Foxtrot', 'Zenith']);
  });

  it('syncs unavailable selected statuses and companies out of state', () => {
    const current = {
      ...DEFAULT_FILTER_STATE,
      statuses: ['interview', 'offer'],
      salaryMin: 100000,
      salaryMax: 121000,
    };
    const synced = syncDynamicSelections(current, apps);
    const unchanged = syncDynamicSelections({ ...DEFAULT_FILTER_STATE, statuses: ['applied'] }, apps);

    expect(synced).toEqual({ ...current, statuses: ['offer'] });
    expect(unchanged).toEqual({ ...DEFAULT_FILTER_STATE, statuses: ['applied'] });
    expect(syncDynamicSelections(unchanged, apps)).toBe(unchanged);
  });
});

describe('sortApplications', () => {
  it('sorts by id in both directions', () => {
    expect(ids(sortApplications(apps, DEFAULT_SORT_STATE))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ids(sortApplications(apps, { field: 'id', direction: 'desc' })))
      .toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('sorts by status order in both directions', () => {
    expect(ids(sortApplications(apps, { field: 'status', direction: 'asc' })))
      .toEqual([1, 2, 10, 3, 4, 5, 6, 7, 8, 9]);
    expect(ids(sortApplications(apps, { field: 'status', direction: 'desc' })))
      .toEqual([9, 8, 7, 6, 5, 4, 3, 2, 10, 1]);
  });

  it('sorts by compatibility in both directions with id tie-breaks', () => {
    expect(ids(sortApplications(apps, { field: 'compat', direction: 'asc' })))
      .toEqual([8, 7, 3, 5, 2, 9, 10, 1, 4, 6]);
    expect(ids(sortApplications(apps, { field: 'compat', direction: 'desc' })))
      .toEqual([6, 4, 1, 2, 9, 10, 5, 3, 7, 8]);
  });

  it('sorts by salary lower bound with missing salaries last ascending and first descending', () => {
    expect(ids(sortApplications(apps, { field: 'salary', direction: 'asc' })))
      .toEqual([3, 2, 9, 10, 1, 6, 4, 5, 7, 8]);
    expect(ids(sortApplications(apps, { field: 'salary', direction: 'desc' })))
      .toEqual([7, 8, 5, 4, 6, 1, 2, 9, 10, 3]);
  });

  it('sorts by company alphabetically in both directions', () => {
    expect(ids(sortApplications(apps, { field: 'companyName', direction: 'asc' })))
      .toEqual([2, 4, 10, 3, 7, 6, 5, 8, 9, 1]);
    expect(ids(sortApplications(apps, { field: 'companyName', direction: 'desc' })))
      .toEqual([1, 9, 8, 5, 6, 3, 7, 2, 4, 10]);
  });

  it('detects default sort state', () => {
    expect(isDefaultSort(DEFAULT_SORT_STATE)).toBe(true);
    expect(isDefaultSort({ field: 'compat', direction: 'asc' })).toBe(false);
    expect(isDefaultSort({ field: 'id', direction: 'desc' })).toBe(false);
  });
});
