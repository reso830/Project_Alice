import { Toast } from '../components/Toast.js';
import { normaliseProfile, validateProfile } from '../models/profile.js';
import { getProfile, saveProfile } from '../services/api.js';
import { sortEducation, sortExperience } from '../utils/sort.js';
import { validateMonthYear, validateRequired, validateUrl } from '../utils/validate.js';

const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Professional', 'Fluent'];

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

function createSelectField(label, options, value = '') {
  const wrapper = createElement('label', 'edit-field');
  const labelEl = createElement('span', 'edit-field__label', label);
  const select = document.createElement('select');
  const error = createElement('span', 'field-error');
  const placeholder = document.createElement('option');

  select.className = 'edit-field__control';
  placeholder.value = '';
  placeholder.textContent = 'Select';
  select.append(placeholder);

  for (const optionValue of options) {
    const option = document.createElement('option');

    option.value = optionValue;
    option.textContent = optionValue;
    select.append(option);
  }

  select.value = value;
  error.hidden = true;
  wrapper.append(labelEl, select, error);

  return { wrapper, input: select, error };
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

function removeOpenFormError() {
  document.querySelector('.open-form-error')?.remove();
}

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function commitListChange() {
  removeOpenFormError();
  updateControlsState();
}

function canOpenInlineForm() {
  return !hasOpenInlineForm();
}

function createEntryRow(parts, onRemove) {
  const row = createElement('div', 'entry-row');
  const text = createElement('span', 'entry-row__text', parts.filter(Boolean).join(' | '));
  const remove = createButton('Remove', 'entry-row__remove', onRemove);

  row.append(text, remove);

  return row;
}

function appendAddButton(body, label, onClick) {
  body.append(createButton(label, 'profile-btn profile-btn--outline', () => {
    if (!canOpenInlineForm()) {
      return;
    }

    onClick();
  }));
}

function validateFields(rules) {
  let valid = true;

  for (const { field, validators } of rules) {
    const message = validators
      .map((validator) => validator(field.input.value))
      .find(Boolean) ?? '';

    setFieldError(field, message);

    if (message) {
      valid = false;
    }
  }

  return valid;
}

function optionalMonthYear(value) {
  return value.trim() ? validateMonthYear(value) : null;
}

function getLinkLabel(url, friendlyName = '') {
  if (friendlyName) {
    return friendlyName;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
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

function renderSkillsCard(page) {
  const { card, body } = createEditCard('SKILLS');
  const inputRow = createElement('div', 'skills-input-row');
  const input = document.createElement('input');
  const add = createButton('Add', 'profile-btn profile-btn--outline', () => {
    const skill = normalizeWhitespace(input.value);

    if (validateRequired(skill)) {
      return;
    }

    if (!_formState.skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) {
      _formState.skills.push(skill);
      commitListChange();
      render();
    }

    input.value = '';
  });

  input.type = 'text';
  input.className = 'edit-field__control';
  input.setAttribute('aria-label', 'Skill');
  inputRow.append(input, add);

  function render() {
    const pills = createElement('div', 'skills-pills-wrap');

    body.replaceChildren();

    for (const skill of _formState.skills) {
      const pill = createElement('span', 'skill-pill');
      const remove = createButton('x', 'skill-pill__remove', () => {
        _formState.skills = _formState.skills.filter((existing) => existing !== skill);
        commitListChange();
        render();
      });

      pill.append(createElement('span', null, skill), remove);
      pills.append(pill);
    }

    body.append(pills, inputRow);
  }

  render();
  page.append(card);
}

function renderLanguagesCard(page) {
  const { card, body } = createEditCard('LANGUAGES');
  let isAddingLanguage = false;

  function render() {
    body.replaceChildren();

    _formState.languages.forEach((entry, index) => {
      body.append(createEntryRow([entry.language, entry.proficiency], () => {
        _formState.languages.splice(index, 1);
        commitListChange();
        render();
      }));
    });

    if (!isAddingLanguage) {
      appendAddButton(body, 'Add Language', () => {
        isAddingLanguage = true;
        render();
      });
      return;
    }

    const form = createElement('div', 'inline-entry-form');
    const language = createField('Language');
    const proficiency = createSelectField('Proficiency', PROFICIENCY_LEVELS);
    const actions = createElement('div', 'inline-entry-form__actions');
    const add = createButton('Add', 'profile-btn profile-btn--primary', () => {
      if (!validateFields([
        { field: language, validators: [validateRequired] },
        { field: proficiency, validators: [validateRequired] },
      ])) {
        return;
      }

      _formState.languages.push({
        language: normalizeWhitespace(language.input.value),
        proficiency: proficiency.input.value,
      });
      isAddingLanguage = false;
      commitListChange();
      render();
    });
    const cancel = createButton('Cancel', 'profile-btn profile-btn--outline', () => {
      isAddingLanguage = false;
      removeOpenFormError();
      render();
    });

    actions.append(cancel, add);
    form.append(language.wrapper, proficiency.wrapper, actions);
    body.append(form);
  }

  render();
  page.append(card);
}

function renderCertificationsCard(page) {
  const { card, body } = createEditCard('CERTIFICATIONS');
  let isAddingCertification = false;

  function render() {
    body.replaceChildren();

    _formState.certifications.forEach((entry, index) => {
      body.append(createEntryRow([entry.name, entry.issuanceDate], () => {
        _formState.certifications.splice(index, 1);
        commitListChange();
        render();
      }));
    });

    if (!isAddingCertification) {
      appendAddButton(body, 'Add Certification', () => {
        isAddingCertification = true;
        render();
      });
      return;
    }

    const form = createElement('div', 'inline-entry-form');
    const name = createField('Certification Name');
    const issuingBody = createField('Issuing Body');
    const certificateId = createField('Certificate ID');
    const issuanceDate = createField('Issuance Date');
    const expiryDate = createField('Expiry Date');
    const actions = createElement('div', 'inline-entry-form__actions');
    const add = createButton('Add', 'profile-btn profile-btn--primary', () => {
      if (!validateFields([
        { field: name, validators: [validateRequired] },
        { field: issuanceDate, validators: [validateRequired, validateMonthYear] },
        { field: expiryDate, validators: [optionalMonthYear] },
      ])) {
        return;
      }

      _formState.certifications.push({
        name: normalizeWhitespace(name.input.value),
        issuingBody: normalizeWhitespace(issuingBody.input.value),
        certificateId: normalizeWhitespace(certificateId.input.value),
        issuanceDate: issuanceDate.input.value.trim(),
        expiryDate: expiryDate.input.value.trim(),
      });
      isAddingCertification = false;
      commitListChange();
      render();
    });
    const cancel = createButton('Cancel', 'profile-btn profile-btn--outline', () => {
      isAddingCertification = false;
      removeOpenFormError();
      render();
    });

    actions.append(cancel, add);
    form.append(name.wrapper, issuingBody.wrapper, certificateId.wrapper, issuanceDate.wrapper, expiryDate.wrapper, actions);
    body.append(form);
  }

  render();
  page.append(card);
}

function renderEducationCard(page) {
  const { card, body } = createEditCard('EDUCATION');
  let isAddingEducation = false;

  function render() {
    body.replaceChildren();

    for (const entry of sortEducation(_formState.education)) {
      body.append(createEntryRow([entry.degreeMajor, entry.university, entry.yearCompleted], () => {
        const index = _formState.education.indexOf(entry);

        _formState.education.splice(index, 1);
        commitListChange();
        render();
      }));
    }

    if (!isAddingEducation) {
      appendAddButton(body, 'Add Education', () => {
        isAddingEducation = true;
        render();
      });
      return;
    }

    const form = createElement('div', 'inline-entry-form');
    const degreeMajor = createField('Degree & Major');
    const university = createField('University');
    const yearCompleted = createField('Year Completed');
    const actions = createElement('div', 'inline-entry-form__actions');
    const add = createButton('Add', 'profile-btn profile-btn--primary', () => {
      if (!validateFields([
        { field: degreeMajor, validators: [validateRequired] },
        { field: university, validators: [validateRequired] },
        { field: yearCompleted, validators: [validateRequired] },
      ])) {
        return;
      }

      _formState.education = sortEducation([..._formState.education, {
        degreeMajor: normalizeWhitespace(degreeMajor.input.value),
        university: normalizeWhitespace(university.input.value),
        yearCompleted: normalizeWhitespace(yearCompleted.input.value),
      }]);
      isAddingEducation = false;
      commitListChange();
      render();
    });
    const cancel = createButton('Cancel', 'profile-btn profile-btn--outline', () => {
      isAddingEducation = false;
      removeOpenFormError();
      render();
    });

    actions.append(cancel, add);
    form.append(degreeMajor.wrapper, university.wrapper, yearCompleted.wrapper, actions);
    body.append(form);
  }

  render();
  page.append(card);
}

function renderExperienceCard(page) {
  const { card, body } = createEditCard('PROFESSIONAL EXPERIENCE');
  let isAddingExperience = false;

  function render() {
    body.replaceChildren();

    for (const entry of sortExperience(_formState.experience)) {
      const endDate = entry.currentWork ? 'Present' : entry.dateEnded;

      body.append(createEntryRow([entry.role, entry.company, [entry.dateStarted, endDate].filter(Boolean).join('-')], () => {
        const index = _formState.experience.indexOf(entry);

        _formState.experience.splice(index, 1);
        commitListChange();
        render();
      }));
    }

    if (!isAddingExperience) {
      appendAddButton(body, 'Add Experience', () => {
        isAddingExperience = true;
        render();
      });
      return;
    }

    const form = createElement('div', 'inline-entry-form');
    const role = createField('Role');
    const company = createField('Company');
    const responsibilities = createField('Responsibilities', '', true);
    const dateStarted = createField('Date Started');
    const dateEnded = createField('Date Ended');
    const currentWorkWrapper = createElement('label', 'edit-field');
    const currentWorkLabel = createElement('span', 'edit-field__label', 'Current Work');
    const currentWork = document.createElement('input');
    const actions = createElement('div', 'inline-entry-form__actions');

    currentWork.type = 'checkbox';
    currentWork.className = 'edit-field__checkbox';
    currentWorkWrapper.append(currentWorkLabel, currentWork);

    function syncDateEnded() {
      dateEnded.wrapper.hidden = currentWork.checked;
    }

    currentWork.addEventListener('change', syncDateEnded);
    syncDateEnded();

    const add = createButton('Add', 'profile-btn profile-btn--primary', () => {
      const rules = [
        { field: role, validators: [validateRequired] },
        { field: company, validators: [validateRequired] },
        { field: responsibilities, validators: [validateRequired] },
        { field: dateStarted, validators: [validateRequired, validateMonthYear] },
      ];

      if (!currentWork.checked) {
        rules.push({ field: dateEnded, validators: [validateRequired, validateMonthYear] });
      } else {
        setFieldError(dateEnded, '');
      }

      if (!validateFields(rules)) {
        return;
      }

      _formState.experience = sortExperience([..._formState.experience, {
        role: normalizeWhitespace(role.input.value),
        company: normalizeWhitespace(company.input.value),
        responsibilities: responsibilities.input.value.trim(),
        dateStarted: dateStarted.input.value.trim(),
        dateEnded: currentWork.checked ? '' : dateEnded.input.value.trim(),
        currentWork: currentWork.checked,
      }]);
      isAddingExperience = false;
      commitListChange();
      render();
    });
    const cancel = createButton('Cancel', 'profile-btn profile-btn--outline', () => {
      isAddingExperience = false;
      removeOpenFormError();
      render();
    });

    actions.append(cancel, add);
    form.append(
      role.wrapper,
      company.wrapper,
      responsibilities.wrapper,
      dateStarted.wrapper,
      currentWorkWrapper,
      dateEnded.wrapper,
      actions,
    );
    body.append(form);
  }

  render();
  page.append(card);
}

function renderLinksCard(page) {
  const { card, body } = createEditCard('LINKS');
  let isAddingLink = false;

  function render() {
    body.replaceChildren();

    _formState.links.forEach((entry, index) => {
      const row = createElement('div', 'entry-row');
      const anchor = document.createElement('a');
      const remove = createButton('Remove', 'entry-row__remove', () => {
        _formState.links.splice(index, 1);
        commitListChange();
        render();
      });

      anchor.href = entry.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = getLinkLabel(entry.url, entry.friendlyName);
      row.append(anchor, remove);
      body.append(row);
    });

    if (!isAddingLink) {
      appendAddButton(body, 'Add Link', () => {
        isAddingLink = true;
        render();
      });
      return;
    }

    const form = createElement('div', 'inline-entry-form');
    const url = createField('Link URL');
    const friendlyName = createField('Friendly Name');
    const actions = createElement('div', 'inline-entry-form__actions');
    const add = createButton('Add', 'profile-btn profile-btn--primary', () => {
      if (!validateFields([
        { field: url, validators: [validateRequired, validateUrl] },
      ])) {
        return;
      }

      _formState.links.push({
        url: url.input.value.trim(),
        friendlyName: normalizeWhitespace(friendlyName.input.value),
      });
      isAddingLink = false;
      commitListChange();
      render();
    });
    const cancel = createButton('Cancel', 'profile-btn profile-btn--outline', () => {
      isAddingLink = false;
      removeOpenFormError();
      render();
    });

    actions.append(cancel, add);
    form.append(url.wrapper, friendlyName.wrapper, actions);
    body.append(form);
  }

  render();
  page.append(card);
}

function renderAwardsCard(page) {
  const { card, body } = createEditCard('AWARDS');
  let isAddingAward = false;

  function render() {
    body.replaceChildren();

    _formState.awards.forEach((entry, index) => {
      body.append(createEntryRow([entry.awardName, entry.issuingBody], () => {
        _formState.awards.splice(index, 1);
        commitListChange();
        render();
      }));
    });

    if (!isAddingAward) {
      appendAddButton(body, 'Add Award', () => {
        isAddingAward = true;
        render();
      });
      return;
    }

    const form = createElement('div', 'inline-entry-form');
    const awardName = createField('Award Name');
    const issuingBody = createField('Issuing Body');
    const details = createField('Details', '', true);
    const date = createField('Date');
    const actions = createElement('div', 'inline-entry-form__actions');
    const add = createButton('Add', 'profile-btn profile-btn--primary', () => {
      if (!validateFields([
        { field: awardName, validators: [validateRequired] },
        { field: issuingBody, validators: [validateRequired] },
        { field: date, validators: [optionalMonthYear] },
      ])) {
        return;
      }

      _formState.awards.push({
        awardName: normalizeWhitespace(awardName.input.value),
        issuingBody: normalizeWhitespace(issuingBody.input.value),
        details: details.input.value.trim(),
        date: date.input.value.trim(),
      });
      isAddingAward = false;
      commitListChange();
      render();
    });
    const cancel = createButton('Cancel', 'profile-btn profile-btn--outline', () => {
      isAddingAward = false;
      removeOpenFormError();
      render();
    });

    actions.append(cancel, add);
    form.append(awardName.wrapper, issuingBody.wrapper, details.wrapper, date.wrapper, actions);
    body.append(form);
  }

  render();
  page.append(card);
}

function renderEditPage(container) {
  const page = createElement('div', 'profile-edit-page');

  page.append(renderPageControls());
  renderBasicInfoCard(page);
  renderSummaryCard(page);
  renderSkillsCard(page);
  renderLanguagesCard(page);
  renderCertificationsCard(page);
  renderEducationCard(page);
  renderExperienceCard(page);
  renderLinksCard(page);
  renderAwardsCard(page);

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

  removeOpenFormError();

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
