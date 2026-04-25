import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAll,
  getById,
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
      position: 'Frontend Engineer',
      company: 'Acme Corp',
      status: 'wishlisted',
      last_status_update: '2026-04-20',
      compat: 55,
      fav: false,
      responsibilities: '',
      skills: [],
      salary: '',
      recruiter: '',
      url: '',
    },
    {
      id: '002',
      position: 'Backend Engineer',
      company: 'Beta Inc',
      status: 'interview',
      last_status_update: '2026-04-21',
      compat: 80,
      fav: false,
      responsibilities: '',
      skills: [],
      salary: '',
      recruiter: '',
      url: '',
    },
    {
      id: '003',
      position: 'Product Engineer',
      company: 'Gamma LLC',
      status: 'offer',
      last_status_update: '2026-04-22',
      compat: 90,
      fav: false,
      responsibilities: '',
      skills: [],
      salary: '',
      recruiter: '',
      url: '',
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

  it('updates status and last_status_update for a matching id', () => {
    save(records());

    updateStatus('002', 'applied');

    expect(getById('002').status).toBe('applied');
    expect(getById('002').last_status_update).toBe(toISODate());
  });

  it('does nothing when updating a missing id', () => {
    save(records());
    const before = getAll();

    expect(() => updateStatus('999', 'applied')).not.toThrow();
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

    expect(getById('003').company).toBe('Gamma LLC');
    expect(getById('999')).toBeUndefined();
  });
});
