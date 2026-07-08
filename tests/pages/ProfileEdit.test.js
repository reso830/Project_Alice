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
  REASON_CODES: {
    rate_limit: {
      code: 'HTTP 429',
      message: 'Rate limit reached — too many requests in a short time.',
      fix: 'wait',
    },
    invalid_key: {
      code: 'HTTP 401',
      message: 'Invalid API key — your AI provider key was rejected.',
      fix: 'settings',
    },
    NO_TEXT: {
      code: 'NO_TEXT',
      message: 'No machine-readable text found — the file looks scanned or image-only.',
      fix: 'dead-end',
    },
  },
  mapErrorToReason: vi.fn((error) => error?.reason ?? error?.code ?? 'rate_limit'),
  parseWithLlm: vi.fn(),
}));

import { Toast } from '../../src/components/Toast.js';
import * as api from '../../src/services/api.js';
import * as aiSettings from '../../src/data/aiSettings.js';
import { parseWithLlm } from '../../src/services/llmParser.js';
import { parseResume, parseText } from '../../src/services/resumeApi.js';
import { createEntryOverlay, ProfileEdit } from '../../src/pages/ProfileEdit.js';

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
    firstName: 'Ana',
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

function getCard(container, title) {
  return [...container.querySelectorAll('.section-card')]
    .find((card) => card.querySelector('.section-label')?.textContent === title);
}

function getFieldInput(card, label) {
  return getField(card, label)
    .querySelector('.edit-field__control');
}

function getField(card, label) {
  return [...card.querySelectorAll('.edit-field')]
    .find((field) => field.querySelector('.edit-field__label')?.textContent === label)
}

function getTopControls(container) {
  return container.querySelector('.page-controls');
}

function getBottomControls(container) {
  return [...container.querySelectorAll('.page-controls')].at(-1);
}

function getSaveButton(controls) {
  return controls.querySelector('.page-controls__save');
}

function getCancelButton(controls) {
  return controls.querySelector('.page-controls__cancel');
}

function getButton(container, label) {
  return [...container.querySelectorAll('button')]
    .filter((button) => button.textContent === label)
    .at(-1);
}

function getGateCard(kind) {
  return document.querySelector(`.profile-entry-gate__card--${kind}`);
}

function getSectionProvenance(card) {
  return card.querySelector('.section-provenance')?.textContent ?? '';
}

function chooseGateCard(kind) {
  getGateCard(kind).querySelector('.profile-entry-gate__choose').click();
}

function expandSmartImport(container) {
  const toggle = container.querySelector('.profile-import-bar__toggle');

  toggle.click();
  const importArea = container.querySelector('.profile-import-bar .resume-import');
  const pasteTab = [...importArea.querySelectorAll('button')]
    .find((button) => button.textContent === 'Paste text');

  pasteTab?.click();

  return container.querySelector('.profile-import-bar .resume-import');
}

function getHeaderAddButton(card) {
  return [...card.querySelectorAll('.section-card__header button')]
    .find((button) => button.textContent === 'Add');
}

function inputValue(input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function typeText(getInput, value) {
  for (const character of value) {
    const input = getInput();
    input.value += character;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
}

function changeValue(input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function selectResumeFile(input, file) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [file],
  });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function openExperienceOverlay(container) {
  window.innerWidth = 1024;
  getHeaderAddButton(getCard(container, 'PROFESSIONAL EXPERIENCE')).click();

  return document.querySelector('.entry-modal');
}

function fillValidExperience(overlay, role = 'Platform Engineer') {
  inputValue(getFieldInput(overlay, 'Role'), role);
  inputValue(getFieldInput(overlay, 'Company'), 'Acme');
  inputValue(getFieldInput(overlay, 'Responsibilities'), 'Built dashboards.');
  inputValue(getFieldInput(overlay, 'Date Started'), '01/2024');
  inputValue(getFieldInput(overlay, 'Date Ended'), '02/2025');
}

describe('ProfileEdit page', () => {
  it('shows a profile edit skeleton on cold load without bare loading text', async () => {
    const container = createAppShell();
    let resolveProfile;

    api.getProfile.mockReturnValue(new Promise((resolve) => {
      resolveProfile = resolve;
    }));

    const mountPromise = ProfileEdit.mount(container, { navigate: vi.fn() });

    expect(container.querySelector('.profile-edit-skeleton')).not.toBeNull();
    expect(container.querySelector('.profile-edit-skeleton')?.getAttribute('aria-busy')).toBe('true');
    expect(container.textContent).not.toContain('Loading profile...');

    resolveProfile(createProfile());
    await mountPromise;

    expect(container.querySelector('.profile-edit-skeleton')).toBeNull();
  });

  it('creates a desktop entry modal, saves form data, and restores scroll', () => {
    window.innerWidth = 1024;
    const onSave = vi.fn();

    createEntryOverlay('Add Experience', (formEl) => {
      const input = document.createElement('input');

      input.value = 'Engineer';
      formEl.append(input);

      return {
        validate: () => true,
        getData: () => ({ role: input.value }),
        isDirty: () => false,
      };
    }, { onSave });

    expect(document.querySelector('.entry-modal')).toBeTruthy();
    expect(document.querySelector('.entry-sheet')).toBeNull();
    expect(document.querySelector('.entry-overlay__title')?.textContent).toBe('Add Experience');
    expect(document.body.style.overflow).toBe('hidden');

    [...document.querySelectorAll('.entry-modal button')]
      .find((button) => button.textContent === 'Save')
      .click();

    expect(onSave).toHaveBeenCalledWith({ role: 'Engineer' });
    expect(document.querySelector('.entry-modal')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('creates a mobile entry bottom sheet', () => {
    window.innerWidth = 375;

    createEntryOverlay('Add Link', (formEl) => {
      formEl.append(document.createElement('input'));

      return {
        validate: () => true,
        getData: () => ({}),
        isDirty: () => false,
      };
    }, { onSave: vi.fn() });

    expect(document.querySelector('.entry-sheet')).toBeTruthy();
    expect(document.querySelector('.entry-modal')).toBeNull();
  });

  it('shows entry discard confirmation for dirty overlay cancel', () => {
    window.innerWidth = 1024;
    const input = document.createElement('input');

    createEntryOverlay('Add Award', (formEl) => {
      input.value = '';
      formEl.append(input);

      return {
        validate: () => true,
        getData: () => ({}),
        isDirty: () => input.value !== '',
      };
    }, { onSave: vi.fn() });

    input.value = 'Top Performer';
    [...document.querySelectorAll('.entry-modal button')]
      .find((button) => button.textContent === 'Cancel')
      .click();

    expect(document.querySelector('.overlay-discard-dialog')).toBeTruthy();
    expect(document.querySelector('.overlay-discard-dialog__msg')?.textContent)
      .toBe('Discard entry changes?');

    [...document.querySelectorAll('.overlay-discard-dialog button')]
      .find((button) => button.textContent === 'Keep Editing')
      .click();

    expect(document.querySelector('.overlay-discard-dialog')).toBeNull();
    expect(document.querySelector('.entry-modal')).toBeTruthy();
  });

  it('opens modal on desktop when Add is clicked in Experience section', async () => {
    const container = createAppShell();

    window.innerWidth = 1024;
    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    getHeaderAddButton(getCard(container, 'PROFESSIONAL EXPERIENCE')).click();

    expect(document.body.querySelector('.entry-modal')).toBeTruthy();
    expect(document.body.querySelector('.entry-overlay__title')?.textContent).toBe('Add Experience');
  });

  it('opens bottom sheet on mobile when Add is clicked in Experience section', async () => {
    const container = createAppShell();

    window.innerWidth = 375;
    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    getHeaderAddButton(getCard(container, 'PROFESSIONAL EXPERIENCE')).click();

    expect(document.body.querySelector('.entry-sheet')).toBeTruthy();
    expect(document.body.querySelector('.entry-modal')).toBeNull();
  });

  it('closes overlay and restores body scroll after successful Save', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);

    fillValidExperience(overlay);
    getButton(overlay, 'Save').click();

    expect(document.querySelector('.entry-modal')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('validates required fields inside overlay and keeps overlay open on failure', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);

    getButton(overlay, 'Save').click();

    expect(overlay.querySelector('.field-error')?.textContent).toBe('This field is required.');
    expect(document.querySelector('.entry-modal')).toBeTruthy();
  });

  it('invalid MM/YYYY date in overlay shows inline error', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);

    inputValue(getFieldInput(overlay, 'Role'), 'Engineer');
    inputValue(getFieldInput(overlay, 'Company'), 'Acme');
    inputValue(getFieldInput(overlay, 'Responsibilities'), 'Build');
    inputValue(getFieldInput(overlay, 'Date Started'), 'baddate');
    inputValue(getFieldInput(overlay, 'Date Ended'), '02/2025');
    getButton(overlay, 'Save').click();

    expect([...overlay.querySelectorAll('.field-error')]
      .some((error) => error.textContent.includes('MM/YYYY'))).toBe(true);
    expect(document.querySelector('.entry-modal')).toBeTruthy();
  });

  it('guides month-year entry fields with MM/YYYY placeholders', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const experience = openExperienceOverlay(container);

    expect(getFieldInput(experience, 'Date Started').placeholder).toBe('MM/YYYY');
    expect(getFieldInput(experience, 'Date Ended').placeholder).toBe('MM/YYYY');
    getButton(experience, 'Cancel').click();

    getHeaderAddButton(getCard(container, 'CERTIFICATIONS')).click();
    const certification = document.querySelector('.entry-modal');

    expect(getFieldInput(certification, 'Issuance Date').placeholder).toBe('MM/YYYY');
    expect(getFieldInput(certification, 'Expiry Date').placeholder).toBe('MM/YYYY');
  });

  it('guides year-only education fields with a YYYY placeholder', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });
    getHeaderAddButton(getCard(container, 'EDUCATION')).click();

    const overlay = document.querySelector('.entry-modal');

    expect(getFieldInput(overlay, 'Year Completed').placeholder).toBe('YYYY');
  });

  it('committed entry appears in Experience section after overlay Save', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);

    fillValidExperience(overlay, 'Staff Engineer');
    getButton(overlay, 'Save').click();

    expect(getCard(container, 'PROFESSIONAL EXPERIENCE').querySelector('.profile-entry__title')?.textContent)
      .toBe('Staff Engineer');
  });

  it('clicking Add while an overlay is open has no effect', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    openExperienceOverlay(container);
    getHeaderAddButton(getCard(container, 'EDUCATION')).click();

    expect(document.querySelectorAll('.entry-modal, .entry-sheet')).toHaveLength(1);
    expect(document.querySelector('.entry-overlay__title')?.textContent).toBe('Add Experience');
  });

  it('Tab key stays trapped inside the open overlay', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);
    const focusable = [...overlay.querySelectorAll('button, input, select, textarea')]
      .filter((el) => !el.disabled);
    const first = focusable[0];
    const last = focusable.at(-1);

    last.focus();
    overlay.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(document.activeElement).toBe(first);
  });

  it('Tab key stays trapped inside the discard dialog when present', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);

    inputValue(getFieldInput(overlay, 'Role'), 'Engineer');
    getButton(overlay, 'Cancel').click();

    const dialog = document.querySelector('.overlay-discard-dialog');
    const focusable = [...dialog.querySelectorAll('button')];
    const first = focusable[0];
    const last = focusable.at(-1);

    last.focus();
    overlay.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(document.activeElement).toBe(first);
  });

  it('Cancel on blank add overlay closes immediately', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    getButton(openExperienceOverlay(container), 'Cancel').click();

    expect(document.querySelector('.entry-modal')).toBeNull();
    expect(document.querySelector('.overlay-discard-dialog')).toBeNull();
  });

  it('Cancel on dirty add overlay shows discard dialog', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);

    inputValue(getFieldInput(overlay, 'Role'), 'Engineer');
    getButton(overlay, 'Cancel').click();

    expect(document.querySelector('.overlay-discard-dialog')).toBeTruthy();
  });

  it('dirty-state revert closes overlay immediately on Cancel', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);
    const role = getFieldInput(overlay, 'Role');

    inputValue(role, 'Engineer');
    inputValue(role, '');
    getButton(overlay, 'Cancel').click();

    expect(document.querySelector('.entry-modal')).toBeNull();
    expect(document.querySelector('.overlay-discard-dialog')).toBeNull();
  });

  it('Discard closes overlay and shows toast', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);

    inputValue(getFieldInput(overlay, 'Role'), 'Engineer');
    getButton(overlay, 'Cancel').click();
    getButton(document.querySelector('.overlay-discard-dialog'), 'Discard').click();

    expect(document.querySelector('.entry-modal')).toBeNull();
    expect(Toast.show).toHaveBeenCalledWith('Changes discarded.', 'success');
  });

  it('Keep Editing closes dialog and preserves overlay and form state', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);

    inputValue(getFieldInput(overlay, 'Role'), 'Engineer');
    getButton(overlay, 'Cancel').click();
    getButton(document.querySelector('.overlay-discard-dialog'), 'Keep Editing').click();

    expect(document.querySelector('.overlay-discard-dialog')).toBeNull();
    expect(document.querySelector('.entry-modal')).toBeTruthy();
    expect(getFieldInput(overlay, 'Role').value).toBe('Engineer');
  });

  it('ESC triggers Cancel behavior', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const overlay = openExperienceOverlay(container);

    inputValue(getFieldInput(overlay, 'Role'), 'Engineer');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.querySelector('.overlay-discard-dialog')).toBeTruthy();
  });

  it('renders a blank form when no profile exists', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(null);

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const basic = getCard(container, 'BASIC INFO');
    const summary = getCard(container, 'SUMMARY');

    expect(getFieldInput(basic, 'First Name').value).toBe('');
    expect(getFieldInput(basic, 'Last Name').value).toBe('');
    expect(getFieldInput(basic, 'City/Location').value).toBe('');
    expect(getFieldInput(basic, 'Email').value).toBe('');
    expect(getFieldInput(basic, 'Phone').value).toBe('');
    expect(getFieldInput(summary, 'Summary').value).toBe('');
    expect(document.querySelector('.profile-entry-gate')).not.toBeNull();
  });

  it('shows the split-card gate for first-time setup and Manual entry dismisses to the blank form', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(null);

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const gate = document.querySelector('.profile-entry-gate');

    expect(gate).not.toBeNull();
    expect(gate.getAttribute('role')).toBe('dialog');
    expect(gate.textContent).toContain("Let's build your profile.");
    expect(gate.textContent).toContain('Smart entry');
    expect(gate.textContent).toContain('Fastest');
    expect(gate.textContent).toContain('Manual entry');
    expect(getGateCard('smart').querySelector('.profile-entry-gate__icon img')).not.toBeNull();
    expect(getGateCard('manual').querySelector('.profile-entry-gate__icon img')).toBeNull();
    expect(getGateCard('manual').querySelector('.profile-entry-gate__icon svg')).not.toBeNull();
    expect(getCard(container, 'BASIC INFO')).not.toBeNull();
    expect(document.activeElement).toBe(getGateCard('smart').querySelector('.profile-entry-gate__choose'));

    chooseGateCard('manual');

    expect(document.querySelector('.profile-entry-gate')).toBeNull();
    expect(getFieldInput(getCard(container, 'BASIC INFO'), 'First Name').value).toBe('');
  });

  it('dismisses the first-time gate with Escape or backdrop as Manual entry', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(null);

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.querySelector('.profile-entry-gate')).toBeNull();

    ProfileEdit.unmount();
    const nextContainer = createAppShell();
    api.getProfile.mockResolvedValue(null);

    await ProfileEdit.mount(nextContainer, { navigate: vi.fn() });

    const gate = document.querySelector('.profile-entry-gate');
    gate.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('.profile-entry-gate')).toBeNull();
  });

  it('opens the smart input modal from the first-time Smart entry card', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(null);

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    chooseGateCard('smart');

    const modal = document.querySelector('.profile-smart-modal');

    expect(document.querySelector('.profile-entry-gate')).toBeNull();
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain('Import from your resume');
    expect(modal.querySelector('.resume-import--smart')).not.toBeNull();
    expect(modal.textContent).toContain('Upload file');
    expect(modal.textContent).toContain('Paste text');
  });

  it('shows a collapsed Import Bar for an existing profile and expands inline', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const bar = container.querySelector('.profile-import-bar');
    const toggle = bar.querySelector('.profile-import-bar__toggle');

    expect(document.querySelector('.profile-entry-gate')).toBeNull();
    expect(bar).not.toBeNull();
    expect(container.querySelector('.profile-edit-page').firstElementChild).toBe(bar);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(bar.querySelector('.resume-import')).toBeNull();

    toggle.click();
    const expandedBar = container.querySelector('.profile-import-bar');
    const expandedToggle = expandedBar.querySelector('.profile-import-bar__toggle');

    expect(expandedToggle.getAttribute('aria-expanded')).toBe('true');
    expect(expandedBar.classList).toContain('is-expanded');
    expect(expandedBar.querySelector('.resume-import--smart')).not.toBeNull();
  });

  it('disables Smart entry and the Import Bar with a Settings deep-link when AI is off', async () => {
    const container = createAppShell();
    const navigate = vi.fn();

    aiSettings.isEnabled.mockReturnValue(false);
    api.getProfile.mockResolvedValue(null);

    await ProfileEdit.mount(container, { navigate });

    const smartCard = getGateCard('smart');
    const manualCard = getGateCard('manual');

    expect(smartCard.classList).toContain('is-disabled');
    expect(smartCard.querySelector('.profile-entry-gate__choose')).toBeNull();
    expect(smartCard.querySelector('.profile-entry-gate__settings-link').textContent).toBe('Enable AI in Settings →');
    expect(manualCard.querySelector('.profile-entry-gate__choose').disabled).toBe(false);

    smartCard.querySelector('.profile-entry-gate__settings-link').click();

    expect(navigate).toHaveBeenCalledWith('profile', { focusSettings: true });

    ProfileEdit.unmount();
    const existingContainer = createAppShell();
    navigate.mockClear();
    aiSettings.isEnabled.mockReturnValue(false);
    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(existingContainer, { navigate });

    const bar = existingContainer.querySelector('.profile-import-bar');

    expect(bar.classList).toContain('is-disabled');
    expect(bar.querySelector('.profile-import-bar__toggle')).toBeNull();
    expect(bar.querySelector('.profile-import-bar__settings-link').textContent).toBe('Enable AI in Settings →');

    bar.querySelector('.profile-import-bar__settings-link').click();

    expect(navigate).toHaveBeenCalledWith('profile', { focusSettings: true });
  });

  it('scrolls to the top when the import bar is highlighted', async () => {
    const container = createAppShell();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn(), highlightImport: true });

    expect(container.querySelector('.profile-import-bar--highlight')).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    scrollTo.mockRestore();
  });

  it('pre-populates basic info and summary from an existing profile', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      firstName: 'Alex',
      lastName: 'Ng',
      city: 'Austin',
      email: 'alex@example.com',
      phone: '555-0100',
      summary: 'Frontend engineer.',
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const basic = getCard(container, 'BASIC INFO');
    const summary = getCard(container, 'SUMMARY');

    expect(getFieldInput(basic, 'First Name').value).toBe('Alex');
    expect(getFieldInput(basic, 'Last Name').value).toBe('Ng');
    expect(getFieldInput(basic, 'City/Location').value).toBe('Austin');
    expect(getFieldInput(basic, 'Email').value).toBe('alex@example.com');
    expect(getFieldInput(basic, 'Phone').value).toBe('555-0100');
    expect(getFieldInput(summary, 'Summary').value).toBe('Frontend engineer.');
    expect(getSaveButton(getTopControls(container)).disabled).toBe(true);
  });

  it('Edit Profile section cards appear in View Profile order', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      experience: [{ role: 'Engineer', company: 'Acme', responsibilities: 'Build', dateStarted: '01/2024', dateEnded: '02/2025' }],
      education: [{ degreeMajor: 'BS Computer Science', university: 'State University', yearCompleted: '2020' }],
      skills: ['JavaScript'],
      certifications: [{ name: 'AWS Developer', issuingBody: 'Amazon', issuanceDate: '02/2023' }],
      awards: [{ awardName: 'Top Performer', issuingBody: 'Acme', date: '03/2024' }],
      languages: [{ language: 'English', proficiency: 'Fluent' }],
      links: [{ url: 'https://example.com/profile', friendlyName: 'Portfolio' }],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    expect([...container.querySelectorAll('.section-label')].map((label) => label.textContent))
      .toEqual([
        'BASIC INFO',
        'SUMMARY',
        'PROFESSIONAL EXPERIENCE',
        'EDUCATION',
        'SKILLS',
        'CERTIFICATIONS',
        'AWARDS',
        'LANGUAGES',
        'LINKS',
      ]);
  });

  it('Experience entries use structured hierarchy with title and meta', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      experience: [{
        role: 'Frontend Engineer',
        company: 'Acme',
        responsibilities: 'Build dashboards.',
        dateStarted: '01/2024',
        dateEnded: '02/2025',
      }],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const experience = getCard(container, 'PROFESSIONAL EXPERIENCE');

    expect(experience.querySelector('.profile-entry__title')?.textContent)
      .toBe('Frontend Engineer');
    expect(experience.querySelector('.profile-entry__meta')?.textContent)
      .toBe('Acme | 01/2024 – 02/2025');
  });

  it('Add button appears in section header with primary styling', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    // SKILLS uses an inline "+ Add skill" control (design §5), not a header Add.
    for (const title of ['PROFESSIONAL EXPERIENCE', 'EDUCATION', 'CERTIFICATIONS', 'AWARDS', 'LANGUAGES', 'LINKS']) {
      const add = getHeaderAddButton(getCard(container, title));

      expect(add).toBeTruthy();
      expect(add.classList).toContain('profile-btn--primary');
    }
  });

  it('each structured entry has accessible Edit and Remove icon buttons', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      experience: [{
        role: 'Frontend Engineer',
        company: 'Acme',
        responsibilities: 'Build dashboards.',
        dateStarted: '01/2024',
        dateEnded: '02/2025',
      }],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const entry = getCard(container, 'PROFESSIONAL EXPERIENCE').querySelector('.entry-row--structured');

    expect(entry.querySelector('[aria-label="Edit entry"]')).toBeTruthy();
    expect(entry.querySelector('[aria-label="Remove entry"]')).toBeTruthy();
  });

  it('keeps both save buttons disabled until the form is dirty', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    expect(getSaveButton(getTopControls(container)).disabled).toBe(true);
    expect(getSaveButton(getBottomControls(container)).disabled).toBe(true);

    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'City/Location'), 'Seattle');

    expect(getSaveButton(getTopControls(container)).disabled).toBe(false);
    expect(getSaveButton(getBottomControls(container)).disabled).toBe(false);
  });

  it('disables save again when edits are reverted to the loaded value', async () => {
    const container = createAppShell();
    const basicProfile = createProfile({ firstName: 'Ana' });

    api.getProfile.mockResolvedValue(basicProfile);

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const firstName = getFieldInput(getCard(container, 'BASIC INFO'), 'First Name');

    inputValue(firstName, 'Anika');
    expect(getSaveButton(getTopControls(container)).disabled).toBe(false);

    inputValue(firstName, 'Ana');
    expect(getSaveButton(getTopControls(container)).disabled).toBe(true);
  });

  it('keeps save disabled when a skill edit is only whitespace-normalized', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      skills: [{ name: 'React', level: 4 }],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');
    const nameInput = skills.querySelector('.skill-editor-row input');

    inputValue(nameInput, '  React  ');

    expect(getSaveButton(getTopControls(container)).disabled).toBe(true);
    expect(getSaveButton(getBottomControls(container)).disabled).toBe(true);
  });

  it('shows shared busy state on Save and disables Cancel while save is in progress', async () => {
    const container = createAppShell();
    let resolveSave;
    const savePromise = new Promise((resolve) => {
      resolveSave = resolve;
    });

    api.getProfile.mockResolvedValue(createProfile());
    api.saveProfile.mockReturnValue(savePromise);

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'Phone'), '555-0100');
    getSaveButton(getTopControls(container)).click();
    await flushPromises();

    const topSave = getSaveButton(getTopControls(container));
    const bottomSave = getSaveButton(getBottomControls(container));
    const topCancel = getCancelButton(getTopControls(container));
    expect(topSave.textContent).toBe('Saving changes…');
    expect(bottomSave.textContent).toBe('Saving changes…');
    expect(topSave.getAttribute('aria-busy')).toBe('true');
    expect(bottomSave.getAttribute('aria-busy')).toBe('true');
    expect(topSave.disabled).toBe(true);
    expect(bottomSave.disabled).toBe(true);
    expect(topCancel.disabled).toBe(true);

    resolveSave(createProfile({ phone: '555-0100' }));
    await flushPromises();
  });

  it('prevents duplicate profile saves from rapid Save clicks', async () => {
    const container = createAppShell();
    let resolveSave;

    api.getProfile.mockResolvedValue(createProfile());
    api.saveProfile.mockReturnValue(new Promise((resolve) => {
      resolveSave = resolve;
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'Phone'), '555-0100');
    getSaveButton(getTopControls(container)).click();
    getSaveButton(getBottomControls(container)).click();

    expect(api.saveProfile).toHaveBeenCalledTimes(1);

    resolveSave(createProfile({ phone: '555-0100' }));
    await flushPromises();
  });

  it('saves successfully, navigates to profile, and shows a success toast', async () => {
    const container = createAppShell();
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue(createProfile());
    api.saveProfile.mockResolvedValue(createProfile({ city: 'Seattle' }));

    await ProfileEdit.mount(container, { navigate });

    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'City/Location'), 'Seattle');
    getSaveButton(getBottomControls(container)).click();
    await flushPromises();

    expect(api.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Ana',
      lastName: 'Rivera',
      city: 'Seattle',
      summary: '',
    }));
    expect(navigate).toHaveBeenCalledWith('profile');
    expect(Toast.show).toHaveBeenCalledWith('Profile saved.', 'success');
  });

  it('saves updated state from a pre-loaded profile', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      firstName: 'Alex',
      lastName: 'Ng',
      city: 'Austin',
      summary: 'Frontend engineer.',
    }));
    api.saveProfile.mockResolvedValue(createProfile({ city: 'Seattle' }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'City/Location'), 'Seattle');
    getSaveButton(getTopControls(container)).click();
    await flushPromises();

    expect(api.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Alex',
      lastName: 'Ng',
      city: 'Seattle',
      summary: 'Frontend engineer.',
    }));
  });

  it('shows an error toast and preserves form state when save fails', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());
    api.saveProfile.mockRejectedValue(new Error('offline'));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const phone = getFieldInput(getCard(container, 'BASIC INFO'), 'Phone');

    inputValue(phone, '555-0100');
    getSaveButton(getTopControls(container)).click();
    await flushPromises();

    expect(Toast.show).toHaveBeenCalledWith('Could not save profile. Please try again.', 'error');
    expect(phone.value).toBe('555-0100');
    expect(getSaveButton(getTopControls(container)).disabled).toBe(false);
    expect(getSaveButton(getTopControls(container)).hasAttribute('aria-busy')).toBe(false);
    expect(getCancelButton(getTopControls(container)).disabled).toBe(false);
  });

  it('surfaces first and last name validation errors before save', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const basic = getCard(container, 'BASIC INFO');

    inputValue(getFieldInput(basic, 'First Name'), '');
    getSaveButton(getTopControls(container)).click();
    await flushPromises();

    const error = [...basic.querySelectorAll('.field-error')]
      .find((fieldError) => fieldError.textContent === 'First Name is required.');

    expect(api.saveProfile).not.toHaveBeenCalled();
    expect(error).toBeTruthy();
    expect(error.hidden).toBe(false);
  });

  it('does not clear unrelated validation errors when another field changes', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const basic = getCard(container, 'BASIC INFO');
    const firstName = getFieldInput(basic, 'First Name');
    const summary = getFieldInput(getCard(container, 'SUMMARY'), 'Summary');

    inputValue(firstName, '');
    getSaveButton(getTopControls(container)).click();
    await flushPromises();

    inputValue(summary, 'Updated summary');

    const error = [...basic.querySelectorAll('.field-error')]
      .find((fieldError) => fieldError.textContent === 'First Name is required.');

    expect(error).toBeTruthy();
    expect(error.hidden).toBe(false);
  });

  it('surfaces email validation error before save', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({ firstName: 'Ana', lastName: 'Rivera' }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const basic = getCard(container, 'BASIC INFO');
    inputValue(getFieldInput(basic, 'Email'), 'not-an-email');
    getSaveButton(getTopControls(container)).click();
    await flushPromises();

    const error = [...basic.querySelectorAll('.field-error')]
      .find((fieldError) => fieldError.textContent === 'Email must be a valid email address.');

    expect(api.saveProfile).not.toHaveBeenCalled();
    expect(error).toBeTruthy();
    expect(error.hidden).toBe(false);
  });

  it('surfaces a section-level summary when entry data has validation errors', async () => {
    const container = createAppShell();
    const scrollIntoView = vi.fn();
    const focus = vi.fn();

    api.getProfile.mockResolvedValue(createProfile({
      firstName: 'Ana',
      lastName: 'Rivera',
      languages: [{ language: 'English', proficiency: '' }],
    }));

    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.HTMLElement.prototype.focus = focus;

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'City/Location'), 'Austin');
    getSaveButton(getTopControls(container)).click();
    await flushPromises();

    const summary = document.querySelector('.section-validation-error');
    expect(api.saveProfile).not.toHaveBeenCalled();
    expect(summary).toBeTruthy();
    expect(summary.textContent).toContain('Languages');
    expect(summary.parentElement).toBe(container.querySelector('.profile-edit-page'));
    expect(summary.previousElementSibling).toBeNull();
    expect(document.querySelector('.profile-edit-subheader .section-validation-error')).toBeNull();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('navigates directly when cancelling a clean form', async () => {
    const container = createAppShell();
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate });

    getCancelButton(getTopControls(container)).click();

    expect(navigate).toHaveBeenCalledWith('profile');
    expect(document.querySelector('.confirm-backdrop')).toBeNull();
  });

  it('shows discard modal when cancelling a dirty form', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'City/Location'), 'Seattle');
    getCancelButton(getBottomControls(container)).click();

    expect(document.querySelector('.confirm-backdrop')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('discards dirty edits from the modal', async () => {
    const container = createAppShell();
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate });

    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'City/Location'), 'Seattle');
    getCancelButton(getTopControls(container)).click();
    [...document.querySelectorAll('.confirm-modal button')]
      .find((button) => button.textContent === 'Discard')
      .click();

    expect(navigate).toHaveBeenCalledWith('profile');
    expect(Toast.show).toHaveBeenCalledWith('Edits discarded.', 'success');
    expect(document.querySelector('.confirm-backdrop')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps edits when the discard modal is dismissed', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const city = getFieldInput(getCard(container, 'BASIC INFO'), 'City/Location');

    inputValue(city, 'Seattle');
    getCancelButton(getTopControls(container)).click();
    [...document.querySelectorAll('.confirm-modal button')]
      .find((button) => button.textContent === 'Keep Editing')
      .click();

    expect(document.querySelector('.confirm-backdrop')).toBeNull();
    expect(city.value).toBe('Seattle');
  });

  it('adds inline unrated skill rows and sets or clears a level', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');

    skills.querySelector('.skill-editor-add').click();

    let row = skills.querySelector('.skill-editor-row');
    const nameInput = row.querySelector('.skill-editor-row__name input');

    expect(document.querySelector('.entry-modal')).toBeNull();
    expect(nameInput.value).toBe('');
    expect(row.querySelector('.skill-level-picker__caption').textContent).toBe('Tap to set a level');

    inputValue(nameInput, 'Python');
    row = skills.querySelector('.skill-editor-row');
    row.querySelector('.skill-level-picker__segment[data-level="4"]').click();
    row = skills.querySelector('.skill-editor-row');

    expect(row.querySelectorAll('.skill-level-picker__segment.is-filled')).toHaveLength(4);
    expect(row.querySelector('.skill-level-picker__caption').textContent).toBe('4 · Strong');

    row.querySelector('.skill-level-picker__segment[data-level="4"]').click();
    row = skills.querySelector('.skill-editor-row');
    expect(row.querySelectorAll('.skill-level-picker__segment.is-filled')).toHaveLength(0);
    expect(row.querySelector('.skill-level-picker__caption').textContent).toBe('Tap to set a level');
  });

  it('previews a cumulative fill in the hovered level colour, then restores on leave', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({ skills: [{ name: 'React', level: 4 }] }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const picker = getCard(container, 'SKILLS').querySelector('.skill-level-picker');
    const segments = picker.querySelector('.skill-level-picker__segments');

    picker.querySelector('.skill-level-picker__segment[data-level="2"]')
      .dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: true }));

    expect(picker.querySelectorAll('.skill-level-picker__segment.is-filled')).toHaveLength(2);
    expect(picker.classList.contains('skill-level-2')).toBe(true);
    expect(picker.querySelector('.skill-level-picker__caption').textContent).toBe('2 · Basic');

    segments.dispatchEvent(new window.MouseEvent('mouseleave', { bubbles: true }));

    expect(picker.querySelectorAll('.skill-level-picker__segment.is-filled')).toHaveLength(4);
    expect(picker.classList.contains('skill-level-4')).toBe(true);
    expect(picker.querySelector('.skill-level-picker__caption').textContent).toBe('4 · Strong');
  });

  it('blocks Save for unrated skills and re-enables after every skill has a level', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');

    skills.querySelector('.skill-editor-add').click();
    const row = skills.querySelector('.skill-editor-row');

    inputValue(row.querySelector('input'), 'Python');

    expect(getSaveButton(getTopControls(container)).disabled).toBe(true);
    expect(row.classList.contains('has-warning')).toBe(true);
    expect(skills.querySelector('.skill-editor-feedback').textContent)
      .toBe('Set a level for every skill to save · 1 missing');

    row.querySelector('.skill-level-picker__segment[data-level="3"]').click();

    expect(getSaveButton(getTopControls(container)).disabled).toBe(false);
    expect(skills.querySelector('.skill-editor-feedback')).toBeNull();
  });

  it('preserves spaces while typing multi-word skill names character by character', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');

    skills.querySelector('.skill-editor-add').click();
    typeText(() => skills.querySelector('.skill-editor-row input'), 'Spring Boot');

    expect(skills.querySelector('.skill-editor-row input').value).toBe('Spring Boot');
  });

  it('preserves the caret when editing the middle of a skill name', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      skills: [{ name: 'Spring Boot', level: 3 }],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');
    const input = skills.querySelector('.skill-editor-row input');

    input.focus();
    input.value = 'Spring Cloud Boot';
    input.setSelectionRange(13, 13);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));

    const rerenderedInput = skills.querySelector('.skill-editor-row input');

    expect(rerenderedInput.value).toBe('Spring Cloud Boot');
    expect(rerenderedInput.selectionStart).toBe(13);
  });

  it('saves structured skill entries from inline rows', async () => {
    const container = createAppShell();
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue(createProfile());
    api.saveProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate });

    const skills = getCard(container, 'SKILLS');

    skills.querySelector('.skill-editor-add').click();
    const row = skills.querySelector('.skill-editor-row');

    inputValue(row.querySelector('input'), '  Spring Boot  ');
    row.querySelector('.skill-level-picker__segment[data-level="5"]').click();
    getSaveButton(getTopControls(container)).click();
    await flushPromises();

    expect(api.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      skills: [{ name: 'Spring Boot', level: 5 }],
    }));
  });

  it('flags duplicate and blank skill names from model validation', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({ skills: [{ name: 'Python', level: 3 }] }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');

    skills.querySelector('.skill-editor-add').click();
    const [, duplicate] = skills.querySelectorAll('.skill-editor-row');

    inputValue(duplicate.querySelector('input'), ' python ');
    duplicate.querySelector('.skill-level-picker__segment[data-level="2"]').click();

    expect(getSaveButton(getTopControls(container)).disabled).toBe(true);
    expect(skills.querySelector('.skill-editor-feedback').textContent)
      .toContain('Duplicate skill: python.');

    inputValue(duplicate.querySelector('input'), '');

    expect(skills.querySelector('.skill-editor-feedback').textContent)
      .toContain('Skill name is required.');
  });

  it('removes saved skills while tracking dirty reversion', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      skills: [
        { name: 'TypeScript', level: 4 },
        { name: 'React', level: 3 },
      ],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');

    expect([...skills.querySelectorAll('.skill-editor-row input')].map((input) => input.value))
      .toEqual(['TypeScript', 'React']);

    skills.querySelectorAll('.skill-editor-row__remove')[1].click();
    expect([...skills.querySelectorAll('.skill-editor-row input')].map((input) => input.value))
      .toEqual(['TypeScript']);

    skills.querySelector('.skill-editor-row__remove').click();
    expect(skills.querySelectorAll('.skill-editor-row')).toHaveLength(0);
    expect(getSaveButton(getTopControls(container)).disabled).toBe(false);
  });

  it('shows the skill scale popover in the editor', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');

    skills.querySelector('.skill-scale-trigger').click();

    expect(skills.querySelector('.skill-scale-popover').hidden).toBe(false);
    expect(skills.querySelector('.skill-scale-popover').textContent)
      .toContain('Sets direction; mentors others.');
  });

  it('renders imported resume skills as unrated rows and blocks Save', async () => {
    const container = createAppShell();
    const file = new window.File(['resume'], 'resume.txt', { type: 'text/plain' });

    api.getProfile.mockResolvedValue(createProfile());
    parseResume.mockResolvedValue({ skills: ['Python'] });

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const importArea = expandSmartImport(container);
    const input = importArea.querySelector('.resume-import__input');
    selectResumeFile(input, file);
    getButton(container, 'Process resume').click();
    await flushPromises();

    const skills = getCard(container, 'SKILLS');
    const row = skills.querySelector('.skill-editor-row');

    expect(row.querySelector('input').value).toBe('Python');
    expect(row.querySelector('.skill-level-picker__caption').textContent).toBe('Tap to set a level');
    expect(skills.querySelector('.skill-editor-feedback').textContent)
      .toBe('Set a level for every skill to save · 1 missing');
    expect(getSaveButton(getTopControls(container)).disabled).toBe(true);
  });

  it('validates an AI-filled draft through the normal Save path', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({ firstName: '', lastName: '' }));
    api.saveProfile.mockResolvedValue(createProfile());
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockResolvedValue({
      draft: {
        firstName: 'Jane',
        lastName: 'Doe',
        summary: 'AI-filled profile summary.',
      },
      truncated: false,
    });

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const importArea = expandSmartImport(container);
    const textarea = importArea.querySelector('.resume-import__paste-input');
    textarea.value = 'Jane Doe resume with enough detail to parse';
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    getButton(container, 'Process resume').click();
    await flushPromises();

    getSaveButton(getTopControls(container)).click();
    await flushPromises();

    expect(api.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Jane',
      lastName: 'Doe',
      summary: 'AI-filled profile summary.',
    }));
    expect(container.querySelector('.field-error:not([hidden])')).toBeNull();
  });

  it('surfaces import notices after the ResumeImport area re-renders away', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({ firstName: '', lastName: '' }));
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockResolvedValue({
      draft: {
        firstName: 'Jane',
        lastName: 'Doe',
      },
      truncated: true,
    });

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const importArea = expandSmartImport(container);
    const textarea = importArea.querySelector('.resume-import__paste-input');
    textarea.value = 'Very long resume with enough detail to parse';
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    getButton(container, 'Process resume').click();
    await flushPromises();

    expect(container.querySelector('.resume-import')).toBeNull();
    expect(Toast.show).toHaveBeenCalledWith(
      'The resume was long, so some content may not be parsed.',
      'info',
    );
  });

  it('asks before using the basic parser when AI is unavailable and leaves the form unchanged until confirmed', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({ firstName: '', lastName: '' }));
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockRejectedValue({ reason: 'rate_limit' });
    parseText.mockResolvedValue({
      firstName: 'Basic',
      lastName: 'Parser',
      summary: 'Filled after explicit fallback.',
    });

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const importArea = expandSmartImport(container);
    const textarea = importArea.querySelector('.resume-import__paste-input');
    textarea.value = 'Resume content long enough for the smart input gate';
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    getButton(container, 'Process resume').click();
    await flushPromises();

    const dialog = document.querySelector('.resume-import-failure');

    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Smart parsing is unavailable right now');
    expect(dialog.textContent).toContain('HTTP 429');
    expect(dialog.textContent).toContain('Rate limit reached');
    expect(getButton(dialog, 'Try AI again')).not.toBeNull();
    expect(getButton(dialog, 'Use basic parser')).not.toBeNull();
    expect(getFieldInput(getCard(container, 'BASIC INFO'), 'First Name').value).toBe('');

    getButton(dialog, 'Use basic parser').click();
    await flushPromises();

    expect(getFieldInput(getCard(container, 'BASIC INFO'), 'First Name').value).toBe('Basic');
    expect(getSectionProvenance(getCard(container, 'BASIC INFO'))).toContain('Auto-filled');
    expect(container.querySelector('.ai-field-badge')).toBeNull();
  });

  it('routes settings-related AI failures to Settings instead of retry', async () => {
    const container = createAppShell();
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue(createProfile());
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockRejectedValue({ reason: 'invalid_key' });

    await ProfileEdit.mount(container, { navigate });

    const importArea = expandSmartImport(container);
    const textarea = importArea.querySelector('.resume-import__paste-input');
    textarea.value = 'Resume content long enough for the smart input gate';
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    getButton(container, 'Process resume').click();
    await flushPromises();

    const dialog = document.querySelector('.resume-import-failure');

    expect(dialog.textContent).toContain('HTTP 401');
    expect(getButton(dialog, 'Try AI again')).toBeUndefined();
    getButton(dialog, 'Update key in Settings →').click();

    expect(navigate).toHaveBeenCalledWith('profile', { focusSettings: true });
  });

  it('shows an unreadable-file dead-end without basic fallback actions', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockResolvedValue({ draft: {}, truncated: false });

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const importArea = expandSmartImport(container);
    const textarea = importArea.querySelector('.resume-import__paste-input');
    textarea.value = 'Scanned resume content with no usable fields';
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    getButton(container, 'Process resume').click();
    await flushPromises();

    const dialog = document.querySelector('.resume-import-failure--dead-end');

    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain("We couldn't read that résumé");
    expect(dialog.textContent).toContain('NO_TEXT');
    expect(getButton(dialog, 'Use basic parser')).toBeUndefined();
    expect(getButton(dialog, 'Cancel')).not.toBeNull();
  });

  it('appends existing-profile imports, marks touched sections, and Undo restores the snapshot', async () => {
    const container = createAppShell();
    const before = createProfile({
      firstName: 'Ana',
      lastName: 'Rivera',
      summary: 'Existing summary.',
      experience: [{
        role: 'Existing Engineer',
        company: 'OldCo',
        responsibilities: 'Kept existing work in place.',
        dateStarted: '01/2023',
        dateEnded: '12/2023',
        currentWork: false,
      }],
    });

    api.getProfile.mockResolvedValue(before);
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockResolvedValue({
      draft: {
        firstName: 'Jane',
        summary: 'Imported summary.',
        experience: [{
          role: 'Imported Engineer',
          company: 'NewCo',
          responsibilities: 'Added imported work.',
          dateStarted: '01/2024',
          dateEnded: '02/2025',
          currentWork: false,
        }],
        skills: ['Python'],
      },
      truncated: false,
    });

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const importArea = expandSmartImport(container);
    const textarea = importArea.querySelector('.resume-import__paste-input');
    textarea.value = 'Jane Doe resume with enough detail to append';
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    getButton(container, 'Process resume').click();
    await flushPromises();

    const summary = getCard(container, 'SUMMARY');
    const experience = getCard(container, 'PROFESSIONAL EXPERIENCE');
    const skills = getCard(container, 'SKILLS');
    const undoOptions = Toast.show.mock.calls.find((call) => call[2]?.actionLabel === 'Undo')?.[2];

    expect(getFieldInput(getCard(container, 'BASIC INFO'), 'First Name').value).toBe('Ana');
    expect(getFieldInput(summary, 'Summary').value).toBe('Existing summary.\n\nImported summary.');
    expect([...experience.querySelectorAll('.profile-entry__title')].map((el) => el.textContent))
      .toEqual(expect.arrayContaining(['Existing Engineer', 'Imported Engineer']));
    expect(skills.querySelector('.skill-level-picker__caption').textContent).toBe('Tap to set a level');
    expect(getField(summary, 'Summary').classList).toContain('epfFlash');
    expect([...experience.querySelectorAll('.entry-row')]
      .find((row) => row.textContent.includes('Imported Engineer')).classList)
      .toContain('epfFlash');
    expect(skills.querySelector('.skill-editor-row').classList).toContain('epfFlash');
    expect(getSectionProvenance(summary)).toContain('AI FILLED');
    expect(getSectionProvenance(experience)).toContain('AI FILLED');
    expect(getSectionProvenance(skills)).toContain('AI FILLED');
    expect(getSectionProvenance(getCard(container, 'BASIC INFO'))).toBe('');
    expect(undoOptions).toEqual(expect.objectContaining({ actionLabel: 'Undo' }));

    undoOptions.onAction();

    expect(getFieldInput(getCard(container, 'SUMMARY'), 'Summary').value).toBe('Existing summary.');
    expect([...getCard(container, 'PROFESSIONAL EXPERIENCE').querySelectorAll('.profile-entry__title')].map((el) => el.textContent))
      .toEqual(['Existing Engineer']);
    expect(getCard(container, 'SKILLS').querySelectorAll('.skill-editor-row')).toHaveLength(0);
  });

  it('disables "+ Add skill" once the 50-skill cap is reached', async () => {
    const container = createAppShell();
    const skillsList = Array.from({ length: 50 }, (_, index) => ({
      name: `Skill ${index + 1}`,
      level: 2,
    }));

    api.getProfile.mockResolvedValue(createProfile({ skills: skillsList }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');
    const add = skills.querySelector('.skill-editor-add');

    expect(add.disabled).toBe(true);
    expect(skills.querySelector('.skill-editor-feedback').textContent)
      .toContain('Maximum 50 skills reached.');

    add.click();
    expect(skills.querySelectorAll('.skill-editor-row')).toHaveLength(50);
  });

  it('shows inline feedback when the skill list exceeds 50 entries', async () => {
    const container = createAppShell();
    // Over-cap is only reachable by seeded/imported data — the Add button is
    // disabled at 50 — so seed 51 directly to exercise the max-count feedback.
    const skillsList = Array.from({ length: 51 }, (_, index) => ({
      name: `Skill ${index + 1}`,
      level: 2,
    }));

    api.getProfile.mockResolvedValue(createProfile({ skills: skillsList }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');

    expect(getSaveButton(getTopControls(container)).disabled).toBe(true);
    expect(skills.querySelector('.skill-editor-feedback').textContent)
      .toContain('Remove some skills — max 50.');
  });

  it('adds languages through the entry overlay with validation and one-at-a-time guard', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const languages = getCard(container, 'LANGUAGES');

    getHeaderAddButton(languages).click();
    expect(document.querySelector('.entry-modal')).toBeTruthy();

    getButton(document.querySelector('.entry-modal'), 'Save').click();
    expect(document.querySelector('.entry-modal .field-error')?.textContent).toBe('This field is required.');

    inputValue(getFieldInput(document.querySelector('.entry-modal'), 'Language'), 'English');
    changeValue(getFieldInput(document.querySelector('.entry-modal'), 'Proficiency'), 'Fluent');
    getButton(document.querySelector('.entry-modal'), 'Save').click();
    expect(languages.querySelector('.profile-entry__title')?.textContent).toBe('English');
    expect(languages.querySelector('.profile-entry__meta')?.textContent).toBe('Fluent');
    expect(getSaveButton(getTopControls(container)).disabled).toBe(false);

    getHeaderAddButton(languages).click();
    inputValue(getFieldInput(document.querySelector('.entry-modal'), 'Language'), 'French');
    getButton(document.querySelector('.entry-modal'), 'Cancel').click();
    getButton(document.querySelector('.overlay-discard-dialog'), 'Discard').click();
    expect(languages.textContent).not.toContain('French');

    getHeaderAddButton(getCard(container, 'CERTIFICATIONS')).click();
    getHeaderAddButton(languages).click();
    expect(document.querySelectorAll('.entry-modal, .entry-sheet')).toHaveLength(1);
    expect(document.querySelector('.entry-overlay__title')?.textContent).toBe('Add Certification');
  });

  it('blocks adding education when year is not four digits', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const education = getCard(container, 'EDUCATION');

    getHeaderAddButton(education).click();
    const overlay = document.querySelector('.entry-modal');

    inputValue(getFieldInput(overlay, 'Degree & Major'), 'BS Computer Science');
    inputValue(getFieldInput(overlay, 'University'), 'State University');
    inputValue(getFieldInput(overlay, 'Year Completed'), '20-20');
    getButton(overlay, 'Save').click();

    expect(getField(overlay, 'Year Completed').querySelector('.field-error')?.textContent)
      .toBe('Year must be a valid four-digit year.');
    expect(education.querySelectorAll('.entry-row')).toHaveLength(0);
  });

  it('validates and sorts experience entries with current work handling', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const experience = getCard(container, 'PROFESSIONAL EXPERIENCE');

    getHeaderAddButton(experience).click();
    let overlay = document.querySelector('.entry-modal');
    expect(getFieldInput(overlay, 'Date Ended').disabled).toBe(false);

    const currentWork = overlay.querySelector('input[type="checkbox"]');

    currentWork.checked = true;
    currentWork.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(getFieldInput(overlay, 'Date Ended').disabled).toBe(true);
    expect(getField(overlay, 'Date Ended').classList).toContain('edit-field--disabled');

    currentWork.checked = false;
    currentWork.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(getFieldInput(overlay, 'Date Ended').disabled).toBe(false);

    inputValue(getFieldInput(overlay, 'Role'), 'Past Role');
    inputValue(getFieldInput(overlay, 'Company'), 'Acme');
    inputValue(getFieldInput(overlay, 'Responsibilities'), 'Built tools');
    inputValue(getFieldInput(overlay, 'Date Started'), '13/2024');
    inputValue(getFieldInput(overlay, 'Date Ended'), '02/2025');
    getButton(overlay, 'Save').click();
    expect([...overlay.querySelectorAll('.field-error')]
      .some((error) => error.textContent === 'Month must be 01-12.')).toBe(true);

    inputValue(getFieldInput(overlay, 'Date Started'), '01/2024');
    getButton(overlay, 'Save').click();
    expect(experience.querySelector('.profile-entry__title')?.textContent).toBe('Past Role');
    expect(experience.querySelector('.profile-entry__meta')?.textContent)
      .toBe('Acme | 01/2024 – 02/2025');

    getHeaderAddButton(experience).click();
    overlay = document.querySelector('.entry-modal');
    inputValue(getFieldInput(overlay, 'Role'), 'Current Role');
    inputValue(getFieldInput(overlay, 'Company'), 'Beta');
    inputValue(getFieldInput(overlay, 'Responsibilities'), 'Lead work');
    inputValue(getFieldInput(overlay, 'Date Started'), '03/2025');
    overlay.querySelector('input[type="checkbox"]').checked = true;
    overlay.querySelector('input[type="checkbox"]').dispatchEvent(new window.Event('change', { bubbles: true }));
    getButton(overlay, 'Save').click();

    expect(experience.querySelector('.profile-entry__title')?.textContent)
      .toBe('Current Role');
    expect(experience.querySelector('.profile-entry__meta')?.textContent)
      .toBe('Beta | 03/2025 – Present');
  });

  it('Edit icon opens overlay pre-filled with entry data', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      experience: [{
        role: 'Senior Engineer',
        company: 'Acme',
        responsibilities: 'Built dashboards.',
        dateStarted: '01/2023',
        dateEnded: '02/2024',
      }],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    getCard(container, 'PROFESSIONAL EXPERIENCE')
      .querySelector('[aria-label="Edit entry"]')
      .click();

    const overlay = document.querySelector('.entry-modal');

    expect(overlay.querySelector('.entry-overlay__title')?.textContent).toBe('Edit Experience');
    expect(getFieldInput(overlay, 'Role').value).toBe('Senior Engineer');
    expect(getFieldInput(overlay, 'Company').value).toBe('Acme');
  });

  it('Save from edit overlay updates entry in-place', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      experience: [{
        role: 'Senior Engineer',
        company: 'Acme',
        responsibilities: 'Built dashboards.',
        dateStarted: '01/2023',
        dateEnded: '02/2024',
      }],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    getCard(container, 'PROFESSIONAL EXPERIENCE')
      .querySelector('[aria-label="Edit entry"]')
      .click();
    inputValue(getFieldInput(document.querySelector('.entry-modal'), 'Role'), 'Staff Engineer');
    getButton(document.querySelector('.entry-modal'), 'Save').click();

    const experience = getCard(container, 'PROFESSIONAL EXPERIENCE');

    expect([...experience.querySelectorAll('.entry-row--structured')]).toHaveLength(1);
    expect(experience.querySelector('.profile-entry__title')?.textContent).toBe('Staff Engineer');
    expect(experience.textContent).not.toContain('Senior Engineer');
  });

  it('Edit then Cancel with changed value shows discard dialog', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      experience: [{
        role: 'Senior Engineer',
        company: 'Acme',
        responsibilities: 'Built dashboards.',
        dateStarted: '01/2023',
        dateEnded: '02/2024',
      }],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    getCard(container, 'PROFESSIONAL EXPERIENCE')
      .querySelector('[aria-label="Edit entry"]')
      .click();
    inputValue(getFieldInput(document.querySelector('.entry-modal'), 'Role'), 'Staff Engineer');
    getButton(document.querySelector('.entry-modal'), 'Cancel').click();

    expect(document.querySelector('.overlay-discard-dialog')).toBeTruthy();
  });

  it('Remove icon still removes the entry', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      experience: [{
        role: 'Senior Engineer',
        company: 'Acme',
        responsibilities: 'Built dashboards.',
        dateStarted: '01/2023',
        dateEnded: '02/2024',
      }],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const experience = getCard(container, 'PROFESSIONAL EXPERIENCE');

    experience.querySelector('[aria-label="Remove entry"]').click();

    expect(experience.textContent).not.toContain('Senior Engineer');
    expect(experience.querySelector('.entry-row--structured')).toBeNull();
  });

  it('validates links and renders friendly-name and hostname labels', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const links = getCard(container, 'LINKS');

    getHeaderAddButton(links).click();
    let overlay = document.querySelector('.entry-modal');
    inputValue(getFieldInput(overlay, 'Link URL'), 'javascript:alert(1)');
    getButton(overlay, 'Save').click();
    expect(overlay.querySelector('.field-error')?.textContent)
      .toBe('Please enter a valid URL (http or https).');

    inputValue(getFieldInput(overlay, 'Link URL'), 'https://example.com/profile');
    inputValue(getFieldInput(overlay, 'Friendly Name'), 'Portfolio');
    getButton(overlay, 'Save').click();
    expect(links.querySelector('.profile-entry__title')?.textContent).toBe('Portfolio');

    getHeaderAddButton(links).click();
    overlay = document.querySelector('.entry-modal');
    inputValue(getFieldInput(overlay, 'Link URL'), 'https://github.com/alex');
    getButton(overlay, 'Save').click();
    expect([...links.querySelectorAll('.profile-entry__title')].map((title) => title.textContent))
      .toEqual(['Portfolio', 'github.com']);
  });

  it('renders loaded profile links as structured plain text rows', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile({
      links: [
        { url: 'https://example.com/profile', friendlyName: 'Portfolio' },
        { url: 'javascript:alert(1)', friendlyName: 'Unsafe' },
      ],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const links = getCard(container, 'LINKS');

    expect([...links.querySelectorAll('.profile-entry__title')].map((title) => title.textContent))
      .toEqual(['Portfolio', 'Unsafe']);
    expect([...links.querySelectorAll('.profile-entry__meta')].map((meta) => meta.textContent))
      .toEqual(['https://example.com/profile', 'javascript:alert(1)']);
    expect(links.querySelector('a')).toBeNull();
  });

  it('blocks adding a certification when issuing body is missing', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const certs = getCard(container, 'CERTIFICATIONS');

    getHeaderAddButton(certs).click();
    const overlay = document.querySelector('.entry-modal');
    inputValue(getFieldInput(overlay, 'Certification Name'), 'AWS Developer');
    inputValue(getFieldInput(overlay, 'Issuance Date'), '01/2023');
    getButton(overlay, 'Save').click();

    const error = [...overlay.querySelectorAll('.field-error')]
      .find((el) => el.textContent === 'This field is required.');
    expect(error).toBeTruthy();
    expect(error.hidden).toBe(false);
    expect(certs.querySelectorAll('.entry-row')).toHaveLength(0);
  });

  it('blocks adding a certification when optional expiry date is invalid', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const certs = getCard(container, 'CERTIFICATIONS');

    getHeaderAddButton(certs).click();
    const overlay = document.querySelector('.entry-modal');

    inputValue(getFieldInput(overlay, 'Certification Name'), 'AWS Developer');
    inputValue(getFieldInput(overlay, 'Issuing Body'), 'Amazon');
    inputValue(getFieldInput(overlay, 'Issuance Date'), '01/2023');
    inputValue(getFieldInput(overlay, 'Expiry Date'), 'baddate');
    getButton(overlay, 'Save').click();

    expect([...overlay.querySelectorAll('.field-error')]
      .some((error) => error.textContent.includes('MM/YYYY'))).toBe(true);
    expect(certs.querySelectorAll('.entry-row')).toHaveLength(0);
  });

  it('blocks adding an award when optional date is invalid', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const awards = getCard(container, 'AWARDS');

    getHeaderAddButton(awards).click();
    const overlay = document.querySelector('.entry-modal');

    inputValue(getFieldInput(overlay, 'Award Name'), 'Top Performer');
    inputValue(getFieldInput(overlay, 'Issuing Body'), 'Acme');
    inputValue(getFieldInput(overlay, 'Date'), 'baddate');
    getButton(overlay, 'Save').click();

    expect([...overlay.querySelectorAll('.field-error')]
      .some((error) => error.textContent.includes('MM/YYYY'))).toBe(true);
    expect(awards.querySelectorAll('.entry-row')).toHaveLength(0);
  });

  it('routes the subheader cancel action through discard behavior', async () => {
    const container = createAppShell();
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate });

    getCancelButton(document.querySelector('.profile-edit-subheader')).click();
    expect(navigate).toHaveBeenCalledWith('profile');

    navigate.mockClear();
    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'Phone'), '555-0100');
    getCancelButton(document.querySelector('.profile-edit-subheader')).click();

    expect(navigate).not.toHaveBeenCalled();
    expect(document.querySelector('.confirm-backdrop')).toBeTruthy();
  });

  it('prompts before external navigation when dirty and follows the selected target on discard', async () => {
    const container = createAppShell();
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate });

    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'Phone'), '555-0100');

    expect(ProfileEdit.confirmNavigation('calendar')).toBe(false);
    expect(document.querySelector('.confirm-backdrop')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();

    [...document.querySelectorAll('.confirm-modal button')]
      .find((button) => button.textContent === 'Discard')
      .click();

    expect(navigate).toHaveBeenCalledWith('calendar');
    expect(Toast.show).toHaveBeenCalledWith('Edits discarded.', 'success');
  });

  it('prompts before page unload when an overlay draft is dirty', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const cleanEvent = new window.Event('beforeunload', { cancelable: true });

    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    const overlay = openExperienceOverlay(container);
    const dirtyEvent = new window.Event('beforeunload', { cancelable: true });

    inputValue(getFieldInput(overlay, 'Role'), 'Engineer');
    window.dispatchEvent(dirtyEvent);

    expect(dirtyEvent.defaultPrevented).toBe(true);
  });

  it('marks required fields visually', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    expect(getField(getCard(container, 'BASIC INFO'), 'First Name').classList)
      .toContain('edit-field--required');
    getHeaderAddButton(getCard(container, 'CERTIFICATIONS')).click();
    expect(getField(document.querySelector('.entry-modal'), 'Issuing Body').classList)
      .toContain('edit-field--required');
  });

  it('removes the subheader on unmount', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    expect(document.querySelector('.profile-edit-subheader')).toBeTruthy();

    ProfileEdit.unmount();

    expect(document.querySelector('.profile-edit-subheader')).toBeNull();
    expect(container.children).toHaveLength(0);
  });

  it('applies subheader styling class to entry overlays and uses SVG entry actions', async () => {
    const container = createAppShell();

    window.innerWidth = 1024;
    api.getProfile.mockResolvedValue(createProfile({
      experience: [{
        role: 'Frontend Engineer',
        company: 'Acme',
        responsibilities: 'Build dashboards.',
        dateStarted: '01/2024',
        dateEnded: '02/2025',
      }],
    }));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const entry = getCard(container, 'PROFESSIONAL EXPERIENCE').querySelector('.entry-row');

    expect(entry.querySelector('[aria-label="Edit entry"] svg.icon')).not.toBeNull();
    expect(entry.querySelector('[aria-label="Remove entry"] svg.icon')).not.toBeNull();

    getHeaderAddButton(getCard(container, 'PROFESSIONAL EXPERIENCE')).click();

    expect(document.querySelector('.entry-overlay__header')).not.toBeNull();
    expect(document.querySelector('.entry-overlay__header').classList).not.toContain('subheader');
  });
});
