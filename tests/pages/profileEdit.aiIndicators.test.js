// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/api.js', () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

vi.mock('../../src/components/Toast.js', () => ({
  Toast: {
    show: vi.fn(),
  },
}));

vi.mock('../../src/data/authStore.js', () => ({
  getAuthState: () => ({ status: 'local-mode', user: null, accessToken: null }),
  subscribe: () => () => {},
  signOut: vi.fn(),
  getAccessToken: () => null,
}));

vi.mock('../../src/services/resumeApi.js', () => ({
  extractText: vi.fn(),
  parseText: vi.fn(),
  parseResume: vi.fn(),
}));

vi.mock('../../src/data/aiSettings.js', () => ({
  getKey: vi.fn(),
  getFeature: vi.fn(),
  getModel: vi.fn(),
  hasKey: vi.fn(),
  isEnabled: vi.fn(),
}));

vi.mock('../../src/services/llmParser.js', () => ({
  REASON_CODES: {},
  mapErrorToReason: vi.fn(() => 'rate_limit'),
  parseWithLlm: vi.fn(),
}));

import * as aiSettings from '../../src/data/aiSettings.js';
import { parseWithLlm } from '../../src/services/llmParser.js';
import { parseText } from '../../src/services/resumeApi.js';
import * as api from '../../src/services/api.js';
import { ProfileEdit } from '../../src/pages/ProfileEdit.js';

afterEach(() => {
  ProfileEdit.unmount();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

beforeEach(() => {
  aiSettings.isEnabled.mockReturnValue(true);
  aiSettings.getFeature.mockImplementation((key) => key === 'cv');
  aiSettings.getModel.mockReturnValue('openrouter/model-slug');
  aiSettings.hasKey.mockReturnValue(false);
  aiSettings.getKey.mockReturnValue('');
});

function createProfile(overrides = {}) {
  return {
    firstName: '',
    lastName: '',
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

function getCard(container, title) {
  return [...container.querySelectorAll('.section-card')]
    .find((card) => card.querySelector('.section-label')?.textContent === title);
}

function getField(card, label) {
  return [...card.querySelectorAll('.edit-field')]
    .find((field) => field.querySelector('.edit-field__label')?.textContent?.startsWith(label));
}

function getButton(container, label) {
  return [...container.querySelectorAll('button')]
    .filter((button) => button.textContent === label)
    .at(-1);
}

function getSaveButton(container) {
  return container.querySelector('.page-controls__save');
}

function inputValue(input, value) {
  let target = input;

  if (!target) {
    document.querySelector('.profile-import-bar__toggle')?.click();
    const pasteTab = [...document.querySelectorAll('.profile-import-bar .resume-import button')]
      .find((button) => button.textContent === 'Paste text');

    pasteTab?.click();
    target = document.querySelector('.resume-import__paste-input');
  }

  target.value = value;
  target.dispatchEvent(new window.Event('input', { bubbles: true }));
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function importPastedResume(container, text) {
  const textarea = container.querySelector('.resume-import__paste-input');

  inputValue(textarea, text);
  getButton(container, 'Process resume').click();
  await flushPromises();
}

function expectAiBadge(target) {
  const badge = target.querySelector('.ai-field-badge');

  expect(badge).not.toBeNull();
  expect(badge.querySelector('img')).not.toBeNull();
  expect(badge.getAttribute('aria-label')).toBe('AI-generated field');
  expect(badge.title).toBe('AI-generated field');
}

function getSectionProvenance(card) {
  return card.querySelector('.section-provenance')?.textContent ?? '';
}

function getEntryByTitle(card, title) {
  return [...card.querySelectorAll('.entry-row')]
    .find((row) => row.querySelector('.profile-entry__title')?.textContent?.includes(title));
}

describe('ProfileEdit AI field indicators', () => {
  it('renders AI indicators, clears edited field indicators, and saves normal values only', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());
    api.saveProfile.mockResolvedValue(createProfile());
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockResolvedValue({
      draft: {
        firstName: 'Jane',
        lastName: 'Doe',
        summary: 'Built calm hiring tools.',
        experience: [{
          role: 'Frontend Engineer',
          company: 'Acme',
          responsibilities: 'Built accessible profile screens.',
          dateStarted: '01/2024',
          dateEnded: '02/2025',
          currentWork: false,
        }],
      },
      truncated: false,
    });

    await ProfileEdit.mount(container, { navigate: vi.fn() });
    await importPastedResume(container, 'Jane Doe resume with enough detail');

    const basicInfo = getCard(container, 'BASIC INFO');
    const summary = getCard(container, 'SUMMARY');
    const experience = getCard(container, 'PROFESSIONAL EXPERIENCE');
    const firstName = getField(basicInfo, 'First Name');
    const summaryField = getField(summary, 'Summary');
    const entry = experience.querySelector('.entry-row');

    expectAiBadge(firstName);
    expectAiBadge(summaryField);
    expectAiBadge(entry);

    inputValue(firstName.querySelector('.edit-field__control'), 'Janet');

    expect(firstName.querySelector('.ai-field-badge')).toBeNull();
    expectAiBadge(summaryField);

    getSaveButton(container).click();
    await flushPromises();

    expect(api.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Janet',
      lastName: 'Doe',
      summary: 'Built calm hiring tools.',
    }));
    expect(api.saveProfile).not.toHaveBeenCalledWith(expect.objectContaining({
      _aiFields: expect.anything(),
    }));
  });

  it('badges only AI values that were actually applied to an existing profile', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      firstName: 'Bob',
      lastName: 'Manual',
      experience: [{
        role: 'Existing Engineer',
        company: 'OldCo',
        responsibilities: 'Maintained the existing profile.',
        dateStarted: '01/2023',
        dateEnded: '12/2023',
        currentWork: false,
      }],
    }));
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockResolvedValue({
      draft: {
        firstName: 'Jane',
        summary: 'AI-filled summary for review.',
        experience: [{
          role: 'Imported Engineer',
          company: 'NewCo',
          responsibilities: 'Built imported work history.',
          dateStarted: '01/2024',
          dateEnded: '02/2025',
          currentWork: false,
        }],
      },
      truncated: false,
    });

    await ProfileEdit.mount(container, { navigate: vi.fn() });
    await importPastedResume(container, 'Jane Doe resume with enough detail');

    const basicInfo = getCard(container, 'BASIC INFO');
    const summary = getCard(container, 'SUMMARY');
    const experience = getCard(container, 'PROFESSIONAL EXPERIENCE');
    const firstName = getField(basicInfo, 'First Name');
    const summaryField = getField(summary, 'Summary');
    const existingEntry = getEntryByTitle(experience, 'Existing Engineer');
    const importedEntry = getEntryByTitle(experience, 'Imported Engineer');

    expect(firstName.querySelector('.edit-field__control').value).toBe('Bob');
    expect(firstName.querySelector('.ai-field-badge')).toBeNull();
    expectAiBadge(summaryField);
    expect(existingEntry.querySelector('.ai-field-badge')).toBeNull();
    expectAiBadge(importedEntry);
  });

  it('renders no AI indicators for rule-based imports with an empty AI field set', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());
    parseText.mockResolvedValue({
      firstName: 'Rule',
      lastName: 'Based',
      summary: 'Imported without LLM provenance.',
    });

    await ProfileEdit.mount(container, { navigate: vi.fn() });
    await importPastedResume(container, 'Rule Based resume with enough detail');

    expect(container.querySelector('.ai-field-badge')).toBeNull();
    expect(getSectionProvenance(getCard(container, 'BASIC INFO'))).toContain('Auto-filled');
    expect(getSectionProvenance(getCard(container, 'SUMMARY'))).toContain('Auto-filled');
  });
});
