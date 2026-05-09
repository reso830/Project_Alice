// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/api.js', () => ({
  archive: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../src/components/ConfirmDialog.js', () => ({
  ConfirmDialog: { show: vi.fn() },
}));

import * as api from '../../src/services/api.js';
import { ConfirmDialog } from '../../src/components/ConfirmDialog.js';
import {
  Modal,
  getHeaderContrastRatio,
} from '../../src/components/Modal.js';
import { STATUS_CONFIG } from '../../src/models/application.js';
import { formatPeso } from '../../src/utils/currency.js';

const mainCss = readFileSync(join(cwd(), 'src/styles/main.css'), 'utf8');

function application(overrides = {}) {
  return {
    id: 1,
    jobTitle: 'Frontend Engineer',
    companyName: 'Acme',
    status: 'wishlisted',
    lastStatusUpdate: '2026-04-30',
    compat: 80,
    recruiter: '',
    salary: 150000,
    responsibilities: 'Build UI',
    skills: ['JavaScript'],
    location: '',
    shift: '',
    workSetup: '',
    compatNotes: '',
    generalNotes: '',
    preferredSkills: [],
    jobPostingUrl: '',
    ...overrides,
  };
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
}

function getSalaryFieldValue() {
  return [...document.querySelectorAll('.modal-field')]
    .find((field) => field.querySelector('.modal-field__label')?.textContent === 'Salary')
    ?.querySelector('.modal-field__value');
}

function getFieldByLabel(label) {
  return [...document.querySelectorAll('.modal-field')]
    .find((field) => field.querySelector('.modal-field__label')?.firstChild?.textContent === label);
}

function inputField(label) {
  const field = getFieldByLabel(label);
  field.click();
  return field.querySelector('input, textarea, select');
}

function editTextField(label, value) {
  const input = inputField(label);
  input.value = value;
  input.dispatchEvent(new window.Event('blur'));
}

function saveButton() {
  return document.querySelector('.modal-footer button[data-action="save"]');
}

function discardButton() {
  return document.querySelector('.modal-footer button[data-action="discard"]');
}

function closeButton() {
  return document.querySelector('.modal-quick-action--close');
}

function modalBackdrop() {
  return document.querySelector('.modal-backdrop');
}

async function flushPromises(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

afterEach(() => {
  Modal.close();
  document.body.replaceChildren();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('Modal', () => {
  it('renders the status-colored header and badge from STATUS_CONFIG', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());

    const header = document.querySelector('.modal-header');
    const badge = document.querySelector('#modal-status-badge');

    expect(header.style.backgroundColor).toBe(hexToRgb(STATUS_CONFIG.wishlisted.borderAccent));
    expect(header.style.color).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeText));
    expect(badge.style.backgroundColor).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeBg));
    expect(badge.style.color).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeText));
  });

  it('chooses contrast classes that meet WCAG AA for every status accent', () => {
    for (const config of Object.values(STATUS_CONFIG)) {
      expect(getHeaderContrastRatio(config.borderAccent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('renders icon-only quick actions in the required order', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());

    const actions = [...document.querySelectorAll('.modal-quick-action')];

    expect(actions).toHaveLength(4);
    expect(actions[0].classList.contains('modal-quick-action--favorite')).toBe(true);
    expect(actions[1].classList.contains('modal-quick-action--status')).toBe(true);
    expect(actions[2].classList.contains('modal-quick-action--archive')).toBe(true);
    expect(actions[3].classList.contains('modal-quick-action--close')).toBe(true);
    expect(actions.every((button) => button.querySelector('svg.icon'))).toBe(true);
    expect(actions.every((button) => !button.querySelector('.modal-quick-action__label'))).toBe(true);
    expect(actions.map((button) => button.title)).toEqual([
      'Favorite',
      'Change status',
      'Archive',
      'Close',
    ]);
    expect(actions.every((button) => !button.hasAttribute('aria-label'))).toBe(true);
    expect(document.querySelector('.modal-header__meta').contains(document.querySelector('.modal-quick-actions')))
      .toBe(false);
    expect(document.querySelector('.modal-header').lastElementChild).toBe(document.querySelector('.modal-quick-actions'));
  });

  it('keeps quick actions on a separate third header row', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());

    const header = document.querySelector('.modal-header');

    expect(header.children[0].className).toBe('modal-header__meta');
    expect(header.children[1].className).toBe('modal-header__title-row');
    expect(header.children[2].className).toBe('modal-quick-actions');
    expect(mainCss).toContain('.modal-header__meta');
    expect(mainCss).toContain('justify-content: flex-start;');
  });

  it('centers status badge text for narrow wrapped header pills', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ status: 'phone_screen' }));

    const badge = document.querySelector('#modal-status-badge');

    expect(badge.classList.contains('status-badge')).toBe(true);
    expect(mainCss).toContain('.modal-header .status-badge');
    expect(mainCss).toContain('text-align: center;');
    expect(mainCss).toContain('justify-content: center;');
    expect(mainCss).toContain('white-space: normal;');
  });

  it('allows long modal field values to wrap inside narrow containers', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({
      jobPostingUrl: 'https://example.com/really/long/path/without/simple/breakpoints/that/should/wrap',
    }));

    const urlValue = getFieldByLabel('URL').querySelector('.modal-field__value');

    expect(urlValue.classList.contains('modal-field__display')).toBe(true);
    expect(mainCss).toContain('.modal-field__display');
    expect(mainCss).toContain('overflow-wrap: break-word;');
    expect(mainCss).toContain('word-break: break-word;');
    expect(mainCss).toContain('min-width: 0;');
  });

  it('closes the overlay from the header close action', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());
    closeButton().click();

    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('confirms before closing a dirty draft and closes after confirmation', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show.mockResolvedValue(true);

    Modal.open(application());
    editTextField('Company', 'Globex');
    closeButton().click();
    await flushPromises();

    expect(ConfirmDialog.show).toHaveBeenCalledWith('Discard changes?\nYour edits will be lost.', {
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
    });
    expect(modalBackdrop()).toBeNull();
  });

  it('keeps a dirty draft open when close confirmation is cancelled', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show.mockResolvedValue(false);

    Modal.open(application());
    editTextField('Company', 'Globex');
    closeButton().click();
    await flushPromises();

    expect(ConfirmDialog.show).toHaveBeenCalledWith('Discard changes?\nYour edits will be lost.', {
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
    });
    expect(modalBackdrop()).not.toBeNull();
    expect(getFieldByLabel('Company').querySelector('.modal-field__value').textContent).toBe('Globex');
  });

  it('closes clean drafts from all close triggers without confirmation', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());
    closeButton().click();
    expect(modalBackdrop()).toBeNull();

    Modal.open(application());
    modalBackdrop().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(modalBackdrop()).toBeNull();

    Modal.open(application());
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(modalBackdrop()).toBeNull();
    expect(ConfirmDialog.show).not.toHaveBeenCalled();
  });

  it('prompts dirty drafts from backdrop and Escape close triggers', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show.mockResolvedValue(false);

    Modal.open(application());
    editTextField('Company', 'Globex');
    modalBackdrop().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(ConfirmDialog.show).toHaveBeenLastCalledWith('Discard changes?\nYour edits will be lost.', {
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
    });
    expect(modalBackdrop()).not.toBeNull();

    ConfirmDialog.show.mockClear();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();

    expect(ConfirmDialog.show).toHaveBeenCalledWith('Discard changes?\nYour edits will be lost.', {
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
    });
    expect(modalBackdrop()).not.toBeNull();
  });

  it('does not close the modal on Escape inside an inline editor', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ location: 'Manila' }));
    const locationInput = inputField('Location');
    locationInput.value = 'Cebu';
    locationInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(ConfirmDialog.show).not.toHaveBeenCalled();
    expect(modalBackdrop()).not.toBeNull();
    expect(getFieldByLabel('Location').querySelector('.modal-field__value').textContent).toBe('Manila');
  });

  it('does not trigger modal close while a confirmation dialog is open', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const confirmBackdrop = document.createElement('div');
    confirmBackdrop.className = 'confirm-backdrop';

    Modal.open(application());
    editTextField('Company', 'Globex');
    document.body.append(confirmBackdrop);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(ConfirmDialog.show).not.toHaveBeenCalled();
    expect(modalBackdrop()).not.toBeNull();
  });

  it('opens create mode with an empty wishlisted draft and active Create validation', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(null, { mode: 'create' });

    expect(modalBackdrop()).not.toBeNull();
    expect(document.querySelector('#modal-status-badge').textContent).toBe(STATUS_CONFIG.wishlisted.label);
    expect(document.querySelector('.modal-footer').hidden).toBe(false);
    expect(saveButton().textContent).toBe('Create');
    expect(saveButton().disabled).toBe(false);
    expect(document.querySelector('.modal-quick-action--archive')).toBeNull();
    expect(document.querySelector('.id-pill')?.textContent).toBe('#\u2014');
    expect(inputField('Company').value).toBe('');
    document.querySelector('#modal-title').click();
    expect(document.querySelector('.modal-title-input').value).toBe('');
    expect(document.querySelector('.compat-bar__label').textContent).toBe('0%');
  });

  it('shows all missing required fields when Create is clicked blank', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(null, { mode: 'create' });
    saveButton().click();
    await flushPromises();

    expect(api.create).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Job Title is required.');
    expect(document.body.textContent).toContain('Company is required.');
    expect(document.body.textContent).toContain('Responsibilities is required.');
  });

  it('creates an application and switches the modal to edit mode on success', async () => {
    const onApplicationCreate = vi.fn();
    const created = application({
      id: 42,
      jobTitle: 'Product Engineer',
      companyName: 'Globex',
      status: 'wishlisted',
      lastStatusUpdate: '2026-05-09',
      location: 'Manila',
    });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    api.create.mockResolvedValue(created);

    Modal.open(null, { mode: 'create', onApplicationCreate });
    document.querySelector('#modal-title').click();
    const titleInput = document.querySelector('.modal-title-input');
    titleInput.value = 'Product Engineer';
    titleInput.dispatchEvent(new window.Event('blur'));
    editTextField('Company', 'Globex');
    editTextField('Responsibilities', 'Build product UI');
    editTextField('Location', 'Manila');
    saveButton().click();
    await flushPromises();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      jobTitle: 'Product Engineer',
      companyName: 'Globex',
      responsibilities: 'Build product UI',
      location: 'Manila',
      status: 'wishlisted',
    }));
    expect(onApplicationCreate).toHaveBeenCalledWith(created);
    expect(document.body.textContent).toContain('Application created.');
    expect(document.querySelector('.modal-footer').hidden).toBe(true);
    expect(saveButton().textContent).toBe('Save');
    expect(document.querySelector('.modal-quick-action--archive')).not.toBeNull();
    expect(document.querySelector('.id-pill')?.textContent).toBe('42');
  });

  it('keeps create drafts open and unchanged when create fails', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    api.create.mockRejectedValue(new Error('server error'));

    Modal.open(null, { mode: 'create' });
    document.querySelector('#modal-title').click();
    const titleInput = document.querySelector('.modal-title-input');
    titleInput.value = 'Product Engineer';
    titleInput.dispatchEvent(new window.Event('blur'));
    editTextField('Company', 'Globex');
    editTextField('Responsibilities', 'Build product UI');
    saveButton().click();
    await flushPromises();

    expect(document.body.textContent).toContain('Failed to create application');
    expect(modalBackdrop()).not.toBeNull();
    expect(saveButton().textContent).toBe('Create');
    expect(saveButton().disabled).toBe(false);
    expect(getFieldByLabel('Company').querySelector('.modal-field__value').textContent).toBe('Globex');
    expect(document.querySelector('.modal-quick-action--archive')).toBeNull();
  });

  it('closes create mode after confirmed footer discard', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show.mockResolvedValue(true);

    Modal.open(null, { mode: 'create' });
    editTextField('Company', 'Globex');
    discardButton().click();
    await flushPromises();

    expect(ConfirmDialog.show).toHaveBeenCalledWith('Discard changes?\nYour edits will be lost.', {
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
    });
    expect(modalBackdrop()).toBeNull();
  });

  it('keeps create mode open when footer discard is cancelled', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show.mockResolvedValue(false);

    Modal.open(null, { mode: 'create' });
    editTextField('Company', 'Globex');
    discardButton().click();
    await flushPromises();

    expect(modalBackdrop()).not.toBeNull();
    expect(saveButton().textContent).toBe('Create');
    expect(getFieldByLabel('Company').querySelector('.modal-field__value').textContent).toBe('Globex');
  });

  it('renders the expanded metadata layout in display mode', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({
      location: 'Manila',
      shift: 'Day',
      workSetup: 'Remote',
      compatNotes: '',
      generalNotes: 'Ask about growth path.',
      preferredSkills: ['TypeScript', 'GraphQL'],
    }));

    for (const label of [
      'Location',
      'Shift',
      'Work Setup',
      'Compat Notes',
      'General Notes',
      'Preferred Skills',
      'Last Updated',
    ]) {
      expect(getFieldByLabel(label)).not.toBeUndefined();
    }

    expect(getFieldByLabel('Skills')).toBeUndefined();
    expect(getFieldByLabel('Required Skills')).not.toBeUndefined();
    expect(document.querySelector('.compat-bar')).not.toBeNull();
    expect(getFieldByLabel('Compat Notes').querySelector('.modal-field__value').textContent).toBe('\u2014');

    for (const label of ['Responsibilities', 'Required Skills', 'Preferred Skills', 'URL', 'General Notes']) {
      expect(getFieldByLabel(label).classList.contains('modal-field--full')).toBe(true);
    }
  });

  it('marks only required fields with visual indicators', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());

    expect(document.querySelector('.modal-header__title-row .modal-field__required')).not.toBeNull();
    expect(getFieldByLabel('Company').querySelector('.modal-field__required')).not.toBeNull();
    expect(getFieldByLabel('Responsibilities').querySelector('.modal-field__required')).not.toBeNull();
    expect(getFieldByLabel('Recruiter').querySelector('.modal-field__required')).toBeNull();
    expect(getFieldByLabel('URL').querySelector('.modal-field__required')).toBeNull();
  });

  it('renders Last Updated as read-only text', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ lastStatusUpdate: '2026-05-08' }));

    const field = getFieldByLabel('Last Updated');

    expect(field).not.toBeUndefined();
    expect(field.matches('button')).toBe(false);
    expect(field.querySelector('input, select, textarea, button')).toBeNull();
  });

  // Mobile bottom-sheet layout is CSS-only and is validated manually at 375px viewport.

  it('edits Location inline on blur and does not PATCH immediately', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ location: '' }));
    const input = inputField('Location');
    input.value = 'Manila';
    input.dispatchEvent(new window.Event('blur'));

    expect(api.update).not.toHaveBeenCalled();
    expect(getFieldByLabel('Location').querySelector('.modal-field__value').textContent).toBe('Manila');
  });

  it('reverts inline text edits on Escape and commits single-line edits on Enter', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ companyName: 'Acme', location: '' }));
    const locationInput = inputField('Location');
    locationInput.value = 'Cebu';
    locationInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(getFieldByLabel('Location').querySelector('.modal-field__value').textContent).toBe('\u2014');

    const companyInput = inputField('Company');
    companyInput.value = 'Globex';
    companyInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(getFieldByLabel('Company').querySelector('.modal-field__value').textContent).toBe('Globex');
  });

  it('parses salary inline input on blur', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ salary: null }));
    const input = inputField('Salary');
    input.value = '80k';
    input.dispatchEvent(new window.Event('blur'));

    expect(getSalaryFieldValue().textContent).toBe(formatPeso(80000));
  });

  it('edits multiline fields with Ctrl+Enter', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ generalNotes: '' }));
    const textarea = inputField('General Notes');
    textarea.value = 'Ask about the team.';
    textarea.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));

    expect(getFieldByLabel('General Notes').querySelector('.modal-field__value').textContent)
      .toBe('Ask about the team.');
  });

  it('edits Job Title inline in the header', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ jobTitle: 'Frontend Engineer' }));
    document.querySelector('#modal-title').click();
    const input = document.querySelector('.modal-title-input');
    input.value = 'Senior Frontend Engineer';
    input.dispatchEvent(new window.Event('blur'));

    expect(document.querySelector('#modal-title').textContent).toBe('Senior Frontend Engineer');
  });

  it('edits Shift through a native select and reverts on Escape', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ shift: '' }));
    const select = inputField('Shift');

    expect([...select.options].map((option) => option.value)).toEqual(['', 'Day', 'Mid', 'Night', 'Flexible']);

    select.value = 'Night';
    select.dispatchEvent(new window.Event('change'));

    expect(getFieldByLabel('Shift').querySelector('.modal-field__value').textContent).toBe('Night');

    const secondSelect = inputField('Shift');
    secondSelect.value = 'Day';
    secondSelect.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(getFieldByLabel('Shift').querySelector('.modal-field__value').textContent).toBe('Night');
  });

  it('re-syncs the footer when Escape reverts a select back to clean', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ shift: 'Night' }));
    const select = inputField('Shift');
    select.value = 'Day';
    select.dispatchEvent(new window.Event('change'));

    expect(document.querySelector('.modal-footer').hidden).toBe(false);

    select.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(getFieldByLabel('Shift').querySelector('.modal-field__value').textContent).toBe('Night');
    expect(document.querySelector('.modal-footer').hidden).toBe(true);
  });

  it('adds, removes, backspaces, and rejects duplicate Required Skills chips', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ skills: ['JavaScript'] }));

    const field = getFieldByLabel('Required Skills');
    expect(field.querySelectorAll('.skill-tag')).toHaveLength(1);

    const input = field.querySelector('input');
    input.value = 'TypeScript';
    expect(() => {
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      input.dispatchEvent(new window.Event('blur'));
    }).not.toThrow();

    expect(getFieldByLabel('Required Skills').textContent).toContain('TypeScript');

    const commaInput = getFieldByLabel('Required Skills').querySelector('input');
    commaInput.value = 'Accessibility';
    expect(() => {
      commaInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: ',', bubbles: true }));
      commaInput.dispatchEvent(new window.Event('blur'));
    }).not.toThrow();

    expect(getFieldByLabel('Required Skills').textContent).toContain('Accessibility');

    const duplicateInput = getFieldByLabel('Required Skills').querySelector('input');
    duplicateInput.value = 'TypeScript';
    duplicateInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect([...getFieldByLabel('Required Skills').querySelectorAll('.skill-tag')]
      .filter((tag) => tag.textContent.includes('TypeScript'))).toHaveLength(1);

    getFieldByLabel('Required Skills').querySelector('button[aria-label="Remove JavaScript"]').click();
    expect(getFieldByLabel('Required Skills').textContent).not.toContain('JavaScript');

    const backspaceInput = getFieldByLabel('Required Skills').querySelector('input');
    backspaceInput.value = '';
    backspaceInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(getFieldByLabel('Required Skills').querySelectorAll('.skill-tag')).toHaveLength(1);
    expect(getFieldByLabel('Required Skills').textContent).toContain('TypeScript');
    expect(getFieldByLabel('Required Skills').textContent).not.toContain('Accessibility');
  });

  it('renders a hidden edit footer and reveals it for draft changes', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ shift: '' }));

    expect(document.querySelector('.modal-footer')).not.toBeNull();
    expect(document.querySelector('.modal-footer').hidden).toBe(true);

    editTextField('Company', 'Globex');
    expect(document.querySelector('.modal-footer').hidden).toBe(false);

    Modal.open(application({ shift: '' }));
    const select = inputField('Shift');
    select.value = 'Day';
    select.dispatchEvent(new window.Event('change'));
    expect(document.querySelector('.modal-footer').hidden).toBe(false);

    Modal.open(application({ skills: ['JavaScript'] }));
    const chipInput = getFieldByLabel('Required Skills').querySelector('input');
    chipInput.value = 'TypeScript';
    chipInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('.modal-footer').hidden).toBe(false);

    Modal.open(application({ location: '' }));
    const locationInput = inputField('Location');
    locationInput.value = 'Cebu';
    locationInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.modal-footer').hidden).toBe(true);
  });

  it('reveals the footer for draft status changes', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ status: 'wishlisted' }));
    document.querySelector('.modal-quick-action--status').click();
    document.querySelector('[data-status="offer"]').click();

    expect(api.update).not.toHaveBeenCalled();
    expect(document.querySelector('.modal-footer').hidden).toBe(false);
  });

  it('saves the full draft, refreshes Last Updated, and hides the footer', async () => {
    const onApplicationUpdate = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    api.update.mockResolvedValue({
      ...application(),
      companyName: 'Globex',
      lastStatusUpdate: '2026-05-09',
    });

    Modal.open(application(), { onApplicationUpdate });
    editTextField('Company', 'Globex');
    saveButton().click();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.update).toHaveBeenCalledWith(1, expect.objectContaining({
      companyName: 'Globex',
      skills: ['JavaScript'],
      preferredSkills: [],
    }), expect.anything());
    expect(document.querySelector('.modal-footer').hidden).toBe(true);
    expect(document.body.textContent).toContain('Saved.');
    expect(onApplicationUpdate).toHaveBeenCalledWith(expect.objectContaining({ companyName: 'Globex' }));
    expect(getFieldByLabel('Last Updated').querySelector('.modal-field__value').textContent).toBe('May 9');
  });

  it('normalizes nullable API fields before saving an edited draft', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    api.update.mockResolvedValue({ ...application(), companyName: 'Globex' });

    Modal.open(application({
      companyName: 'Acme',
      sourcePlatform: null,
      notes: null,
      applicationDate: null,
      followUpAction: null,
      followUpDate: null,
      generalNotes: null,
    }));
    editTextField('Company', 'Globex');
    saveButton().click();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.update).toHaveBeenCalledWith(1, expect.objectContaining({
      companyName: 'Globex',
      sourcePlatform: '',
      notes: '',
      applicationDate: '',
      followUpAction: '',
      followUpDate: '',
      generalNotes: '',
    }), expect.anything());
  });

  it('does not crash if the modal closes while save is in flight', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    let resolveSave;
    api.update.mockReturnValue(new Promise((resolve) => {
      resolveSave = resolve;
    }));

    Modal.open(application());
    editTextField('Company', 'Globex');
    saveButton().click();
    Modal.close();

    resolveSave({ ...application(), companyName: 'Globex' });
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('keeps favorite sync when saving after an immediate favorite toggle', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    api.update
      .mockResolvedValueOnce({ ...application(), fav: true })
      .mockResolvedValueOnce({ ...application(), fav: true, companyName: 'Globex' });

    Modal.open(application({ fav: false }));
    document.querySelector('.modal-quick-action--favorite').click();
    await Promise.resolve();

    editTextField('Company', 'Globex');
    saveButton().click();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.update).toHaveBeenNthCalledWith(2, 1, expect.objectContaining({
      companyName: 'Globex',
      fav: true,
    }), expect.anything());
  });

  it('validates required fields and URL before saving', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());
    document.querySelector('#modal-title').click();
    const titleInput = document.querySelector('.modal-title-input');
    titleInput.value = '';
    titleInput.dispatchEvent(new window.Event('blur'));
    saveButton().click();
    await Promise.resolve();

    expect(api.update).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Job Title is required.');

    Modal.open(application());
    editTextField('Company', '');
    saveButton().click();
    await Promise.resolve();

    expect(api.update).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Company is required.');

    Modal.open(application());
    editTextField('Responsibilities', '');
    saveButton().click();
    await Promise.resolve();

    expect(api.update).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Responsibilities is required.');

    Modal.open(application());
    editTextField('URL', 'ftp://example.com/job');
    saveButton().click();
    await Promise.resolve();

    expect(api.update).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Please enter a valid URL');
  });

  it('renders multiline display fields with newline-preserving class', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({
      responsibilities: 'Line one\nLine two',
      compatNotes: 'Good fit\nStrong stack',
      generalNotes: 'Ask comp\nCheck visa',
    }));

    expect(getFieldByLabel('Responsibilities').querySelector('.modal-field__value').classList)
      .toContain('modal-field__display--multiline');
    expect(getFieldByLabel('Compat Notes').querySelector('.modal-field__value').classList)
      .toContain('modal-field__display--multiline');
    expect(getFieldByLabel('General Notes').querySelector('.modal-field__value').classList)
      .toContain('modal-field__display--multiline');
    expect(getFieldByLabel('Responsibilities').querySelector('.modal-field__value').textContent)
      .toBe('Line one\nLine two');
  });

  it('keeps the footer visible and draft intact when save fails', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    api.update.mockRejectedValue(new Error('server error'));

    Modal.open(application());
    editTextField('Company', 'Globex');
    saveButton().click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.textContent).toContain('Failed to save');
    expect(document.querySelector('.modal-footer').hidden).toBe(false);
    expect(getFieldByLabel('Company').querySelector('.modal-field__value').textContent).toBe('Globex');
  });

  it('discards dirty draft changes only after confirmation', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    Modal.open(application({ companyName: 'Acme' }));
    editTextField('Company', 'Globex');
    discardButton().click();
    await Promise.resolve();

    expect(ConfirmDialog.show).toHaveBeenCalledWith('Discard changes?\nYour edits will be lost.', {
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
    });
    expect(getFieldByLabel('Company').querySelector('.modal-field__value').textContent).toBe('Globex');
    expect(document.querySelector('.modal-footer').hidden).toBe(false);

    discardButton().click();
    await Promise.resolve();
    await Promise.resolve();

    expect(getFieldByLabel('Company').querySelector('.modal-field__value').textContent).toBe('Acme');
    expect(document.querySelector('.modal-footer').hidden).toBe(true);
  });

  it('clears validation errors on confirmed discard', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show.mockResolvedValue(true);

    Modal.open(application());
    editTextField('Company', '');
    saveButton().click();
    await Promise.resolve();

    expect(document.body.textContent).toContain('Company is required.');

    discardButton().click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.textContent).not.toContain('Company is required.');
    expect(getFieldByLabel('Company').querySelector('.modal-field__value').textContent).toBe('Acme');
  });

  it('does not crash if the modal closes while discard confirmation is pending', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    let resolveDiscard;
    ConfirmDialog.show.mockReturnValue(new Promise((resolve) => {
      resolveDiscard = resolve;
    }));

    Modal.open(application());
    editTextField('Company', 'Globex');
    discardButton().click();
    Modal.close();

    resolveDiscard(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('marks editable fields but leaves read-only fields non-editable', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());

    expect(getFieldByLabel('Company').classList.contains('modal-field--editable')).toBe(true);
    expect(getFieldByLabel('Required Skills').classList.contains('modal-field--editable')).toBe(true);
    expect(getFieldByLabel('Compatibility').classList.contains('modal-field--editable')).toBe(false);
    expect(getFieldByLabel('Last Updated').classList.contains('modal-field--editable')).toBe(false);
  });

  it('saves dirty drafts with Ctrl+S and no-ops when clean', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    api.update.mockResolvedValue({ ...application(), companyName: 'Globex' });

    Modal.open(application());
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    await Promise.resolve();

    expect(api.update).not.toHaveBeenCalled();

    editTextField('Company', 'Globex');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(api.update).toHaveBeenCalledWith(1, expect.objectContaining({ companyName: 'Globex' }), expect.anything());
  });

  it('formats salary as Philippine Peso', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ salary: 150000 }));

    expect(document.body.textContent).toContain(formatPeso(150000));
  });

  it('renders placeholder salary text for absent salary values', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ salary: null }));

    expect(getSalaryFieldValue().textContent).toBe('\u2014');
  });

  it('toggles favorite through PATCH and updates the quick action state', async () => {
    const onApplicationUpdate = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    api.update.mockResolvedValue({ ...application(), fav: true });

    Modal.open(application(), { onApplicationUpdate });
    document.querySelector('.modal-quick-action--favorite').click();
    await Promise.resolve();

    expect(api.update).toHaveBeenCalledWith(1, { fav: true });
    expect(document.querySelector('.modal-quick-action--favorite svg.icon')).not.toBeNull();
    expect(document.querySelector('.modal-quick-action--favorite .modal-quick-action__label')).toBeNull();
    expect(onApplicationUpdate).toHaveBeenCalledWith(expect.objectContaining({ fav: true }));
  });

  it('routes modal status changes through the draft without PATCH', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ status: 'wishlisted' }));
    document.querySelector('.modal-quick-action--status').click();
    document.querySelector('[data-status="applied"]').click();

    expect(api.update).not.toHaveBeenCalled();
    expect(document.querySelector('#modal-status-badge').textContent).toBe(STATUS_CONFIG.applied.label);
    expect(document.querySelector('.modal-header').style.backgroundColor)
      .toBe(hexToRgb(STATUS_CONFIG.applied.borderAccent));
  });

  it('opens the status dropdown from the status badge without PATCH', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ status: 'wishlisted' }));
    document.querySelector('#modal-status-badge').click();
    document.querySelector('[data-status="interview"]').click();

    expect(api.update).not.toHaveBeenCalled();
    expect(document.querySelector('#modal-status-badge').textContent).toBe(STATUS_CONFIG.interview.label);
  });

  it('archives only after confirmation and reports the updated record', async () => {
    const onArchiveSuccess = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    api.archive.mockResolvedValue({ ...application(), archived: true, fav: false });

    Modal.open(application(), { onArchiveSuccess });
    document.querySelector('.modal-quick-action--archive').click();
    await Promise.resolve();

    expect(api.archive).not.toHaveBeenCalled();
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();

    document.querySelector('.modal-quick-action--archive').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.archive).toHaveBeenCalledWith(1);
    expect(onArchiveSuccess).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('keeps the overlay open and shows an error when archive fails', async () => {
    const onArchiveSuccess = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show.mockResolvedValue(true);
    api.archive.mockRejectedValue(new Error('server error'));

    Modal.open(application(), { onArchiveSuccess });
    document.querySelector('.modal-quick-action--archive').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.archive).toHaveBeenCalledWith(1);
    expect(onArchiveSuccess).not.toHaveBeenCalled();
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();
    expect(document.body.textContent).toContain('Archive failed');
  });

  it('copies populated job links and omits the copy action for empty link fields', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    Modal.open(application({ jobPostingUrl: 'https://example.com/job' }));
    document.querySelector('button[aria-label="Copy job posting URL"]').click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('https://example.com/job');
    expect(document.body.textContent).toContain('Link copied');

    Modal.open(application({ jobPostingUrl: '' }));

    expect(document.querySelector('button[aria-label="Copy job posting URL"]')).toBeNull();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('Could not copy link');
  });

  it('copies the current draft job link value', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const writeText = vi.fn().mockResolvedValue();
    const record = application({ jobPostingUrl: 'https://example.com/original' });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    Modal.open(record);
    record.jobPostingUrl = 'https://example.com/stale-source';
    document.querySelector('button[aria-label="Copy job posting URL"]').click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('https://example.com/original');
  });

  it('shows an error toast when clipboard copy fails', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
    });

    Modal.open(application({ jobPostingUrl: 'https://example.com/job' }));
    document.querySelector('button[aria-label="Copy job posting URL"]').click();
    await Promise.resolve();

    expect(document.body.textContent).toContain('Could not copy link');
  });
});
