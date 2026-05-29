// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/authStore.js', () => ({
  DEMO_STATUS: 'demo',
  getAccessToken: () => null,
  getAuthState: () => ({ status: 'demo', user: null, accessToken: null }),
  subscribe: () => () => {},
}));

import { Modal } from '../../src/components/Modal.js';
import { Card } from '../../src/components/Card.js';
import { CreationPicker } from '../../src/components/CreationPicker.js';
import { ResumeImport } from '../../src/components/ResumeImport.js';
import { Calendar } from '../../src/pages/Calendar.js';
import { Profile } from '../../src/pages/Profile.js';
import { ProfileEdit } from '../../src/pages/ProfileEdit.js';
import { Tracker } from '../../src/pages/Tracker.js';
import * as api from '../../src/services/api.js';
import * as demoStore from '../../src/data/demoStore.js';

function flushPromises(count = 2) {
  let chain = Promise.resolve();
  for (let index = 0; index < count; index += 1) {
    chain = chain.then(() => {});
  }
  return chain;
}

function inputValue(input, value) {
  input.value = value;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function getProfileEditCard(container, title) {
  return [...container.querySelectorAll('.section-card')]
    .find((card) => card.querySelector('.section-label')?.textContent === title);
}

function getFieldInput(card, label) {
  return [...card.querySelectorAll('.edit-field')]
    .find((field) => field.querySelector('.edit-field__label')?.textContent === label)
    ?.querySelector('.edit-field__control');
}

function getSaveButton(container) {
  return container.querySelector('.page-controls__save');
}

function findCreationCardByTitle(title) {
  return [...document.querySelectorAll('.creation-picker-card')]
    .find((card) => card.querySelector('.creation-picker-card__title')?.textContent === title);
}

beforeEach(() => {
  demoStore.loadSeed();
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('fetch must not run in demo mode');
  }));
  window.scrollTo = vi.fn();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  CreationPicker.close();
  Modal.close();
  Calendar.unmount();
  Profile.unmount();
  ProfileEdit.unmount();
  Tracker.unmount();
  document.body.replaceChildren();
  demoStore.clear();
  vi.unstubAllGlobals();
});

describe('demo-mode loading parity', () => {
  it('CreationPicker hides parser loading controls in demo mode while preserving manual entry', () => {
    CreationPicker.open();

    expect(findCreationCardByTitle('Smart Parser')).toBeUndefined();
    expect(document.querySelector('.parser-process-btn')).toBeNull();
    expect(findCreationCardByTitle('Manual Entry')).not.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('ResumeImport hides upload loading controls in demo mode', () => {
    const root = ResumeImport.create();
    document.body.append(root);

    expect(root.hidden).toBe(true);
    expect(root.querySelector('.profile-btn--primary')).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    root.destroy();
  });

  it('Modal mutation buttons traverse busy state through demoStore-backed api', async () => {
    const [application] = await api.getAll();
    Modal.open(application, { onApplicationUpdate: vi.fn() });

    const favorite = document.querySelector('.modal-quick-action--favorite');
    favorite.click();

    expect(favorite.getAttribute('aria-busy')).toBe('true');
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await flushPromises();

    expect(favorite.hasAttribute('aria-busy')).toBe(false);
  });

  it('Card unarchive traverses busy state through demoStore-backed api', async () => {
    const [archived] = await api.getAll({ view: 'archived' });
    const onUnarchiveSuccess = vi.fn();
    const card = Card.render(archived, { onUnarchiveSuccess });
    document.body.append(card);

    const unarchive = card.querySelector('.card-btn--unarchive');
    unarchive.click();

    expect(unarchive.getAttribute('aria-busy')).toBe('true');
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await flushPromises();

    expect(unarchive.hasAttribute('aria-busy')).toBe(false);
    expect(onUnarchiveSuccess).toHaveBeenCalled();
  });

  it('Tracker cold load and view transition use loading states with demoStore data', async () => {
    const container = document.createElement('main');
    const mounted = Tracker.mount(container);

    expect(container.querySelector('.loading-skeleton--applications')).not.toBeNull();

    await mounted;

    const chip = container.querySelector('.view-chip');
    chip.querySelector('.app-title-trigger').click();
    document.querySelector('.view-popup__option[data-view="archived"]').click();

    expect(chip.getAttribute('aria-busy')).toBe('true');
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await flushPromises(4);

    expect(chip.hasAttribute('aria-busy')).toBe(false);
  });

  it('Calendar cold load and month refresh use loading states with demoStore data', async () => {
    const container = document.createElement('main');
    const mounted = Calendar.mount(container);

    expect(container.querySelector('.calendar-skeleton__grid')).not.toBeNull();

    await mounted;

    const grid = container.querySelector('.calendar-page__grid');
    container.querySelector('[aria-label="Previous month"]').click();

    expect(grid.getAttribute('aria-busy')).toBe('true');
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await flushPromises(4);

    expect(grid.hasAttribute('aria-busy')).toBe(false);
  });

  it('Profile cold load renders skeletons with demoStore data', async () => {
    const container = document.createElement('main');
    const mounted = Profile.mount(container, { navigate: vi.fn() });

    expect(container.querySelector('.loading-skeleton--profile')).not.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await mounted;

    expect(container.querySelector('.loading-skeleton--profile')).toBeNull();
  });

  it('ProfileEdit Save traverses busy state through demoStore-backed api', async () => {
    const container = document.createElement('main');
    document.body.append(document.createElement('header'), container);

    await ProfileEdit.mount(container, { navigate: vi.fn() });

    const phone = getFieldInput(getProfileEditCard(container, 'BASIC INFO'), 'Phone');
    inputValue(phone, '555-0199');

    const save = getSaveButton(container);
    save.click();

    expect(save.getAttribute('aria-busy')).toBe('true');
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await flushPromises();

    expect(save.hasAttribute('aria-busy')).toBe(false);
  });
});
