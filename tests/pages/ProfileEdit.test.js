// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/api.js', () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

vi.mock('../../src/components/Toast.js', () => ({
  Toast: {
    show: vi.fn(),
  },
}));

import { Toast } from '../../src/components/Toast.js';
import * as api from '../../src/services/api.js';
import { ProfileEdit } from '../../src/pages/ProfileEdit.js';

afterEach(() => {
  ProfileEdit.unmount();
  document.body.replaceChildren();
  vi.clearAllMocks();
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
    .find((button) => button.textContent === label);
}

function inputValue(input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function changeValue(input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('ProfileEdit page', () => {
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

  it('shows saving state on both save buttons while save is in progress', async () => {
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

    expect(getSaveButton(getTopControls(container)).textContent).toBe('Saving…');
    expect(getSaveButton(getBottomControls(container)).textContent).toBe('Saving…');
    expect(getSaveButton(getTopControls(container)).disabled).toBe(true);
    expect(getSaveButton(getBottomControls(container)).disabled).toBe(true);

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

  it('blocks save when an inline entry form is open', async () => {
    const container = createAppShell();
    const openForm = document.createElement('div');

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'Phone'), '555-0100');
    openForm.className = 'inline-entry-form';
    getCard(container, 'SKILLS').append(openForm);
    getSaveButton(getTopControls(container)).click();

    expect(api.saveProfile).not.toHaveBeenCalled();
    expect(document.querySelector('.open-form-error')?.previousElementSibling)
      .toBe(getTopControls(container));
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it('adds, deduplicates, and removes skills while tracking dirty reversion', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const skills = getCard(container, 'SKILLS');
    const input = skills.querySelector('.skills-input-row input');

    inputValue(input, 'TypeScript');
    getButton(skills, 'Add').click();
    expect([...skills.querySelectorAll('.skill-pill')].map((pill) => pill.textContent)).toEqual(['TypeScriptx']);
    expect(getSaveButton(getTopControls(container)).disabled).toBe(false);

    inputValue(skills.querySelector('.skills-input-row input'), 'TypeScript');
    getButton(skills, 'Add').click();
    inputValue(skills.querySelector('.skills-input-row input'), 'typescript');
    getButton(skills, 'Add').click();
    expect(skills.querySelectorAll('.skill-pill')).toHaveLength(1);

    skills.querySelector('.skill-pill__remove').click();
    expect(skills.querySelectorAll('.skill-pill')).toHaveLength(0);
    expect(getSaveButton(getTopControls(container)).disabled).toBe(true);
  });

  it('manages language inline forms with validation, cancel, and one-at-a-time guard', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const languages = getCard(container, 'LANGUAGES');

    getButton(languages, 'Add Language').click();
    expect(languages.querySelector('.inline-entry-form')).toBeTruthy();

    getButton(languages, 'Add').click();
    expect(languages.querySelector('.field-error')?.textContent).toBe('This field is required.');

    inputValue(getFieldInput(languages, 'Language'), 'English');
    changeValue(getFieldInput(languages, 'Proficiency'), 'Fluent');
    getButton(languages, 'Add').click();
    expect(languages.textContent).toContain('English | Fluent');
    expect(getSaveButton(getTopControls(container)).disabled).toBe(false);

    getButton(languages, 'Add Language').click();
    inputValue(getFieldInput(languages, 'Language'), 'French');
    getButton(languages, 'Cancel').click();
    expect(languages.textContent).not.toContain('French');

    getButton(getCard(container, 'CERTIFICATIONS'), 'Add Certification').click();
    getButton(languages, 'Add Language').click();
    expect(document.querySelectorAll('.inline-entry-form')).toHaveLength(1);
    expect(getCard(container, 'CERTIFICATIONS').querySelector('.inline-entry-form')).toBeTruthy();
  });

  it('validates and sorts experience entries with current work handling', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const experience = getCard(container, 'PROFESSIONAL EXPERIENCE');

    getButton(experience, 'Add Experience').click();
    expect(getField(experience, 'Date Ended').hidden).toBe(false);

    const currentWork = experience.querySelector('input[type="checkbox"]');

    currentWork.checked = true;
    currentWork.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(getField(experience, 'Date Ended').hidden).toBe(true);

    currentWork.checked = false;
    currentWork.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(getField(experience, 'Date Ended').hidden).toBe(false);

    inputValue(getFieldInput(experience, 'Role'), 'Past Role');
    inputValue(getFieldInput(experience, 'Company'), 'Acme');
    inputValue(getFieldInput(experience, 'Responsibilities'), 'Built tools');
    inputValue(getFieldInput(experience, 'Date Started'), '13/2024');
    inputValue(getFieldInput(experience, 'Date Ended'), '02/2025');
    getButton(experience, 'Add').click();
    expect([...experience.querySelectorAll('.field-error')]
      .some((error) => error.textContent === 'Month must be 01-12.')).toBe(true);

    inputValue(getFieldInput(experience, 'Date Started'), '01/2024');
    getButton(experience, 'Add').click();
    expect(experience.textContent).toContain('Past Role | Acme | 01/2024-02/2025');

    getButton(experience, 'Add Experience').click();
    inputValue(getFieldInput(experience, 'Role'), 'Current Role');
    inputValue(getFieldInput(experience, 'Company'), 'Beta');
    inputValue(getFieldInput(experience, 'Responsibilities'), 'Lead work');
    inputValue(getFieldInput(experience, 'Date Started'), '03/2025');
    experience.querySelector('input[type="checkbox"]').checked = true;
    experience.querySelector('input[type="checkbox"]').dispatchEvent(new window.Event('change', { bubbles: true }));
    getButton(experience, 'Add').click();

    expect(experience.querySelector('.entry-row__text')?.textContent)
      .toBe('Current Role | Beta | 03/2025-Present');
  });

  it('validates links and renders friendly-name and hostname labels', async () => {
    const container = createAppShell();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const links = getCard(container, 'LINKS');

    getButton(links, 'Add Link').click();
    inputValue(getFieldInput(links, 'Link URL'), 'javascript:alert(1)');
    getButton(links, 'Add').click();
    expect(links.querySelector('.field-error')?.textContent)
      .toBe('Please enter a valid URL (http or https).');

    inputValue(getFieldInput(links, 'Link URL'), 'https://example.com/profile');
    inputValue(getFieldInput(links, 'Friendly Name'), 'Portfolio');
    getButton(links, 'Add').click();
    expect(links.querySelector('a')?.textContent).toBe('Portfolio');

    getButton(links, 'Add Link').click();
    inputValue(getFieldInput(links, 'Link URL'), 'https://github.com/alex');
    getButton(links, 'Add').click();
    expect([...links.querySelectorAll('a')].map((anchor) => anchor.textContent))
      .toEqual(['Portfolio', 'github.com']);
  });

  it('routes the subheader back action through cancel behavior', async () => {
    const container = createAppShell();
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue(createProfile());

    await ProfileEdit.mount(container, { navigate });

    document.querySelector('.profile-edit-subheader__back').click();
    expect(navigate).toHaveBeenCalledWith('profile');

    navigate.mockClear();
    inputValue(getFieldInput(getCard(container, 'BASIC INFO'), 'Phone'), '555-0100');
    document.querySelector('.profile-edit-subheader__back').click();

    expect(navigate).not.toHaveBeenCalled();
    expect(document.querySelector('.confirm-backdrop')).toBeTruthy();
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
});
