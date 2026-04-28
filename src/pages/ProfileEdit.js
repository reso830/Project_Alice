import { Toast } from '../components/Toast.js';
import { normaliseProfile, validateProfile } from '../models/profile.js';
import { getProfile, saveProfile } from '../services/api.js';

let _container = null;
let _navigate = () => {};
let _subheader = null;
let _formState = null;
let _initialState = null;
let _saving = false;
let _basicInfoFields = {};
let _discardKeyHandler = null;

function createElement(tag, className, text) {
  const el = document.createElement(tag);

  if (className) {
    el.className = className;
  }

  if (text !== undefined) {
    el.textContent = text;
  }

  return el;
}

function createButton(label, className, onClick) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);

  return button;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isDirty() {
  return JSON.stringify(_formState) !== JSON.stringify(_initialState);
}

function updateControlsState() {
  const dirty = isDirty();

  for (const button of document.querySelectorAll('.page-controls__save')) {
    button.disabled = !dirty || _saving;
    if (!_saving) {
      button.textContent = 'Save';
    }
  }
}

function createField(label, value = '', multiline = false) {
  const wrapper = createElement('label', 'edit-field');
  const labelEl = createElement('span', 'edit-field__label', label);
  const input = document.createElement(multiline ? 'textarea' : 'input');
  const error = createElement('span', 'field-error');

  input.className = 'edit-field__control';
  input.value = value ?? '';
  if (multiline) {
    input.rows = 6;
  } else {
    input.type = 'text';
  }
  error.hidden = true;
  wrapper.append(labelEl, input, error);

  return { wrapper, input, error };
}

function setFieldError(field, message) {
  if (!field) {
    return;
  }

  field.error.textContent = message;
  field.error.hidden = !message;
}

function clearBasicInfoErrors() {
  for (const field of Object.values(_basicInfoFields)) {
    setFieldError(field, '');
  }
}

function createEditCard(title) {
  const card = createElement('section', 'section-card edit-card');
  const header = createElement('div', 'section-card__header');
  const label = createElement('div', 'section-label', title);
  const body = createElement('div', 'edit-card__body');

  header.append(label);
  card.append(header, body);

  return { card, body };
}

function createPlaceholderCard(title) {
  const { card, body } = createEditCard(title);

  body.append(createElement('p', 'edit-placeholder', 'This section will be editable in a later phase.'));

  return card;
}

function updateField(fieldName, value) {
  _formState[fieldName] = value;
  clearBasicInfoErrors();
  updateControlsState();
}

function hasOpenInlineForm() {
  return document.querySelector('.inline-entry-form') !== null;
}

function renderOpenFormError() {
  const topControls = document.querySelector('.page-controls');
  const err = createElement('p', 'open-form-error', 'Please finish or cancel the open form before saving.');

  topControls?.after(err);
}

function renderSubheader() {
  const navbar = document.querySelector('.navbar');
  const bar = createElement('div', 'profile-edit-subheader');
  const back = createButton('\u2190 Profile', 'profile-edit-subheader__back', handleCancel);
  const title = createElement('span', 'profile-edit-subheader__title', 'Edit Profile');

  bar.append(back, title);

  if (navbar) {
    navbar.insertAdjacentElement('afterend', bar);
  } else {
    document.body.insertBefore(bar, document.querySelector('#app'));
  }

  _subheader = bar;
}

function renderPageControls() {
  const controls = createElement('div', 'page-controls');
  const cancel = createButton('Cancel', 'profile-btn profile-btn--outline page-controls__cancel', handleCancel);
  const save = createButton('Save', 'profile-btn profile-btn--primary page-controls__save', handleSave);

  save.disabled = true;
  controls.append(cancel, save);

  return controls;
}

function renderBasicInfoCard(page) {
  const { card, body } = createEditCard('BASIC INFO');
  const grid = createElement('div', 'edit-fields-grid');
  const firstName = createField('First Name', _formState.firstName);
  const lastName = createField('Last Name', _formState.lastName);
  const city = createField('City/Location', _formState.city);
  const email = createField('Email', _formState.email);
  const phone = createField('Phone', _formState.phone);

  city.wrapper.classList.add('edit-field--full');
  _basicInfoFields = { firstName, lastName, city, email, phone };

  for (const [fieldName, field] of Object.entries(_basicInfoFields)) {
    field.input.addEventListener('input', () => updateField(fieldName, field.input.value));
  }

  grid.append(firstName.wrapper, lastName.wrapper, city.wrapper, email.wrapper, phone.wrapper);
  body.append(grid);
  page.append(card);
}

function renderSummaryCard(page) {
  const { card, body } = createEditCard('SUMMARY');
  const summary = createField('Summary', _formState.summary, true);

  summary.input.addEventListener('input', () => updateField('summary', summary.input.value));
  body.append(summary.wrapper);
  page.append(card);
}

function renderEditPage(container) {
  const page = createElement('div', 'profile-edit-page');

  page.append(renderPageControls());
  renderBasicInfoCard(page);
  renderSummaryCard(page);

  for (const title of ['SKILLS', 'LANGUAGES', 'PROFESSIONAL EXPERIENCE', 'EDUCATION', 'CERTIFICATIONS', 'AWARDS', 'LINKS']) {
    page.append(createPlaceholderCard(title));
  }

  page.append(renderPageControls());
  container.replaceChildren(page);
  updateControlsState();
}

function surfaceValidationErrors(errors) {
  clearBasicInfoErrors();
  setFieldError(_basicInfoFields.firstName, errors.firstName ?? '');
  setFieldError(_basicInfoFields.lastName, errors.lastName ?? '');
}

async function handleSave() {
  if (!isDirty() || _saving) {
    return;
  }

  document.querySelector('.open-form-error')?.remove();

  if (hasOpenInlineForm()) {
    renderOpenFormError();
    return;
  }

  const validation = validateProfile(_formState);

  if (!validation.valid) {
    surfaceValidationErrors(validation.errors);
    return;
  }

  _saving = true;
  for (const button of document.querySelectorAll('.page-controls__save')) {
    button.disabled = true;
    button.textContent = 'Saving…';
  }

  try {
    await saveProfile(_formState);
    _initialState = deepClone(_formState);
    updateControlsState();
    _navigate('profile');
    Toast.show('Profile saved.', 'success');
  } catch {
    Toast.show('Could not save profile. Please try again.', 'error');
  } finally {
    _saving = false;
    for (const button of document.querySelectorAll('.page-controls__save')) {
      button.textContent = 'Save';
    }
    updateControlsState();
  }
}

function handleCancel() {
  if (!isDirty()) {
    _navigate('profile');
    return;
  }

  showDiscardModal();
}

function closeDiscardModal(backdrop) {
  if (_discardKeyHandler) {
    document.removeEventListener('keydown', _discardKeyHandler);
    _discardKeyHandler = null;
  }

  document.body.style.overflow = '';
  backdrop?.remove();
}

function showDiscardModal() {
  if (document.querySelector('.confirm-backdrop')) {
    return;
  }

  const backdrop = createElement('div', 'confirm-backdrop');
  const modal = createElement('div', 'confirm-modal');
  const title = createElement('h2', 'confirm-modal__title', 'Discard changes?');
  const body = createElement('p', 'confirm-modal__body', 'Your edits will be lost.');
  const actions = createElement('div', 'confirm-modal__actions');
  const keepEditing = createButton('Keep Editing', 'profile-btn profile-btn--outline', () => closeDiscardModal(backdrop));
  const discard = createButton('Discard', 'profile-btn profile-btn--primary', () => {
    closeDiscardModal(backdrop);
    _navigate('profile');
    Toast.show('Edits discarded.', 'success');
  });

  actions.append(keepEditing, discard);
  modal.append(title, body, actions);
  backdrop.append(modal);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeDiscardModal(backdrop);
    }
  });

  _discardKeyHandler = (event) => {
    if (event.key === 'Escape') {
      closeDiscardModal(backdrop);
    }
  };
  document.addEventListener('keydown', _discardKeyHandler);
  document.body.style.overflow = 'hidden';
  document.body.append(backdrop);
}

export async function mount(container, { navigate } = {}) {
  _container = container;
  _navigate = typeof navigate === 'function' ? navigate : () => {};
  container.replaceChildren(createElement('div', 'profile-loading', 'Loading profile...'));

  const profile = await getProfile().catch(() => null);

  if (_container !== container) {
    return;
  }

  _formState = deepClone(normaliseProfile(profile ?? {}));
  _initialState = deepClone(_formState);
  renderSubheader();
  renderEditPage(container);
}

export function unmount() {
  document.querySelector('.confirm-backdrop')?.remove();
  if (_discardKeyHandler) {
    document.removeEventListener('keydown', _discardKeyHandler);
    _discardKeyHandler = null;
  }
  document.body.style.overflow = '';

  _subheader?.remove();
  _subheader = null;

  _container?.replaceChildren();
  _container = null;
  _navigate = () => {};
  _formState = null;
  _initialState = null;
  _saving = false;
  _basicInfoFields = {};
}

export const ProfileEdit = { mount, unmount };
