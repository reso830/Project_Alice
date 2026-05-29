// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/api.js', () => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  getProfile: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../src/data/authStore.js', () => ({
  getAuthState: () => ({ status: 'local-mode', user: null, accessToken: null }),
  subscribe: () => () => {},
}));

vi.mock('../../src/components/Toast.js', () => ({
  Toast: { show: vi.fn() },
}));

import * as api from '../../src/services/api.js';
import { Calendar } from '../../src/pages/Calendar.js';
import { Profile } from '../../src/pages/Profile.js';
import { ProfileEdit } from '../../src/pages/ProfileEdit.js';
import { Tracker } from '../../src/pages/Tracker.js';

const BARE_LOADING_TEXT = [
  'Loading…',
  'Loading...',
  'Loading applications...',
  'Loading profile...',
];

function expectNoBareLoading(container) {
  for (const text of BARE_LOADING_TEXT) {
    expect(container.textContent).not.toContain(text);
  }
}

function never() {
  return new Promise(() => {});
}

async function flushPromises(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  window.scrollTo = vi.fn();
  window.history.replaceState({}, '', '/');
  vi.clearAllMocks();
});

afterEach(() => {
  Calendar.unmount();
  Profile.unmount();
  ProfileEdit.unmount();
  Tracker.unmount();
  document.body.replaceChildren();
});

describe('covered loading surfaces avoid bare loading text', () => {
  it('renders skeletons instead of bare loading strings on pending covered pages', async () => {
    let container = document.createElement('main');
    api.getAll.mockReturnValue(never());
    Tracker.mount(container);
    expectNoBareLoading(container);
    Tracker.unmount();

    container = document.createElement('main');
    api.getAll.mockReturnValue(never());
    api.getProfile.mockReturnValue(never());
    Calendar.mount(container);
    expectNoBareLoading(container);
    Calendar.unmount();

    container = document.createElement('main');
    api.getProfile.mockReturnValue(never());
    ProfileEdit.mount(container);
    expectNoBareLoading(container);
    ProfileEdit.unmount();

    container = document.createElement('main');
    api.getProfile.mockResolvedValue(null);
    api.getAll.mockImplementation(({ view } = {}) => (view === 'archived' ? Promise.resolve([]) : never()));
    Profile.mount(container);
    await flushPromises();
    expectNoBareLoading(container);
  });
});
