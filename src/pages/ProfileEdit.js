import { ResumeImport } from '../components/ResumeImport.js';
import { Toast } from '../components/Toast.js';
import * as authStore from '../data/authStore.js';
import {
  getSkillLabel,
  mergeResumeData,
  normaliseProfile,
  PROFICIENCY_LEVELS,
  SKILL_FLAVOR,
  SKILL_LEVELS,
  SKILL_MAX,
  validateProfile,
} from '../models/profile.js';
import { getProfile, saveProfile } from '../services/api.js';
import { bindBusyButton } from '../utils/asyncUI.js';
import { buildProfileEditSkeleton } from '../utils/skeletons.js';
import { sortEducation, sortExperience } from '../utils/sort.js';
import { validateMonthYear, validateRequired, validateUrl, validateYear } from '../utils/validate.js';

let _container = null;
let _navigate = () => {};
let _subheader = null;
let _formState = null;
let _initialState = null;
let _saving = false;
let _basicInfoFields = {};
let _discardKeyHandler = null;
let _discardAction = null;
let _openOverlay = null;
let _beforeUnloadHandler = null;
let _highlightImport = false;
let _importDone = false;
let _importArea = null;
let _mountGeneration = 0;
let _saveBindings = [];
let _skillPopoverCleanup = [];

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

function createButton(label, className, onClick, ariaLabel = '') {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = className;
  button.textContent = label;
  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel);
  }
  button.addEventListener('click', onClick);

  return button;
}

function createSvgIcon(pathData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);

  return svg;
}

function createIconButton(icon, className, onClick, ariaLabel) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', ariaLabel);
  button.append(icon);
  button.addEventListener('click', onClick);

  return button;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isDirty() {
  return JSON.stringify(_formState) !== JSON.stringify(_initialState);
}

function getSkillErrors() {
  if (!_formState) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(validateProfile(_formState).errors)
      .filter(([key]) => key.startsWith('skills')),
  );
}

function hasSkillErrors() {
  return Object.keys(getSkillErrors()).length > 0;
}

function updateControlsState() {
  const dirty = isDirty();
  const skillBlocked = hasSkillErrors();

  for (const button of document.querySelectorAll('.page-controls__save')) {
    button.disabled = !dirty || _saving || skillBlocked;
    if (!_saving) {
      button.textContent = 'Save';
    }
  }
}

function setSavingControlsBusy(isSaving) {
  for (const button of document.querySelectorAll('.page-controls__save')) {
    if (isSaving) {
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
      button.textContent = 'Saving changes…';
    } else {
      button.removeAttribute('aria-busy');
      button.textContent = 'Save';
    }
  }

  for (const button of document.querySelectorAll('.page-controls__cancel')) {
    button.disabled = isSaving;
  }
}

function createField(label, value = '', multiline = false, { required = false, placeholder = '' } = {}) {
  const wrapper = createElement('label', 'edit-field');
  const labelEl = createElement('span', 'edit-field__label', label);
  const input = document.createElement(multiline ? 'textarea' : 'input');
  const error = createElement('span', 'field-error');

  if (required) {
    wrapper.classList.add('edit-field--required');
  }
  input.className = 'edit-field__control';
  input.value = value ?? '';
  input.placeholder = placeholder;
  if (multiline) {
    input.rows = 6;
  } else {
    input.type = 'text';
  }
  error.hidden = true;
  wrapper.append(labelEl, input, error);

  return { wrapper, input, error };
}

function createSelectField(label, options, value = '', { required = false } = {}) {
  const wrapper = createElement('label', 'edit-field');
  const labelEl = createElement('span', 'edit-field__label', label);
  const select = document.createElement('select');
  const error = createElement('span', 'field-error');
  const placeholder = document.createElement('option');

  if (required) {
    wrapper.classList.add('edit-field--required');
  }
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

function createEditCard(title, { onAdd, headerAction } = {}) {
  const card = createElement('section', 'section-card edit-card');
  const header = createElement('div', 'section-card__header');
  const label = createElement('div', 'section-label', title);
  const labelGroup = createElement('div', 'section-card__label-group');
  const body = createElement('div', 'edit-card__body');

  // Group the label with its inline header action (e.g. the skills "?" scale
  // popover) so the action sits beside the label, not floating in the middle.
  labelGroup.append(label);
  if (headerAction) {
    labelGroup.append(headerAction);
  }
  header.append(labelGroup);
  if (onAdd) {
    header.append(createButton('Add', 'profile-btn profile-btn--primary', onAdd));
  }
  card.append(header, body);

  return { card, body };
}

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function commitListChange() {
  updateControlsState();
}

function cleanupSkillPopovers() {
  for (const cleanup of _skillPopoverCleanup.splice(0)) {
    cleanup();
  }
}

function createStructuredEntryRow(display, { onEdit, onRemove } = {}) {
  const row = createElement('div', 'entry-row entry-row--structured');
  const content = createElement('div', 'entry-row__content');
  const actions = createElement('div', 'entry-row__actions');

  if (display.title) {
    content.append(createElement('div', 'profile-entry__title', display.title));
  }

  if (display.meta) {
    content.append(createElement('div', 'profile-entry__meta', display.meta));
  }

  if (display.desc) {
    content.append(createElement('p', 'profile-entry__desc', display.desc));
  }

  if (onEdit) {
    actions.append(createIconButton(
      createSvgIcon('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z'),
      'entry-row__edit',
      onEdit,
      'Edit entry',
    ));
  }

  actions.append(createIconButton(
    createSvgIcon('M5 5l14 14M19 5 5 19'),
    'entry-row__remove',
    onRemove,
    'Remove entry',
  ));
  row.append(content, actions);

  return row;
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

function getFormData(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [
    key,
    field.input.type === 'checkbox' ? field.input.checked : field.input.value,
  ]));
}

function getOverlayFocusable(overlay) {
  const root = overlay.querySelector('.overlay-discard-dialog') ?? overlay;

  return [...root.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true');
}

function showOverlayDiscardDialog(boxEl, { onDiscard }) {
  if (boxEl.querySelector('.overlay-discard-dialog')) {
    return;
  }

  const dialog = createElement('div', 'overlay-discard-dialog');
  const message = createElement('p', 'overlay-discard-dialog__msg', 'Discard entry changes?');
  const discard = createButton('Discard', 'profile-btn profile-btn--primary profile-btn--danger', () => {
    dialog.remove();
    onDiscard();
  });
  const keepEditing = createButton('Keep Editing', 'profile-btn profile-btn--outline', () => dialog.remove());

  dialog.append(message, discard, keepEditing);
  boxEl.append(dialog);
  discard.focus();
}

export function createEntryOverlay(title, buildForm, { onSave } = {}) {
  if (_openOverlay !== null) {
    return undefined;
  }

  const isDesktop = window.innerWidth >= 640;
  const backdrop = createElement('div', 'entry-overlay-backdrop');
  const overlay = createElement('div', isDesktop ? 'entry-modal' : 'entry-sheet');
  const container = createElement('div', isDesktop ? 'entry-modal__box' : 'entry-sheet__box');
  const header = createElement('div', 'entry-overlay__header');
  const titleEl = createElement('h2', 'entry-overlay__title', title);
  const formEl = createElement('div', 'entry-overlay__form');
  const footer = createElement('div', 'entry-overlay__footer');
  const formApi = buildForm(formEl);
  const validate = formApi?.validate ?? (() => true);
  const getData = formApi?.getData ?? (() => ({}));
  const isDirty = formApi?.isDirty ?? (() => false);
  let isClosed = false;

  function close() {
    if (isClosed) {
      return;
    }

    isClosed = true;
    document.removeEventListener('keydown', handleDocumentKeydown);
    overlay.removeEventListener('keydown', handleOverlayKeydown);
    backdrop.removeEventListener('click', handleCancel);
    backdrop.remove();
    overlay.remove();
    document.body.style.overflow = '';
    _openOverlay = null;
  }

  function handleSave() {
    if (!validate()) {
      return;
    }

    onSave?.(getData());
    close();
  }

  function handleCancel() {
    if (!isDirty()) {
      close();
      return;
    }

    showOverlayDiscardDialog(container, {
      onDiscard: () => {
        close();
        Toast.show('Changes discarded.', 'success');
      },
    });
  }

  function handleDocumentKeydown(event) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }

  function handleOverlayKeydown(event) {
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = getOverlayFocusable(overlay);

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const cancel = createButton('Cancel', 'profile-btn profile-btn--outline', handleCancel);
  const save = createButton('Save', 'profile-btn profile-btn--primary', handleSave);

  header.append(titleEl);
  footer.append(cancel, save);
  container.append(header, formEl, footer);
  overlay.append(container);
  backdrop.addEventListener('click', handleCancel);
  document.addEventListener('keydown', handleDocumentKeydown);
  overlay.addEventListener('keydown', handleOverlayKeydown);
  document.body.append(backdrop, overlay);
  document.body.style.overflow = 'hidden';

  _openOverlay = { close, isDirty };

  getOverlayFocusable(overlay)[0]?.focus();

  return _openOverlay;
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
  setFieldError(_basicInfoFields[fieldName], '');
  updateControlsState();
}

function renderSubheader() {
  const navbar = document.querySelector('.navbar');
  const bar = createElement('div', 'profile-edit-subheader');
  const title = createElement('span', 'profile-edit-subheader__title', 'Edit Profile');
  const controls = renderPageControls();

  controls.classList.add('page-controls--subheader');
  bar.append(title, controls);

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
  let saveBinding;
  const save = createButton('Save', 'profile-btn profile-btn--primary page-controls__save', () => {
    saveBinding.run().catch(() => {});
  });

  save.disabled = true;
  saveBinding = bindBusyButton({
    button: save,
    action: handleSave,
    busyLabel: 'Saving changes…',
    peers: [cancel],
    silent: true,
  });
  _saveBindings.push(saveBinding);
  controls.append(cancel, save);

  return controls;
}

function renderBasicInfoCard(page) {
  const { card, body } = createEditCard('BASIC INFO');
  const grid = createElement('div', 'edit-fields-grid');
  const firstName = createField('First Name', _formState.firstName, false, { required: true });
  const lastName = createField('Last Name', _formState.lastName, false, { required: true });
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
  cleanupSkillPopovers();

  function renderScalePopover() {
    const wrap = createElement('div', 'skill-scale');
    const trigger = createButton('?', 'skill-scale-trigger', (event) => {
      event.stopPropagation();
      popover.hidden = !popover.hidden;
    }, 'Show skill proficiency scale');
    const popover = createElement('div', 'skill-scale-popover');

    popover.hidden = true;
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Skill proficiency scale');

    for (const { level, label } of SKILL_LEVELS) {
      const item = createElement('div', 'skill-scale-popover__item');
      const swatch = createElement('span', `skill-scale-popover__swatch skill-level-${level}`);
      const text = createElement('span', 'skill-scale-popover__text');

      swatch.setAttribute('aria-hidden', 'true');
      text.append(
        createElement('strong', 'skill-scale-popover__label', label),
        createElement('span', 'skill-scale-popover__flavor', SKILL_FLAVOR[level]),
      );
      item.append(swatch, text);
      popover.append(item);
    }

    const onDocumentClick = (event) => {
      if (!wrap.contains(event.target)) {
        popover.hidden = true;
      }
    };
    const onDocumentKeydown = (event) => {
      if (event.key === 'Escape') {
        popover.hidden = true;
      }
    };

    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeydown);
    _skillPopoverCleanup.push(() => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeydown);
    });

    wrap.append(trigger, popover);
    return wrap;
  }

  // No header "Add" button — the skills card uses the inline "+ Add skill"
  // control in the body (design §5). The header carries only the "?" popover.
  const { card, body } = createEditCard('SKILLS', {
    headerAction: renderScalePopover(),
  });

  function getDuplicateIndexes() {
    const seen = new Map();
    const duplicates = new Set();

    _formState.skills.forEach((skill, index) => {
      const key = normalizeWhitespace(skill.name ?? '').toLowerCase();

      if (!key) {
        return;
      }

      if (seen.has(key)) {
        duplicates.add(seen.get(key));
        duplicates.add(index);
      } else {
        seen.set(key, index);
      }
    });

    return duplicates;
  }

  function buildFeedback(errors) {
    const messages = [];
    const missingLevels = Object.keys(errors)
      .filter((key) => key.match(/^skills\[\d+\]\.level$/)).length;

    if (missingLevels > 0) {
      messages.push(`Set a level for every skill to save · ${missingLevels} missing`);
    }

    for (const [key, message] of Object.entries(errors)) {
      if (key.endsWith('.name') || key === 'skills.duplicate' || key === 'skills.max') {
        messages.push(message);
      }
    }

    return [...new Set(messages)];
  }

  function renderLevelPicker(skill, index, errors) {
    const picker = createElement('div', 'skill-level-picker');
    const segments = createElement('div', 'skill-level-picker__segments');
    const caption = createElement('div', 'skill-level-picker__caption');

    // Paint the picker for an "effective" level — the saved level, or a hover /
    // keyboard-focus preview. Segments 1..eff fill UNIFORMLY in eff's colour
    // (e.g. hover 5 -> 1-5 purple; hover 2 on a level-4 skill -> 1-2 gold,
    // 3-4 cleared) and the caption mirrors it in the same colour (#5, #7).
    function paint(eff) {
      for (let n = 1; n <= 5; n += 1) {
        picker.classList.remove(`skill-level-${n}`);
      }
      if (eff !== null) {
        picker.classList.add(`skill-level-${eff}`);
      }
      [...segments.children].forEach((seg, i) => {
        seg.classList.toggle('is-filled', eff !== null && i + 1 <= eff);
      });
      caption.textContent = eff === null
        ? 'Tap to set a level'
        : `${eff} · ${getSkillLabel(eff)}`;
    }

    for (const { level, label } of SKILL_LEVELS) {
      const segment = createButton(String(level), 'skill-level-picker__segment', () => {
        _formState.skills[index].level = _formState.skills[index].level === level ? null : level;
        commitListChange();
        render(index, level);
      }, `${skill.name || 'Skill'}: set ${label}, level ${level} of 5`);

      segment.dataset.level = String(level);
      segment.addEventListener('mouseenter', () => paint(level));
      segments.append(segment);
    }

    segments.addEventListener('mouseleave', () => paint(skill.level));
    segments.addEventListener('focusin', (event) => {
      const focused = Number(event.target?.dataset?.level);
      if (focused) {
        paint(focused);
      }
    });
    segments.addEventListener('focusout', () => paint(skill.level));

    if (errors[`skills[${index}].level`]) {
      picker.classList.add('has-warning');
    }

    paint(skill.level);
    picker.append(segments, caption);
    return picker;
  }

  function render(focusIndex = null, focusLevel = null, selection = null) {
    const rows = createElement('div', 'skill-editor-list');
    const errors = getSkillErrors();
    const duplicateIndexes = getDuplicateIndexes();

    body.replaceChildren();

    _formState.skills.forEach((skill, index) => {
      const row = createElement('div', 'skill-editor-row');
      // Visible per-row "Skill name" labels are repetitive and break the row's
      // vertical alignment; keep the label for screen readers (sr-only via the
      // row class) and guide sighted users with a placeholder instead.
      const field = createField('Skill name', skill.name ?? '', false, { placeholder: 'Skill name' });
      const remove = createButton('×', 'skill-editor-row__remove', () => {
        _formState.skills.splice(index, 1);
        commitListChange();
        render();
      }, 'Remove skill');

      field.wrapper.classList.add('skill-editor-row__name');
      field.input.addEventListener('input', () => {
        const nextSelection = {
          end: field.input.selectionEnd,
          start: field.input.selectionStart,
        };

        _formState.skills[index].name = field.input.value;
        commitListChange();
        render(index, null, nextSelection);
      });
      if (errors[`skills[${index}].name`]) {
        setFieldError(field, errors[`skills[${index}].name`]);
      }

      if (
        errors[`skills[${index}].name`]
        || errors[`skills[${index}].level`]
        || duplicateIndexes.has(index)
      ) {
        row.classList.add('has-warning');
      }

      row.append(field.wrapper, renderLevelPicker(skill, index, errors), remove);
      rows.append(row);
    });

    body.append(rows);

    const atCap = _formState.skills.length >= SKILL_MAX;
    const add = createButton('+ Add skill', 'profile-btn profile-btn--outline skill-editor-add', () => {
      if (_formState.skills.length >= SKILL_MAX) {
        return;
      }
      _formState.skills.push({ name: '', level: null });
      commitListChange();
      render(_formState.skills.length - 1);
    });
    add.disabled = atCap;
    if (atCap) {
      add.title = `Maximum ${SKILL_MAX} skills`;
    }
    body.append(add);

    const messages = buildFeedback(errors);
    if (atCap && !errors['skills.max']) {
      // At exactly the cap there is no validation error, but the disabled Add
      // needs a visible reason — surface it in the same red feedback block as
      // the missing-info messages.
      messages.push(`Maximum ${SKILL_MAX} skills reached.`);
    }
    if (messages.length > 0) {
      const feedback = createElement('div', 'skill-editor-feedback', messages.join(' '));

      feedback.setAttribute('role', 'alert');
      body.append(feedback);
    }
    updateControlsState();

    if (focusIndex !== null) {
      const row = body.querySelectorAll('.skill-editor-row')[focusIndex];

      if (focusLevel !== null) {
        row?.querySelector(`.skill-level-picker__segment[data-level="${focusLevel}"]`)?.focus();
      } else {
        const input = row?.querySelector('input');

        input?.focus();
        if (selection && input) {
          input.setSelectionRange(selection.start, selection.end);
        }
      }
    }
  }

  render();
  page.append(card);
}

function buildLanguagesForm(formEl, initial = {}) {
  const language = createField('Language', initial.language ?? '', false, { required: true });
  const proficiency = createSelectField('Proficiency', PROFICIENCY_LEVELS, initial.proficiency ?? '', { required: true });
  const row = createElement('div', 'inline-entry-form__row inline-entry-form__row--two');
  const fields = { language, proficiency };
  const snapshot = JSON.stringify(getFormData(fields));

  row.append(language.wrapper, proficiency.wrapper);
  formEl.append(row);

  return {
    validate: () => validateFields([
      { field: language, validators: [validateRequired] },
      { field: proficiency, validators: [validateRequired] },
    ]),
    getData: () => ({
      language: normalizeWhitespace(language.input.value),
      proficiency: proficiency.input.value,
    }),
    isDirty: () => snapshot !== JSON.stringify(getFormData(fields)),
  };
}

function openEditLanguageOverlay(entry, index, onSaved) {
  createEntryOverlay('Edit Language', (el) => buildLanguagesForm(el, entry), {
    onSave: (data) => {
      _formState.languages.splice(index, 1, data);
      commitListChange();
      onSaved();
    },
  });
}

function renderLanguagesCard(page) {
  const { card, body } = createEditCard('LANGUAGES', {
    onAdd: () => createEntryOverlay('Add Language', (el) => buildLanguagesForm(el), {
      onSave: (data) => {
        _formState.languages.push(data);
        commitListChange();
        render();
      },
    }),
  });

  function render() {
    body.replaceChildren();

    _formState.languages.forEach((entry, index) => {
      body.append(createStructuredEntryRow({
        title: entry.language,
        meta: entry.proficiency,
      }, {
        onEdit: () => openEditLanguageOverlay(entry, index, render),
        onRemove: () => {
          _formState.languages.splice(index, 1);
          commitListChange();
          render();
        },
      }));
    });
  }

  render();
  page.append(card);
}

function buildCertificationsForm(formEl, initial = {}) {
  const name = createField('Certification Name', initial.name ?? '', false, { required: true });
  const issuingBody = createField('Issuing Body', initial.issuingBody ?? '', false, { required: true });
  const certificateId = createField('Certificate ID', initial.certificateId ?? '');
  const issuanceDate = createField('Issuance Date', initial.issuanceDate ?? '', false, {
    required: true,
    placeholder: 'MM/YYYY',
  });
  const expiryDate = createField('Expiry Date', initial.expiryDate ?? '', false, { placeholder: 'MM/YYYY' });
  const dateRow = createElement('div', 'inline-entry-form__row inline-entry-form__row--two');
  const fields = { name, issuingBody, certificateId, issuanceDate, expiryDate };
  const snapshot = JSON.stringify(getFormData(fields));

  dateRow.append(issuanceDate.wrapper, expiryDate.wrapper);
  formEl.append(name.wrapper, issuingBody.wrapper, certificateId.wrapper, dateRow);

  return {
    validate: () => validateFields([
      { field: name, validators: [validateRequired] },
      { field: issuingBody, validators: [validateRequired] },
      { field: issuanceDate, validators: [validateRequired, validateMonthYear] },
      { field: expiryDate, validators: [optionalMonthYear] },
    ]),
    getData: () => ({
      name: normalizeWhitespace(name.input.value),
      issuingBody: normalizeWhitespace(issuingBody.input.value),
      certificateId: normalizeWhitespace(certificateId.input.value),
      issuanceDate: issuanceDate.input.value.trim(),
      expiryDate: expiryDate.input.value.trim(),
    }),
    isDirty: () => snapshot !== JSON.stringify(getFormData(fields)),
  };
}

function openEditCertificationOverlay(entry, index, onSaved) {
  createEntryOverlay('Edit Certification', (el) => buildCertificationsForm(el, entry), {
    onSave: (data) => {
      _formState.certifications.splice(index, 1, data);
      commitListChange();
      onSaved();
    },
  });
}

function renderCertificationsCard(page) {
  const { card, body } = createEditCard('CERTIFICATIONS', {
    onAdd: () => createEntryOverlay('Add Certification', (el) => buildCertificationsForm(el), {
      onSave: (data) => {
        _formState.certifications.push(data);
        commitListChange();
        render();
      },
    }),
  });

  function render() {
    body.replaceChildren();

    _formState.certifications.forEach((entry, index) => {
      body.append(createStructuredEntryRow({
        title: entry.name,
        meta: [entry.issuingBody, entry.issuanceDate, entry.expiryDate].filter(Boolean).join(' | '),
      }, {
        onEdit: () => openEditCertificationOverlay(entry, index, render),
        onRemove: () => {
          _formState.certifications.splice(index, 1);
          commitListChange();
          render();
        },
      }));
    });
  }

  render();
  page.append(card);
}

function buildEducationForm(formEl, initial = {}) {
  const degreeMajor = createField('Degree & Major', initial.degreeMajor ?? '', false, { required: true });
  const university = createField('University', initial.university ?? '', false, { required: true });
  const yearCompleted = createField('Year Completed', initial.yearCompleted ?? '', false, {
    required: true,
    placeholder: 'YYYY',
  });
  const fields = { degreeMajor, university, yearCompleted };
  const snapshot = JSON.stringify(getFormData(fields));

  formEl.append(degreeMajor.wrapper, university.wrapper, yearCompleted.wrapper);

  return {
    validate: () => validateFields([
      { field: degreeMajor, validators: [validateRequired] },
      { field: university, validators: [validateRequired] },
      { field: yearCompleted, validators: [validateRequired, validateYear] },
    ]),
    getData: () => ({
      degreeMajor: normalizeWhitespace(degreeMajor.input.value),
      university: normalizeWhitespace(university.input.value),
      yearCompleted: normalizeWhitespace(yearCompleted.input.value),
    }),
    isDirty: () => snapshot !== JSON.stringify(getFormData(fields)),
  };
}

function openEditEducationOverlay(entry, index, onSaved) {
  createEntryOverlay('Edit Education', (el) => buildEducationForm(el, entry), {
    onSave: (data) => {
      _formState.education.splice(index, 1, data);
      _formState.education = sortEducation(_formState.education);
      commitListChange();
      onSaved();
    },
  });
}

function renderEducationCard(page) {
  const { card, body } = createEditCard('EDUCATION', {
    onAdd: () => createEntryOverlay('Add Education', (el) => buildEducationForm(el), {
      onSave: (data) => {
        _formState.education = sortEducation([..._formState.education, data]);
        commitListChange();
        render();
      },
    }),
  });

  function render() {
    body.replaceChildren();

    for (const entry of sortEducation(_formState.education)) {
      body.append(createStructuredEntryRow({
        title: entry.degreeMajor,
        meta: [entry.university, entry.yearCompleted].filter(Boolean).join(' | '),
      }, {
        onEdit: () => openEditEducationOverlay(entry, _formState.education.indexOf(entry), render),
        onRemove: () => {
          const index = _formState.education.indexOf(entry);

          _formState.education.splice(index, 1);
          commitListChange();
          render();
        },
      }));
    }
  }

  render();
  page.append(card);
}

function buildExperienceForm(formEl, initial = {}) {
  const role = createField('Role', initial.role ?? '', false, { required: true });
  const company = createField('Company', initial.company ?? '', false, { required: true });
  const responsibilities = createField('Responsibilities', initial.responsibilities ?? '', true, { required: true });
  const dateStarted = createField('Date Started', initial.dateStarted ?? '', false, {
    required: true,
    placeholder: 'MM/YYYY',
  });
  const dateEnded = createField('Date Ended', initial.dateEnded ?? '', false, {
    required: true,
    placeholder: 'MM/YYYY',
  });
  const currentWorkWrapper = createElement('label', 'edit-field');
  const currentWorkLabel = createElement('span', 'edit-field__label', 'Current Work');
  const currentWork = document.createElement('input');
  const dateRow = createElement('div', 'inline-entry-form__row inline-entry-form__row--dates');
  const currentWorkField = { wrapper: currentWorkWrapper, input: currentWork, error: createElement('span', 'field-error') };
  const fields = { role, company, responsibilities, dateStarted, dateEnded, currentWork: currentWorkField };

  currentWork.type = 'checkbox';
  currentWork.className = 'edit-field__checkbox';
  currentWork.checked = Boolean(initial.currentWork);
  currentWorkField.error.hidden = true;
  currentWorkWrapper.classList.add('edit-field--checkbox');
  currentWorkWrapper.append(currentWorkLabel, currentWork, currentWorkField.error);

  function syncDateEnded() {
    dateEnded.input.disabled = currentWork.checked;
    dateEnded.wrapper.classList.toggle('edit-field--disabled', currentWork.checked);
    if (currentWork.checked) {
      setFieldError(dateEnded, '');
    }
  }

  currentWork.addEventListener('change', syncDateEnded);
  syncDateEnded();
  dateRow.append(dateStarted.wrapper, dateEnded.wrapper, currentWorkWrapper);
  formEl.append(role.wrapper, company.wrapper, responsibilities.wrapper, dateRow);

  const snapshot = JSON.stringify(getFormData(fields));

  return {
    validate: () => {
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

      return validateFields(rules);
    },
    getData: () => ({
      role: normalizeWhitespace(role.input.value),
      company: normalizeWhitespace(company.input.value),
      responsibilities: responsibilities.input.value.trim(),
      dateStarted: dateStarted.input.value.trim(),
      dateEnded: currentWork.checked ? '' : dateEnded.input.value.trim(),
      currentWork: currentWork.checked,
    }),
    isDirty: () => snapshot !== JSON.stringify(getFormData(fields)),
  };
}

function openEditExperienceOverlay(entry, index, onSaved) {
  createEntryOverlay('Edit Experience', (el) => buildExperienceForm(el, entry), {
    onSave: (data) => {
      _formState.experience.splice(index, 1, data);
      _formState.experience = sortExperience(_formState.experience);
      commitListChange();
      onSaved();
    },
  });
}

function renderExperienceCard(page) {
  const { card, body } = createEditCard('PROFESSIONAL EXPERIENCE', {
    onAdd: () => createEntryOverlay('Add Experience', (el) => buildExperienceForm(el), {
      onSave: (data) => {
        _formState.experience = sortExperience([..._formState.experience, data]);
        commitListChange();
        render();
      },
    }),
  });

  function render() {
    body.replaceChildren();

    for (const entry of sortExperience(_formState.experience)) {
      const endDate = entry.currentWork ? 'Present' : entry.dateEnded;

      body.append(createStructuredEntryRow({
        title: entry.role,
        meta: [
          entry.company,
          [entry.dateStarted, endDate].filter(Boolean).join(' – '),
        ].filter(Boolean).join(' | '),
        desc: entry.responsibilities,
      }, {
        onEdit: () => openEditExperienceOverlay(entry, _formState.experience.indexOf(entry), render),
        onRemove: () => {
          const index = _formState.experience.indexOf(entry);

          _formState.experience.splice(index, 1);
          commitListChange();
          render();
        },
      }));
    }
  }

  render();
  page.append(card);
}

function buildLinksForm(formEl, initial = {}) {
  const url = createField('Link URL', initial.url ?? '', false, { required: true });
  const friendlyName = createField('Friendly Name', initial.friendlyName ?? '');
  const fields = { url, friendlyName };
  const snapshot = JSON.stringify(getFormData(fields));

  formEl.append(url.wrapper, friendlyName.wrapper);

  return {
    validate: () => validateFields([
      { field: url, validators: [validateRequired, validateUrl] },
    ]),
    getData: () => ({
      url: url.input.value.trim(),
      friendlyName: normalizeWhitespace(friendlyName.input.value),
    }),
    isDirty: () => snapshot !== JSON.stringify(getFormData(fields)),
  };
}

function openEditLinkOverlay(entry, index, onSaved) {
  createEntryOverlay('Edit Link', (el) => buildLinksForm(el, entry), {
    onSave: (data) => {
      _formState.links.splice(index, 1, data);
      commitListChange();
      onSaved();
    },
  });
}

function renderLinksCard(page) {
  const { card, body } = createEditCard('LINKS', {
    onAdd: () => createEntryOverlay('Add Link', (el) => buildLinksForm(el), {
      onSave: (data) => {
        _formState.links.push(data);
        commitListChange();
        render();
      },
    }),
  });

  function render() {
    body.replaceChildren();

    _formState.links.forEach((entry, index) => {
      body.append(createStructuredEntryRow({
        title: getLinkLabel(entry.url, entry.friendlyName),
        meta: entry.url,
      }, {
        onEdit: () => openEditLinkOverlay(entry, index, render),
        onRemove: () => {
          _formState.links.splice(index, 1);
          commitListChange();
          render();
        },
      }));
    });
  }

  render();
  page.append(card);
}

function buildAwardsForm(formEl, initial = {}) {
  const awardName = createField('Award Name', initial.awardName ?? '', false, { required: true });
  const issuingBody = createField('Issuing Body', initial.issuingBody ?? '', false, { required: true });
  const details = createField('Details', initial.details ?? '', true);
  const date = createField('Date', initial.date ?? '', false, { placeholder: 'MM/YYYY' });
  const fields = { awardName, issuingBody, details, date };
  const snapshot = JSON.stringify(getFormData(fields));

  formEl.append(awardName.wrapper, issuingBody.wrapper, details.wrapper, date.wrapper);

  return {
    validate: () => validateFields([
      { field: awardName, validators: [validateRequired] },
      { field: issuingBody, validators: [validateRequired] },
      { field: date, validators: [optionalMonthYear] },
    ]),
    getData: () => ({
      awardName: normalizeWhitespace(awardName.input.value),
      issuingBody: normalizeWhitespace(issuingBody.input.value),
      details: details.input.value.trim(),
      date: date.input.value.trim(),
    }),
    isDirty: () => snapshot !== JSON.stringify(getFormData(fields)),
  };
}

function openEditAwardOverlay(entry, index, onSaved) {
  createEntryOverlay('Edit Award', (el) => buildAwardsForm(el, entry), {
    onSave: (data) => {
      _formState.awards.splice(index, 1, data);
      commitListChange();
      onSaved();
    },
  });
}

function renderAwardsCard(page) {
  const { card, body } = createEditCard('AWARDS', {
    onAdd: () => createEntryOverlay('Add Award', (el) => buildAwardsForm(el), {
      onSave: (data) => {
        _formState.awards.push(data);
        commitListChange();
        render();
      },
    }),
  });

  function render() {
    body.replaceChildren();

    _formState.awards.forEach((entry, index) => {
      body.append(createStructuredEntryRow({
        title: entry.awardName,
        meta: [entry.issuingBody, entry.date].filter(Boolean).join(' | '),
        desc: entry.details,
      }, {
        onEdit: () => openEditAwardOverlay(entry, index, render),
        onRemove: () => {
          _formState.awards.splice(index, 1);
          commitListChange();
          render();
        },
      }));
    });
  }

  render();
  page.append(card);
}

function renderResumeImportDemoNote() {
  // Feature 020: in demo, the upload widget is hidden by
  // ResumeImport's own VISIBLE_STATUSES exclusion (Phase 07.2). We
  // still render a small inline note in the slot so the visitor sees
  // the feature exists but is told sign-in is required — calmer than
  // a visibly-disabled multi-step uploader.
  const note = document.createElement('p');
  note.className = 'profile-edit__resume-demo-note';
  note.setAttribute('role', 'note');
  note.textContent = 'Resume import is available after signing in.';
  return note;
}

function renderResumeImportArea(page) {
  if (_importDone) {
    return;
  }

  if (authStore.getAuthState().status === 'demo') {
    page.append(renderResumeImportDemoNote());
    return;
  }

  const generation = _mountGeneration;
  const importArea = ResumeImport.create({
    onSuccess: (parsedData) => {
      if (!_container || _mountGeneration !== generation) return;
      _importDone = true;
      _formState = mergeResumeData(_formState, parsedData);
      renderEditPage(_container);
    },
    onDismiss: () => {},
  });

  _importArea = importArea;

  if (_highlightImport) {
    importArea.classList.add('resume-import--highlight');
  }

  page.append(importArea);
}

function renderEditPage(container) {
  const page = createElement('div', 'profile-edit-page');

  renderResumeImportArea(page);
  renderBasicInfoCard(page);
  renderSummaryCard(page);
  renderExperienceCard(page);
  renderEducationCard(page);
  renderSkillsCard(page);
  renderCertificationsCard(page);
  renderAwardsCard(page);
  renderLanguagesCard(page);
  renderLinksCard(page);

  page.append(renderPageControls());
  container.replaceChildren(page);
  updateControlsState();
  if (_highlightImport) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

const ENTRY_SECTION_LABELS = {
  experience: 'Professional Experience',
  education: 'Education',
  certifications: 'Certifications',
  awards: 'Awards',
  languages: 'Languages',
  links: 'Links',
};

function removeSectionValidationError() {
  document.querySelector('.section-validation-error')?.remove();
}

function showSectionValidationError(message) {
  const summary = createElement('p', 'section-validation-error', message);
  const page = document.querySelector('.profile-edit-page');

  summary.setAttribute('tabindex', '-1');
  page?.prepend(summary);
  summary.focus({ preventScroll: true });
  summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function surfaceValidationErrors(errors) {
  clearBasicInfoErrors();
  setFieldError(_basicInfoFields.firstName, errors.firstName ?? '');
  setFieldError(_basicInfoFields.lastName, errors.lastName ?? '');
  setFieldError(_basicInfoFields.email, errors.email ?? '');

  const sections = new Set();
  for (const key of Object.keys(errors)) {
    for (const [prefix, label] of Object.entries(ENTRY_SECTION_LABELS)) {
      if (key.startsWith(`${prefix}[`)) {
        sections.add(label);
        break;
      }
    }
  }
  removeSectionValidationError();
  if (sections.size > 0) {
    showSectionValidationError(
      `Some entries have missing required fields (${[...sections].join(', ')}). Remove and re-add any incomplete entries.`,
    );
  }
}

async function handleSave() {
  if (!isDirty() || _saving) {
    return;
  }

  removeSectionValidationError();

  const payload = normaliseProfile(_formState);
  const validation = validateProfile(payload);

  if (!validation.valid) {
    surfaceValidationErrors(validation.errors);
    return;
  }

  _saving = true;
  setSavingControlsBusy(true);

  try {
    await saveProfile(payload);
    _formState = deepClone(payload);
    _initialState = deepClone(payload);
    updateControlsState();
    _navigate('profile');
    Toast.show('Profile saved.', 'success');
  } catch {
    Toast.show('Could not save profile. Please try again.', 'error');
  } finally {
    _saving = false;
    setSavingControlsBusy(false);
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
  _discardAction = null;
  backdrop?.remove();
}

function showDiscardModal(onDiscard) {
  if (document.querySelector('.confirm-backdrop')) {
    return;
  }
  _discardAction = typeof onDiscard === 'function' ? onDiscard : null;

  const backdrop = createElement('div', 'confirm-backdrop');
  const modal = createElement('div', 'confirm-modal');
  const title = createElement('h2', 'confirm-modal__title', 'Discard changes?');
  const body = createElement('p', 'confirm-modal__body', 'Your edits will be lost.');
  const actions = createElement('div', 'confirm-modal__actions');
  const keepEditing = createButton('Keep Editing', 'profile-btn profile-btn--outline', () => closeDiscardModal(backdrop));
  const discard = createButton('Discard', 'profile-btn profile-btn--primary profile-btn--danger', () => {
    const action = _discardAction;

    _initialState = deepClone(_formState);
    closeDiscardModal(backdrop);
    if (action) {
      action();
    } else {
      _navigate('profile');
    }
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

export function confirmNavigation(page) {
  if (!isDirty()) {
    return true;
  }

  showDiscardModal(() => _navigate(page));
  return false;
}

export async function mount(container, { navigate, highlightImport = false } = {}) {
  _container = container;
  _navigate = typeof navigate === 'function' ? navigate : () => {};
  _highlightImport = highlightImport;
  _importDone = false;
  _mountGeneration += 1;
  container.replaceChildren(buildProfileEditSkeleton());

  const profile = await getProfile().catch(() => null);

  if (_container !== container) {
    return;
  }

  _formState = deepClone(normaliseProfile(profile ?? {}));
  _initialState = deepClone(_formState);
  renderSubheader();
  renderEditPage(container);

  _beforeUnloadHandler = (event) => {
    if (isDirty() || _openOverlay?.isDirty?.()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', _beforeUnloadHandler);
}

export function unmount() {
  _openOverlay?.close();
  cleanupSkillPopovers();
  if (_beforeUnloadHandler) {
    window.removeEventListener('beforeunload', _beforeUnloadHandler);
    _beforeUnloadHandler = null;
  }
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
  _discardAction = null;
  _openOverlay = null;
  _importArea?.destroy?.();
  _importArea = null;
  for (const binding of _saveBindings) {
    binding.dispose();
  }
  _saveBindings = [];
  _highlightImport = false;
  _importDone = false;
}

export const ProfileEdit = { mount, unmount, confirmNavigation };
