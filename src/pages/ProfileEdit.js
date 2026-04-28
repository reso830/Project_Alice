import { getProfile, saveProfile } from '../services/api.js';

let _container = null;
let _header = null;
let _navbar = null;
let _previousNavbarDisplay = '';
let _profile = null;

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

function createField(label, value = '', multiline = false) {
  const wrapper = createElement('label', 'edit-field');
  const labelEl = createElement('span', 'edit-field__label', label);
  const input = document.createElement(multiline ? 'textarea' : 'input');
  const error = createElement('span', 'field-error');

  input.className = 'edit-field__control';
  input.value = value ?? '';
  if (multiline) {
    input.rows = 5;
  } else {
    input.type = 'text';
  }
  error.hidden = true;
  wrapper.append(labelEl, input, error);

  return { wrapper, input, error };
}

function setFieldError(field, message) {
  field.error.textContent = message;
  field.error.hidden = !message;
}

function clearFieldErrors(fields) {
  for (const field of fields) {
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

function createActions(onCancel, onSave) {
  const actions = createElement('div', 'edit-card__actions');
  const feedback = createElement('span', 'edit-card__feedback');
  const cancelButton = createButton('Cancel', 'profile-btn profile-btn--outline', onCancel);
  const saveButton = createButton('Save', 'profile-btn profile-btn--primary', onSave);

  actions.append(
    feedback,
    cancelButton,
    saveButton,
  );

  return { actions, feedback, saveButton };
}

function currentProfile() {
  return _profile ?? {};
}

function applyProfile(profile) {
  _profile = profile ?? null;
}

async function refreshProfile() {
  try {
    applyProfile(await getProfile());
    return { ok: true, profile: currentProfile() };
  } catch {
    return { ok: false, profile: currentProfile() };
  }
}

function renderTopbar(navigate) {
  const header = createElement('header', 'profile-edit-nav');
  const back = createButton('\u2190 Back to Profile', 'profile-edit-nav__back', () => navigate('profile'));
  const title = createElement('span', 'profile-edit-nav__title', 'Edit Profile');

  header.append(back, title);
  document.body.insertBefore(header, document.querySelector('#app'));
  _header = header;
}

function hideNavbar() {
  _navbar = document.querySelector('.navbar');
  if (!_navbar) {
    return;
  }

  _previousNavbarDisplay = _navbar.style.display;
  _navbar.style.display = 'none';
}

function renderBasicInfoCard(page) {
  const { card, body } = createEditCard('BASIC INFO');
  const profile = currentProfile();
  const firstName = createField('First Name', profile.firstName);
  const lastName = createField('Last Name', profile.lastName);
  const city = createField('City/Location', profile.city);
  const email = createField('Email', profile.email);
  const phone = createField('Phone', profile.phone);
  const fields = [firstName, lastName, city, email, phone];

  function reset() {
    const latest = currentProfile();

    firstName.input.value = latest.firstName ?? '';
    lastName.input.value = latest.lastName ?? '';
    city.input.value = latest.city ?? '';
    email.input.value = latest.email ?? '';
    phone.input.value = latest.phone ?? '';
    clearFieldErrors(fields);
  }

  const { actions, feedback, saveButton } = createActions(reset, async () => {
    if (saveButton.disabled) {
      return;
    }

    saveButton.disabled = true;

    try {
      clearFieldErrors(fields);
      feedback.textContent = '';

      const latest = await refreshProfile();

      if (!latest.ok) {
        feedback.textContent = 'Unable to reach server. Please try again.';
        return;
      }

      const merged = {
        ...latest.profile,
        firstName: firstName.input.value,
        lastName: lastName.input.value,
        city: city.input.value,
        email: email.input.value,
        phone: phone.input.value,
      };
      const result = await saveProfile(merged).then(
        (saved) => ({ ok: true, saved }),
        (error) => ({ ok: false, errors: error.fields ?? {} }),
      );

      if (!result.ok) {
        setFieldError(firstName, result.errors.firstName ?? '');
        setFieldError(lastName, result.errors.lastName ?? '');
        setFieldError(email, result.errors.email ?? '');
        return;
      }

      applyProfile(result.saved);
      reset();
      feedback.textContent = 'Saved.';
    } finally {
      saveButton.disabled = false;
    }
  });

  body.append(...fields.map((field) => field.wrapper), actions);
  page.append(card);
}

function renderSummaryCard(page) {
  const { card, body } = createEditCard('SUMMARY');
  const summary = createField('Summary', currentProfile().summary, true);

  function reset() {
    summary.input.value = currentProfile().summary ?? '';
  }

  const { actions, feedback, saveButton } = createActions(reset, async () => {
    if (saveButton.disabled) {
      return;
    }

    saveButton.disabled = true;

    try {
      feedback.textContent = '';

      const latest = await refreshProfile();

      if (!latest.ok) {
        feedback.textContent = 'Unable to reach server. Please try again.';
        return;
      }

      const merged = {
        ...latest.profile,
        summary: summary.input.value,
      };
      const result = await saveProfile(merged).then(
        (saved) => ({ ok: true, saved }),
        (error) => ({ ok: false, message: error.message ?? 'Unable to save summary.' }),
      );

      if (!result.ok) {
        feedback.textContent = result.message;
        return;
      }

      applyProfile(result.saved);
      reset();
      feedback.textContent = 'Saved.';
    } finally {
      saveButton.disabled = false;
    }
  });

  body.append(summary.wrapper, actions);
  page.append(card);
}

function renderTextCard(page, title, fieldName) {
  const { card, body } = createEditCard(title);
  const values = currentProfile()[fieldName];
  const field = createField(title, Array.isArray(values) ? values.join(', ') : '');

  function reset() {
    const latest = currentProfile()[fieldName];

    field.input.value = Array.isArray(latest) ? latest.join(', ') : '';
  }

  const { actions, feedback } = createActions(reset, () => {
    feedback.textContent = 'Not saved in this iteration.';
  });

  body.append(field.wrapper, actions);
  page.append(card);
}

function renderPlaceholderCard(page, title) {
  const { card, body } = createEditCard(title);
  const placeholder = createElement('p', 'edit-placeholder', 'Placeholder content for a later iteration.');
  const { actions, feedback } = createActions(() => {
    feedback.textContent = '';
  }, () => {
    feedback.textContent = 'Not saved in this iteration.';
  });

  body.append(placeholder, actions);
  page.append(card);
}

function renderEditPage(container) {
  const page = createElement('div', 'profile-edit-page');
  const notice = createElement('div', 'edit-notice', 'This page is a placeholder \u2014 details to be designed in a later iteration.');

  page.append(notice);
  renderBasicInfoCard(page);
  renderSummaryCard(page);
  renderTextCard(page, 'SKILLS', 'skills');
  renderTextCard(page, 'LANGUAGES', 'languages');

  for (const title of ['PROFESSIONAL EXPERIENCE', 'EDUCATION', 'CERTIFICATIONS', 'AWARDS', 'LINKS']) {
    renderPlaceholderCard(page, title);
  }

  container.replaceChildren(page);
}

export async function mount(container, { navigate } = {}) {
  const safeNavigate = typeof navigate === 'function' ? navigate : () => {};

  _container = container;
  hideNavbar();
  renderTopbar(safeNavigate);
  container.replaceChildren(createElement('div', 'profile-loading', 'Loading profile...'));
  await refreshProfile();

  if (_container === container) {
    renderEditPage(container);
  }
}

export function unmount() {
  _header?.remove();
  _header = null;

  if (_navbar) {
    _navbar.style.display = _previousNavbarDisplay;
  }
  _navbar = null;
  _previousNavbarDisplay = '';

  _container?.replaceChildren();
  _container = null;
}

export const ProfileEdit = { mount, unmount };
