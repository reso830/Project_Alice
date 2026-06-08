import * as aiSettings from '../data/aiSettings.js';
import { mapErrorToReason, parseJobWithLlm, REASON_CODES } from '../services/llmParser.js';
import { parseJobPost } from '../utils/jobPostParser.js';

const MIN_POSTING_CHARS = 40;
const VISIBLE_PARSE_FIELDS = new Set([
  'companyName',
  'jobTitle',
  'responsibilities',
  'location',
  'salary',
  'workSetup',
  'shift',
  'skills',
  'preferredSkills',
  'recruiter',
  'jobPostingUrl',
]);

let textareaInputId = 0;

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

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) {
    return value.some(hasMeaningfulValue);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some(hasMeaningfulValue);
  }

  return value !== null && value !== undefined && value !== '';
}

function buildAiFieldSet(draft) {
  const fields = new Set();

  if (!draft || typeof draft !== 'object') {
    return fields;
  }

  for (const [field, value] of Object.entries(draft)) {
    if (!VISIBLE_PARSE_FIELDS.has(field)) {
      continue;
    }

    if (hasMeaningfulValue(value)) {
      fields.add(field);
    }
  }

  return fields;
}

function getReason(reasonKey) {
  return REASON_CODES[reasonKey] ?? REASON_CODES.rate_limit;
}

// JD parsing is paste-only, so override file/resume-oriented reason copy from the
// shared REASON_CODES (e.g. NO_TEXT's "the file looks scanned or image-only").
const JD_REASON_MESSAGES = Object.freeze({
  NO_TEXT: 'No readable job-posting details found — paste the full listing text and try again.',
});

function getReasonMessage(reasonKey) {
  return JD_REASON_MESSAGES[reasonKey] ?? getReason(reasonKey).message;
}

export const JobPostingImport = {
  create({
    onSuccess = () => {},
    onDismiss = () => {},
    onBack = onDismiss,
    onManual = onDismiss,
    navigate = () => {},
  } = {}) {
    const root = createElement('section', 'job-posting-import job-posting-import--idle');
    const textarea = document.createElement('textarea');
    const textareaId = `job-posting-import-paste-${textareaInputId += 1}`;
    const titleId = `job-posting-import-title-${textareaInputId}`;
    const count = createElement('p', 'job-posting-import__count', '0 chars');
    const error = createElement('p', 'job-posting-import__error');
    let parseButton = null;
    let pendingBasicText = '';
    let isProcessing = false;
    let destroyed = false;

    textarea.id = textareaId;
    textarea.className = 'job-posting-import__textarea';
    textarea.rows = 9;
    textarea.placeholder = [
      'Paste the full job description here...',
      '',
      'e.g. Senior Frontend Engineer at Northwind Labs — Makati City (Hybrid).',
      "You'll build and maintain our customer-facing web platform...",
    ].join('\n');
    error.hidden = true;

    function getPastedText() {
      return textarea.value.trim();
    }

    function hasEnoughText() {
      return getPastedText().length >= MIN_POSTING_CHARS;
    }

    function updateCount() {
      const length = textarea.value.length;
      count.textContent = `${length} chars`;
    }

    function updateParseButton() {
      if (parseButton) {
        parseButton.disabled = isProcessing || !hasEnoughText();
      }
    }

    function showError(message) {
      error.textContent = message;
      error.hidden = !message;
    }

    function renderShell(stateClass) {
      root.className = `job-posting-import ${stateClass}`;
      root.setAttribute('aria-busy', 'false');
      root.replaceChildren();
    }

    function createHeader() {
      const header = createElement('div', 'job-posting-import__header');
      const intro = createElement('div', 'job-posting-import__intro');
      const heading = createElement('h2', 'job-posting-import__title', 'Paste the job posting');
      const subtitle = createElement(
        'p',
        'job-posting-import__subtitle',
        "Copy the full text of the listing — we'll pull out the title, company, skills, and the rest.",
      );
      const closeButton = createButton('×', 'job-posting-import__close', onDismiss);
      heading.id = titleId;
      closeButton.setAttribute('aria-label', 'Close');
      intro.append(heading, subtitle);
      header.append(intro, closeButton);

      return header;
    }

    function getPostingContext() {
      const text = pendingBasicText || getPastedText();
      const length = text.length;

      return `Pasted job posting • ${length} ${length === 1 ? 'character' : 'characters'}`;
    }

    function goToSettings() {
      onDismiss();
      navigate('profile', { focusSettings: true });
    }

    function renderIdle() {
      renderShell('job-posting-import--idle');
      isProcessing = false;

      const footer = createElement('div', 'job-posting-import__footer');
      const helper = createElement(
        'p',
        'job-posting-import__helper',
        "Auto parsing isn't perfect — you can review & edit everything before saving.",
      );
      const field = createElement('div', 'job-posting-import__field');
      const label = createElement('label', 'job-posting-import__label', 'Paste job posting');
      const actions = createElement('div', 'job-posting-import__actions');
      const back = createButton('Back', 'profile-btn profile-btn--outline job-posting-import__back', onBack);

      label.setAttribute('for', textareaId);
      parseButton = createButton('Parse posting', 'profile-btn profile-btn--primary job-posting-import__parse', () => {
        processAi().catch(() => {});
      });
      updateCount();
      updateParseButton();
      field.append(label, textarea, count);
      actions.append(back, parseButton);
      footer.append(helper, actions);
      root.append(createHeader(), field, error, footer);
      textarea.focus();
    }

    function renderSettingsAffordance() {
      renderShell('job-posting-import--settings-required');
      isProcessing = false;

      const notice = createElement('div', 'job-posting-import__settings-required');
      const title = createElement('p', 'job-posting-import__settings-title', 'AI job-description parsing is off');
      const copy = createElement(
        'p',
        'job-posting-import__settings-copy',
        'Enable AI features, add your OpenRouter key, and turn on Job-description parsing to use Smart entry.',
      );
      const actions = createElement('div', 'job-posting-import__actions');
      const settings = createButton('Enable AI in Settings →', 'profile-btn profile-btn--outline job-posting-import__settings-link', goToSettings);
      const manual = createButton('Enter manually instead', 'profile-btn profile-btn--outline', () => {
        onManual();
      });

      notice.setAttribute('role', 'status');
      actions.append(settings, manual);
      notice.append(title, copy, actions);
      root.append(notice);
    }

    function renderProcessing() {
      renderShell('job-posting-import--processing');
      isProcessing = true;
      root.setAttribute('aria-busy', 'true');

      const overlay = createElement('div', 'job-posting-import-processing');
      const panel = createElement('div', 'job-posting-import-processing__panel');
      const spinner = createElement('span', 'job-posting-import-processing__spinner');
      const title = createElement('p', 'job-posting-import-processing__title', 'Reading the job posting...');
      const detail = createElement('p', 'job-posting-import-processing__detail', 'Extracting title, company, skills, and details.');

      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      spinner.setAttribute('aria-hidden', 'true');
      panel.append(spinner, title, detail);
      overlay.append(panel);
      root.append(overlay);

      return overlay;
    }

    function renderReasonLine(reasonKey) {
      const reason = getReason(reasonKey);
      const line = createElement('p', 'job-posting-import-failure__reason');
      const code = createElement('span', 'job-posting-import-failure__code', reason.code);
      const message = createElement('span', 'job-posting-import-failure__message', getReasonMessage(reasonKey));

      line.append(code, message);
      return line;
    }

    function renderFailureDialog(reasonKey) {
      const reason = getReason(reasonKey);
      const isDeadEnd = reason.fix === 'dead-end';
      const dialog = createElement(
        'div',
        `job-posting-import-failure${isDeadEnd ? ' job-posting-import-failure--dead-end' : ''}`,
      );
      const title = createElement(
        'p',
        'job-posting-import-failure__title',
        isDeadEnd ? "We couldn't read that posting" : 'Smart parsing is unavailable right now',
      );
      const copy = createElement(
        'p',
        'job-posting-import-failure__copy',
        isDeadEnd
          ? 'Try pasting a text-based posting with title, company, and responsibilities.'
          : 'You can switch to the basic parser and review the results before saving.',
      );
      const context = createElement('span', 'job-posting-import-failure__file', getPostingContext());
      const actions = createElement('div', 'job-posting-import-failure__actions');
      const tryAgain = createButton('Try again', 'profile-btn profile-btn--primary', () => {
        renderIdle();
      });
      const manual = createButton('Enter manually instead', 'profile-btn profile-btn--outline', () => {
        onManual();
      });

      isProcessing = false;
      root.setAttribute('aria-busy', 'false');
      dialog.setAttribute('role', 'alertdialog');
      dialog.append(title, copy, context, renderReasonLine(reasonKey));

      if (isDeadEnd) {
        actions.append(tryAgain, manual);
      } else {
        actions.append(createButton('Use basic parser', 'profile-btn profile-btn--primary', () => {
          processBasic().catch(() => {});
        }));
        if (reason.fix === 'settings') {
          actions.append(createButton('Update key in Settings →', 'profile-btn profile-btn--outline', goToSettings));
        } else {
          actions.append(createButton('Try AI again', 'profile-btn profile-btn--outline', () => {
            processAi({ fromRetry: true }).catch(() => {});
          }));
        }
        actions.append(manual);
      }

      dialog.append(actions);
      root.replaceChildren(createHeader(), dialog);
      actions.querySelector('button')?.focus();
    }

    function appendNotice(message) {
      if (!message) {
        return;
      }

      const notice = createElement('p', 'job-posting-import__notice', message);

      notice.setAttribute('role', 'status');
      root.append(notice);
    }

    function completeWithDraft(draft, fillSource, notice = '') {
      if (destroyed) {
        return null;
      }

      const aiFieldSet = buildAiFieldSet(draft);

      if (aiFieldSet.size === 0) {
        renderFailureDialog('NO_TEXT');
        return null;
      }

      appendNotice(notice);
      onSuccess({
        draft,
        aiFieldSet,
        fillSource,
        notice,
      });
      return draft;
    }

    async function processBasic() {
      const text = pendingBasicText || getPastedText();
      const status = renderProcessing();

      try {
        const draft = await Promise.resolve(parseJobPost(text));

        return completeWithDraft(draft, 'basic', '');
      } catch {
        const inline = createElement('p', 'job-posting-import__error', "Couldn't parse the posting. Try again.");
        const retry = createButton('Try again', 'profile-btn profile-btn--outline', () => {
          renderIdle();
        });

        status.replaceChildren(inline, retry);
        root.setAttribute('aria-busy', 'false');
        isProcessing = false;
        return null;
      }
    }

    async function processAi({ fromRetry = false } = {}) {
      const text = getPastedText();

      if (!hasEnoughText()) {
        showError(`Paste at least ${MIN_POSTING_CHARS} characters from the job posting.`);
        return null;
      }

      if (!aiSettings.canUseJdParser()) {
        renderSettingsAffordance();
        return null;
      }

      if (!fromRetry) {
        pendingBasicText = '';
      }
      pendingBasicText = text;
      renderProcessing();

      try {
        const result = await parseJobWithLlm(text, aiSettings.getKey(), aiSettings.getModel());

        if (destroyed) {
          return null;
        }

        const notice = result.truncated
          ? 'The posting was long, so some content may not be parsed.'
          : '';

        root.setAttribute('aria-busy', 'false');
        isProcessing = false;
        return completeWithDraft(result.draft, 'ai', notice);
      } catch (errorObject) {
        if (destroyed) {
          return null;
        }

        const reason = mapErrorToReason(errorObject);

        renderFailureDialog(reason);
        return null;
      }
    }

    textarea.addEventListener('input', () => {
      showError('');
      updateCount();
      updateParseButton();
    });
    renderIdle();
    root.destroy = () => {
      destroyed = true;
    };

    return root;
  },
};
