import { describe, expect, it } from 'vitest';
import { STATUS_VALUES } from '../../shared/constants.js';
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_SORT_STATE,
  applyFilters,
  filterByCompany,
  filterByCompat,
  filterByFavorites,
  filterByLocation,
  filterBySalary,
  filterByShift,
  filterByStatus,
  filterByWorkSetup,
  getAvailableCompanies,
  getAvailableLocations,
  getAvailableStatuses,
  getSalaryBounds,
  isAnyFilterActive,
  isDefaultSort,
  sortApplications,
  syncDynamicSelections,
} from '../../src/utils/filterSort.js';

const apps = [
  { id: 1, status: 'wishlisted', companyName: 'Zenith', salary: 110000, compat: 84, fav: true, location: 'Manila', shift: 'Day', workSetup: 'Remote' },
  { id: 2, status: 'applied', companyName: 'Acme', salary: 95000, compat: 72, location: 'Cebu', shift: 'Night', workSetup: 'Hybrid' },
  { id: 3, status: 'phone_screen', companyName: 'Beta', salary: 80000, compat: 55, location: 'Manila', shift: 'Mid', workSetup: 'On-site' },
  { id: 4, status: 'interview', companyName: 'Acme', salary: 125000, compat: 91, location: 'Quezon City', shift: 'Day', workSetup: 'Remote' },
  { id: 5, status: 'assessment', companyName: 'Delta', salary: 150000, compat: 64, location: '', shift: 'Flexible', workSetup: 'Field' },
  { id: 6, status: 'offer', companyName: 'Cobalt', salary: 120000, compat: 99, fav: true, location: 'Cebu', shift: 'Night', workSetup: 'Remote' },
  { id: 7, status: 'rejected', companyName: 'Beta', salary: null, compat: 15, location: null, shift: '', workSetup: '' },
  { id: 8, status: 'withdrawn', companyName: 'Echo', salary: 0, compat: 0, location: 'Baguio', shift: 'Flexible', workSetup: 'Hybrid' },
  { id: 9, status: 'ghosted', companyName: 'Foxtrot', salary: 95000, compat: 72, location: 'Manila', shift: 'Day', workSetup: 'Remote' },
  { id: 10, status: 'applied', companyName: 'Acme', salary: 95000, compat: 72, location: 'Davao', shift: 'Mid', workSetup: 'Field' },
];

function ids(records) {
  return records.map((app) => app.id);
}

describe('salary bounds', () => {
  it('uses the fixed peso filter range and reports when salary data exists', () => {
    expect(getSalaryBounds(apps)).toEqual({ min: 50000, max: 250000, hasSalaryData: true });
    expect(getSalaryBounds([{ salary: null }, { salary: 0 }]))
      .toEqual({ min: 50000, max: 250000, hasSalaryData: false });
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
    expect(ids(filterBySalary(apps, 100000, 120000))).toEqual([1, 6, 8]);
    expect(ids(filterBySalary(apps, 90000, 100000))).toEqual([2, 8, 9, 10]);
    expect(ids(filterBySalary(apps, 140000, 160000))).toEqual([5, 8]);
    expect(ids(filterBySalary(apps, 140000, null))).toEqual([5, 8]);
    expect(ids(filterBySalary(apps, 180000, 190000))).toEqual([8]);
  });

  it('handles absent salaries and the top salary bucket', () => {
    expect(ids(filterBySalary([
      { id: 1, salary: null },
      { id: 2, salary: 0 },
      { id: 3, salary: 50000 },
      { id: 4, salary: 250000 },
      { id: 5, salary: 320000 },
    ], null, 250000))).toEqual([1, 2, 3, 4, 5]);
    expect(ids(filterBySalary([
      { id: 1, salary: null },
      { id: 2, salary: 0 },
      { id: 3, salary: 50000 },
    ], 50000, 250000))).toEqual([2, 3]);
  });

  it('filters by compatibility with null and boundary values', () => {
    expect(filterByCompat(apps, null, null)).toBe(apps);
    expect(ids(filterByCompat(apps, 72, 91))).toEqual([1, 2, 4, 9, 10]);
    expect(ids(filterByCompat(apps, 0, 0))).toEqual([8]);
  });

  it('filters by favorites only when the favorites toggle is enabled', () => {
    expect(filterByFavorites(apps, false)).toBe(apps);
    expect(ids(filterByFavorites(apps, true))).toEqual([1, 6]);
    expect(filterByFavorites([{ id: 11, fav: false }], true)).toEqual([]);
  });

  it('filters by shift, work setup, and location with empty arrays as no-ops', () => {
    expect(filterByShift(apps, [])).toBe(apps);
    expect(ids(filterByShift(apps, ['Night']))).toEqual([2, 6]);
    expect(filterByWorkSetup(apps, [])).toBe(apps);
    expect(ids(filterByWorkSetup(apps, ['Remote']))).toEqual([1, 4, 6, 9]);
    expect(filterByLocation(apps, [])).toBe(apps);
    expect(ids(filterByLocation(apps, ['Manila']))).toEqual([1, 3, 9]);
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
    }))).toEqual([]);
    expect(ids(applyFilters(apps, {
      ...DEFAULT_FILTER_STATE,
      statuses: ['offer'],
      favoritesOnly: true,
    }))).toEqual([6]);
    expect(ids(applyFilters(apps, {
      ...DEFAULT_FILTER_STATE,
      statuses: ['applied'],
      shifts: ['Mid'],
      workSetups: ['Field'],
      locations: ['Davao'],
    }))).toEqual([10]);
    expect(applyFilters(apps, DEFAULT_FILTER_STATE)).toBe(apps);
  });

  it('composes favorites-only with status filters', () => {
    expect(ids(applyFilters([
      { id: 1, status: 'applied', fav: true },
      { id: 2, status: 'applied', fav: false },
      { id: 3, status: 'offer', fav: true },
    ], {
      ...DEFAULT_FILTER_STATE,
      statuses: ['applied'],
      favoritesOnly: true,
    }))).toEqual([1]);
  });

  it('applies single new-field filters independently', () => {
    expect(ids(applyFilters(apps, { ...DEFAULT_FILTER_STATE, shifts: ['Day'] })))
      .toEqual([1, 4, 9]);
    expect(ids(applyFilters(apps, { ...DEFAULT_FILTER_STATE, workSetups: ['Remote'] })))
      .toEqual([1, 4, 6, 9]);
    expect(ids(applyFilters(apps, { ...DEFAULT_FILTER_STATE, locations: ['Manila'] })))
      .toEqual([1, 3, 9]);
  });
});

describe('isAnyFilterActive', () => {
  it('detects active filter dimensions', () => {
    expect(isAnyFilterActive(DEFAULT_FILTER_STATE)).toBe(false);
    expect(isAnyFilterActive({ ...DEFAULT_FILTER_STATE, statuses: ['applied'] })).toBe(true);
    expect(isAnyFilterActive({ ...DEFAULT_FILTER_STATE, salaryMin: 100000 })).toBe(true);
    expect(isAnyFilterActive({ ...DEFAULT_FILTER_STATE, compatMax: 90 })).toBe(true);
    expect(isAnyFilterActive({ ...DEFAULT_FILTER_STATE, favoritesOnly: true })).toBe(true);
    expect(isAnyFilterActive({ ...DEFAULT_FILTER_STATE, shifts: ['Day'] })).toBe(true);
    expect(isAnyFilterActive({ ...DEFAULT_FILTER_STATE, workSetups: ['Remote'] })).toBe(true);
    expect(isAnyFilterActive({ ...DEFAULT_FILTER_STATE, locations: ['Manila'] })).toBe(true);
  });
});

describe('dynamic options', () => {
  it('returns available statuses after non-status filters in status order', () => {
    expect(getAvailableStatuses(apps, {
      ...DEFAULT_FILTER_STATE,
      statuses: ['applied'],
      salaryMin: 120000,
      salaryMax: 130000,
    })).toEqual(['interview', 'offer', 'withdrawn']);
    expect(getAvailableStatuses(apps, DEFAULT_FILTER_STATE)).toEqual(STATUS_VALUES);
    expect(getAvailableStatuses(apps, {
      ...DEFAULT_FILTER_STATE,
      favoritesOnly: true,
    })).toEqual(['wishlisted', 'offer']);
  });

  it('returns available companies after non-company filters alphabetically', () => {
    expect(getAvailableCompanies(apps, {
      ...DEFAULT_FILTER_STATE,
      companies: ['Acme'],
      statuses: ['applied'],
    })).toEqual(['Acme']);
    expect(getAvailableCompanies(apps, DEFAULT_FILTER_STATE))
      .toEqual(['Acme', 'Beta', 'Cobalt', 'Delta', 'Echo', 'Foxtrot', 'Zenith']);
    expect(getAvailableCompanies(apps, {
      ...DEFAULT_FILTER_STATE,
      favoritesOnly: true,
    })).toEqual(['Cobalt', 'Zenith']);
  });

  it('returns sorted distinct non-empty locations after non-location filters', () => {
    expect(getAvailableLocations(apps, DEFAULT_FILTER_STATE))
      .toEqual(['Baguio', 'Cebu', 'Davao', 'Manila', 'Quezon City']);
    expect(getAvailableLocations(apps, {
      ...DEFAULT_FILTER_STATE,
      statuses: ['applied'],
    })).toEqual(['Cebu', 'Davao']);
    expect(getAvailableLocations(apps, {
      ...DEFAULT_FILTER_STATE,
      locations: ['Manila'],
      favoritesOnly: true,
    })).toEqual(['Cebu', 'Manila']);
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

  it('syncs unavailable selected locations out of state', () => {
    const current = {
      ...DEFAULT_FILTER_STATE,
      locations: ['Manila', 'Missing'],
      statuses: ['applied'],
    };

    expect(syncDynamicSelections(current, apps)).toEqual({
      ...current,
      locations: [],
    });
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
