import { STATUS_VALUES } from '../../shared/constants.js';

export const DEFAULT_FILTER_STATE = {
  statuses: [],
  companies: [],
  salaryMin: null,
  salaryMax: null,
  compatMin: null,
  compatMax: null,
  favoritesOnly: false,
};

export const DEFAULT_SORT_STATE = { field: 'id', direction: 'asc' };
export const SALARY_STEP = 1000;

function hasSelections(values) {
  return Array.isArray(values) && values.length > 0;
}

function normalizeBound(value, fallback) {
  return value === null || value === undefined ? fallback : value;
}

function compareNumbers(a, b) {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}

function compareStrings(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''));
}

export function parseSalaryLower(salaryStr) {
  if (typeof salaryStr !== 'string' || salaryStr.trim() === '') {
    return null;
  }

  const match = salaryStr.match(/\$\s*([\d,.]+)\s*([kK])?/);

  if (!match) {
    return null;
  }

  const amount = Number(match[1].replace(/,/g, ''));

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(match[2] ? amount * 1000 : amount);
}

export function parseSalaryRange(salaryStr) {
  if (typeof salaryStr !== 'string') {
    return null;
  }

  const [lowerPart, upperPart] = salaryStr.split('-');
  const min = parseSalaryLower(lowerPart ?? '');

  if (min === null) {
    return null;
  }

  const max = parseSalaryLower(upperPart ?? '');

  return { min, max: max ?? min };
}

export function getSalaryBounds(apps) {
  const ranges = apps
    .map((app) => parseSalaryRange(app.salary))
    .filter((range) => range !== null);

  if (ranges.length === 0) {
    return { min: 0, max: 200000, hasSalaryData: false };
  }

  const min = Math.min(...ranges.map((range) => range.min));
  const max = Math.max(...ranges.map((range) => range.max));

  return {
    min: Math.round(min / SALARY_STEP) * SALARY_STEP,
    max: Math.round(max / SALARY_STEP) * SALARY_STEP,
    hasSalaryData: true,
  };
}

export function filterByStatus(apps, statuses) {
  if (!hasSelections(statuses)) {
    return apps;
  }

  return apps.filter((app) => statuses.includes(app.status));
}

export function filterByCompany(apps, companies) {
  if (!hasSelections(companies)) {
    return apps;
  }

  return apps.filter((app) => companies.includes(app.companyName));
}

export function filterByFavorites(apps, favoritesOnly) {
  if (!favoritesOnly) {
    return apps;
  }

  return apps.filter((app) => app.fav === true);
}

export function filterBySalary(apps, min, max) {
  if (min === null && max === null) {
    return apps;
  }

  const lowerBound = normalizeBound(min, Number.NEGATIVE_INFINITY);
  const upperBound = normalizeBound(max, Number.POSITIVE_INFINITY);

  return apps.filter((app) => {
    const range = parseSalaryRange(app.salary);

    if (!range) {
      return false;
    }

    return range.min <= upperBound && range.max >= lowerBound;
  });
}

export function filterByCompat(apps, min, max) {
  if (min === null && max === null) {
    return apps;
  }

  const lowerBound = normalizeBound(min, Number.NEGATIVE_INFINITY);
  const upperBound = normalizeBound(max, Number.POSITIVE_INFINITY);

  return apps.filter((app) => app.compat >= lowerBound && app.compat <= upperBound);
}

export function applyFilters(apps, filterState) {
  return filterByCompat(
    filterBySalary(
      filterByCompany(
        filterByFavorites(
          filterByStatus(apps, filterState.statuses),
          filterState.favoritesOnly,
        ),
        filterState.companies,
      ),
      filterState.salaryMin,
      filterState.salaryMax,
    ),
    filterState.compatMin,
    filterState.compatMax,
  );
}

export function isAnyFilterActive(filterState) {
  return hasSelections(filterState.statuses)
    || hasSelections(filterState.companies)
    || filterState.salaryMin !== null
    || filterState.salaryMax !== null
    || filterState.compatMin !== null
    || filterState.compatMax !== null
    || filterState.favoritesOnly === true;
}

export function getAvailableStatuses(apps, filterState) {
  const filtered = filterByCompat(
    filterBySalary(
      filterByCompany(apps, filterState.companies),
      filterState.salaryMin,
      filterState.salaryMax,
    ),
    filterState.compatMin,
    filterState.compatMax,
  );
  const values = new Set(filtered.map((app) => app.status));

  return STATUS_VALUES.filter((status) => values.has(status));
}

export function getAvailableCompanies(apps, filterState) {
  const filtered = filterByCompat(
    filterBySalary(
      filterByStatus(apps, filterState.statuses),
      filterState.salaryMin,
      filterState.salaryMax,
    ),
    filterState.compatMin,
    filterState.compatMax,
  );
  const values = new Set(filtered.map((app) => app.companyName));

  return [...values].sort((a, b) => a.localeCompare(b));
}

export function syncDynamicSelections(filterState, apps) {
  const availableStatuses = getAvailableStatuses(apps, filterState);
  const availableCompanies = getAvailableCompanies(apps, filterState);
  const statuses = filterState.statuses.filter((status) => (
    availableStatuses.includes(status)
  ));
  const companies = filterState.companies.filter((company) => (
    availableCompanies.includes(company)
  ));

  if (
    statuses.length === filterState.statuses.length
    && companies.length === filterState.companies.length
  ) {
    return filterState;
  }

  return { ...filterState, statuses, companies };
}

export function sortApplications(apps, sortState) {
  const direction = sortState.direction === 'desc' ? -1 : 1;

  return [...apps].sort((a, b) => {
    let result = 0;

    if (sortState.field === 'status') {
      result = compareNumbers(STATUS_VALUES.indexOf(a.status), STATUS_VALUES.indexOf(b.status));
    } else if (sortState.field === 'compat') {
      result = compareNumbers(a.compat, b.compat);
    } else if (sortState.field === 'salary') {
      result = compareNumbers(
        parseSalaryLower(a.salary) ?? Number.POSITIVE_INFINITY,
        parseSalaryLower(b.salary) ?? Number.POSITIVE_INFINITY,
      );
    } else if (sortState.field === 'companyName') {
      result = compareStrings(a.companyName, b.companyName);
    } else {
      result = compareNumbers(a.id, b.id);
    }

    if (result !== 0) {
      return result * direction;
    }

    return compareNumbers(a.id, b.id);
  });
}

export function isDefaultSort(sortState) {
  return sortState.field === DEFAULT_SORT_STATE.field
    && sortState.direction === DEFAULT_SORT_STATE.direction;
}
