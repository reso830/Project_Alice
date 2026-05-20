// Canonical no-network-in-demo regression guard (feature 020). Every
// export in `src/services/api.js` must short-circuit to `demoStore`
// when `authStore.getAuthState().status === 'demo'`, and `fetch` must
// never be called. If a future service export forgets the demo branch,
// the spy assertion below fails immediately.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authStoreMock = {
  DEMO_STATUS: 'demo',
  getAuthState: vi.fn(() => ({ status: 'demo', user: null, accessToken: null })),
  getAccessToken: vi.fn(() => null),
};

const demoStoreMock = {
  getAll: vi.fn(() => 'sentinel:getAll'),
  getById: vi.fn(() => 'sentinel:getById'),
  create: vi.fn(() => 'sentinel:create'),
  update: vi.fn(() => 'sentinel:update'),
  archive: vi.fn(() => 'sentinel:archive'),
  getProfile: vi.fn(() => 'sentinel:getProfile'),
  saveProfile: vi.fn(() => 'sentinel:saveProfile'),
  loadSeed: vi.fn(),
  clear: vi.fn(),
};

vi.mock('../../src/data/authStore.js', () => authStoreMock);
vi.mock('../../src/data/demoStore.js', () => demoStoreMock);

let fetchSpy;

beforeEach(() => {
  for (const fn of Object.values(demoStoreMock)) {
    if (typeof fn === 'function' && typeof fn.mockClear === 'function') {
      fn.mockClear();
    }
  }
  authStoreMock.getAuthState.mockClear();
  authStoreMock.getAccessToken.mockClear();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('services/api.js — demo mode delegates to demoStore, no fetch', () => {
  it('getAll() returns demoStore.getAll() and does not call fetch', async () => {
    const api = await import('../../src/services/api.js');
    await expect(api.getAll()).resolves.toBe('sentinel:getAll');
    expect(demoStoreMock.getAll).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('getById(id) returns demoStore.getById(id) and does not call fetch', async () => {
    const api = await import('../../src/services/api.js');
    await expect(api.getById(7)).resolves.toBe('sentinel:getById');
    expect(demoStoreMock.getById).toHaveBeenCalledWith(7);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('create(fields) returns demoStore.create(fields) and does not call fetch', async () => {
    const api = await import('../../src/services/api.js');
    const fields = { companyName: 'Demo Co', jobTitle: 'Test' };
    await expect(api.create(fields)).resolves.toBe('sentinel:create');
    expect(demoStoreMock.create).toHaveBeenCalledWith(fields);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('update(id, fields) returns demoStore.update(id, fields) and does not call fetch', async () => {
    const api = await import('../../src/services/api.js');
    const fields = { status: 'interview' };
    await expect(api.update(3, fields)).resolves.toBe('sentinel:update');
    expect(demoStoreMock.update).toHaveBeenCalledWith(3, fields);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('archive(id) returns demoStore.archive(id) and does not call fetch', async () => {
    const api = await import('../../src/services/api.js');
    await expect(api.archive(4)).resolves.toBe('sentinel:archive');
    expect(demoStoreMock.archive).toHaveBeenCalledWith(4);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('getProfile() returns demoStore.getProfile() and does not call fetch', async () => {
    const api = await import('../../src/services/api.js');
    await expect(api.getProfile()).resolves.toBe('sentinel:getProfile');
    expect(demoStoreMock.getProfile).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('saveProfile(profile) returns demoStore.saveProfile(profile) and does not call fetch', async () => {
    const api = await import('../../src/services/api.js');
    const profile = { firstName: 'Demo', lastName: 'User' };
    await expect(api.saveProfile(profile)).resolves.toBe('sentinel:saveProfile');
    expect(demoStoreMock.saveProfile).toHaveBeenCalledWith(profile);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an end-to-end CRUD sequence triggers zero fetch calls in total', async () => {
    const api = await import('../../src/services/api.js');
    await api.getAll();
    await api.getById(1);
    await api.create({ companyName: 'C', jobTitle: 'T' });
    await api.update(1, { status: 'applied' });
    await api.archive(1);
    await api.getProfile();
    await api.saveProfile({ firstName: 'D' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects with the demoStore-thrown error shape (no wrapping) when create throws', async () => {
    demoStoreMock.create.mockImplementationOnce(() => {
      throw { code: 'VALIDATION_ERROR', message: 'Validation failed', fields: {} };
    });
    const api = await import('../../src/services/api.js');
    await expect(api.create({})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
