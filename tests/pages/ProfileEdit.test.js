// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/api.js', () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

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
    skills: [],
    languages: [],
    certifications: [],
    awards: [],
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
  return [...card.querySelectorAll('.edit-field')]
    .find((field) => field.querySelector('.edit-field__label')?.textContent === label)
    .querySelector('.edit-field__control');
}

function getSaveButton(card) {
  return [...card.querySelectorAll('button')]
    .find((button) => button.textContent === 'Save');
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('ProfileEdit page', () => {
  it('saves basic info and reflects the saved profile', async () => {
    const container = createAppShell();
    const initialProfile = createProfile({ firstName: 'Ana' });
    const savedProfile = createProfile({ firstName: 'Anika', city: 'Seattle' });

    api.getProfile
      .mockResolvedValueOnce(initialProfile)
      .mockResolvedValueOnce(initialProfile);
    api.saveProfile.mockResolvedValue(savedProfile);

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const card = getCard(container, 'BASIC INFO');

    getFieldInput(card, 'First Name').value = 'Anika';
    getFieldInput(card, 'City/Location').value = 'Seattle';
    getSaveButton(card).click();
    await flushPromises();

    expect(api.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Anika',
      city: 'Seattle',
      summary: '',
    }));
    expect(card.querySelector('.edit-card__feedback')?.textContent).toBe('Saved.');
    expect(getFieldInput(card, 'First Name').value).toBe('Anika');
    expect(getFieldInput(card, 'City/Location').value).toBe('Seattle');
  });

  it('surfaces basic info validation errors from the API', async () => {
    const container = createAppShell();

    api.getProfile
      .mockResolvedValueOnce(createProfile())
      .mockResolvedValueOnce(createProfile());
    api.saveProfile.mockRejectedValue({
      fields: { firstName: 'First name is required.' },
    });

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const card = getCard(container, 'BASIC INFO');

    getFieldInput(card, 'First Name').value = '';
    getSaveButton(card).click();
    await flushPromises();

    const error = [...card.querySelectorAll('.field-error')]
      .find((fieldError) => fieldError.textContent === 'First name is required.');

    expect(error).toBeTruthy();
    expect(error.hidden).toBe(false);
    expect(card.querySelector('.edit-card__feedback')?.textContent).toBe('');
  });

  it('aborts saves when profile refresh fails to avoid clobbering sections', async () => {
    const container = createAppShell();

    api.getProfile
      .mockResolvedValueOnce(createProfile({ summary: 'Existing summary' }))
      .mockRejectedValueOnce(new Error('offline'));

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const card = getCard(container, 'SUMMARY');

    getFieldInput(card, 'Summary').value = 'New summary';
    getSaveButton(card).click();
    await flushPromises();

    expect(api.saveProfile).not.toHaveBeenCalled();
    expect(card.querySelector('.edit-card__feedback')?.textContent)
      .toBe('Unable to reach server. Please try again.');
  });

  it('ignores duplicate basic info saves while a save is already running', async () => {
    const container = createAppShell();
    let resolveSave;
    const savePromise = new Promise((resolve) => {
      resolveSave = resolve;
    });

    api.getProfile
      .mockResolvedValueOnce(createProfile())
      .mockResolvedValueOnce(createProfile());
    api.saveProfile.mockReturnValue(savePromise);

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const card = getCard(container, 'BASIC INFO');
    const saveButton = getSaveButton(card);

    saveButton.click();
    await flushPromises();
    saveButton.click();

    expect(api.saveProfile).toHaveBeenCalledTimes(1);
    expect(saveButton.disabled).toBe(true);

    resolveSave(createProfile({ firstName: 'Ana' }));
    await flushPromises();

    expect(saveButton.disabled).toBe(false);
  });
});
