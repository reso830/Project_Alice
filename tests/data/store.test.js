import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAll,
  getById,
  hasStoredApplications,
  load,
  save,
  STORAGE_KEY,
  toggleFav,
  updateStatus,
} from '../../src/data/store.js';
import { toISODate } from '../../src/utils/date.js';

function createLocalStorageMock() {
  const state = new Map();

  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    setItem(key, value) {
      state.set(key, String(value));
    },
    removeItem(key) {
      state.delete(key);
    },
    clear() {
      state.clear();
    },
  };
}

function records() {
  return [
    {
      id: '001',
      jobTitle: 'Frontend Engineer',
      companyName: 'Acme Corp',
      status: 'wishlisted',
      lastStatusUpdate: '2026-04-20',
      compat: 55,
      fav: false,
      responsibilities: '',
      skills: [],
      salary: '',
      recruiter: '',
      jobPostingUrl: '',
    },
    {
      id: '002',
      jobTitle: 'Backend Engineer',
      companyName: 'Beta Inc',
      status: 'interview',
      lastStatusUpdate: '2026-04-21',
      compat: 80,
      fav: false,
      responsibilities: '',
      skills: [],
      salary: '',
      recruiter: '',
      jobPostingUrl: '',
    },
    {
      id: '003',
      jobTitle: 'Product Engineer',
      companyName: 'Gamma LLC',
      status: 'offer',
      lastStatusUpdate: '2026-04-22',
      compat: 90,
      fav: false,
      responsibilities: '',
      skills: [],
      salary: '',
      recruiter: '',
      jobPostingUrl: '',
    },
  ];
}

describe('store', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 25));
    save([]);
  });

  it('loads an empty array when stored JSON cannot be parsed', () => {
    localStorage.setItem(STORAGE_KEY, '{bad json');

    expect(load()).toEqual([]);
  });

  it('detects whether application storage has been initialized', () => {
    localStorage.removeItem(STORAGE_KEY);
    expect(hasStoredApplications()).toBe(false);

    localStorage.setItem(STORAGE_KEY, '[]');
    expect(hasStoredApplications()).toBe(true);
  });

  it('loads valid stored records', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records()));

    expect(load()).toHaveLength(3);
    expect(getById('002').companyName).toBe('Beta Inc');
  });

  it('updates status and lastStatusUpdate for a matching id', () => {
    save(records());

    expect(updateStatus('002', 'applied')).toBe(true);

    expect(getById('002').status).toBe('applied');
    expect(getById('002').lastStatusUpdate).toBe(toISODate());
  });

  it('coerces invalid status updates to wishlisted', () => {
    save(records());

    expect(updateStatus('002', 'not-real')).toBe(true);

    expect(getById('002').status).toBe('wishlisted');
    expect(getById('002').lastStatusUpdate).toBe(toISODate());
  });

  it('does not save or update the date when status is unchanged', () => {
    save(records());

    expect(updateStatus('002', 'interview')).toBe(false);

    expect(getById('002').status).toBe('interview');
    expect(getById('002').lastStatusUpdate).toBe('2026-04-21');
  });

  it('does nothing when updating a missing id', () => {
    save(records());
    const before = getAll();

    expect(updateStatus('999', 'applied')).toBe(false);
    expect(getAll()).toEqual(before);
  });

  it('toggles fav on and back off', () => {
    save(records());

    toggleFav('001');
    expect(getById('001').fav).toBe(true);

    toggleFav('001');
    expect(getById('001').fav).toBe(false);
  });

  it('finds records by id', () => {
    save(records());

    expect(getById('003').companyName).toBe('Gamma LLC');
    expect(getById('999')).toBeUndefined();
  });

  it('returns copies from getById instead of live store references', () => {
    save(records());

    const application = getById('001');
    application.companyName = 'Mutated';
    application.skills.push('Mutation');

    expect(getById('001').companyName).toBe('Acme Corp');
    expect(getById('001').skills).toEqual([]);
  });
});
