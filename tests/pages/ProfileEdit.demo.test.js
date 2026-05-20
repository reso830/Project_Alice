// @vitest-environment jsdom
//
// ProfileEdit — demo branch coverage (feature 020). When the visitor is
// in the portfolio demo, the resume-import slot renders the inline
// "sign in to use resume import" note instead of mounting the upload
// component. Authenticated regression is covered by the existing
// `tests/pages/ProfileEdit.test.js` suite, which mocks authStore to
// `'local-mode'`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/api.js', () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

vi.mock('../../src/components/Toast.js', () => ({
  Toast: { show: vi.fn() },
}));

vi.mock('../../src/data/authStore.js', () => ({
  DEMO_STATUS: 'demo',
  getAuthState: () => ({ status: 'demo', user: null, accessToken: null }),
  subscribe: () => () => {},
  signOut: vi.fn(),
  exitDemo: vi.fn(),
  getAccessToken: () => null,
}));

const resumeImportMocks = vi.hoisted(() => ({
  create: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../src/components/ResumeImport.js', () => ({
  ResumeImport: resumeImportMocks,
  VISIBLE_STATUSES: new Set(['local-mode', 'authenticated']),
}));

import * as api from '../../src/services/api.js';
import { ProfileEdit } from '../../src/pages/ProfileEdit.js';

function createProfile(overrides = {}) {
  return {
    firstName: 'Alex',
    lastName: 'Rivera',
    city: '',
    email: '',
    phone: '',
    summary: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    awards: [],
    languages: [],
    links: [],
    ...overrides,
  };
}

function createAppShell() {
  const navbar = document.createElement('header');
  const container = document.createElement('main');
  navbar.className = 'navbar';
  container.id = 'app';
  document.body.append(navbar, container);
  return container;
}

beforeEach(() => {
  resumeImportMocks.create.mockClear();
});

afterEach(() => {
  ProfileEdit.unmount();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe('ProfileEdit — demo branch (feature 020)', () => {
  it('renders the inline resume-demo note in the slot when status is "demo"', async () => {
    const container = createAppShell();
    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const note = container.querySelector('.profile-edit__resume-demo-note');
    expect(note).not.toBeNull();
    expect(note.textContent).toBe('Resume import is available after signing in.');
    expect(note.getAttribute('role')).toBe('note');
  });

  it('does NOT call ResumeImport.create in demo', async () => {
    const container = createAppShell();
    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    expect(resumeImportMocks.create).not.toHaveBeenCalled();
  });
});
