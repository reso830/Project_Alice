import { getAuthState, subscribe as subscribeAuth } from '../data/authStore.js';
import * as aiSettings from '../data/aiSettings.js';
import { parseWithLlm } from '../services/llmParser.js';
import { bindBusyButton, renderInlineError } from '../utils/asyncUI.js';
import { extractText, parseResume, parseText } from '../services/resumeApi.js';

// Exported (feature 020) so the demo test can assert
// `!VISIBLE_STATUSES.has(DEMO_STATUS)` as a design-by-contract guard.
// The set's contents intentionally exclude `'demo'` so the upload
// widget stays hidden in the portfolio demo even if a future change
// forgets the status-based gating elsewhere.
export const VISIBLE_STATUSES = new Set(['local-mode', 'authenticated']);

function isAuthVisible(state) {
  return VISIBLE_STATUSES.has(state?.status);
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);
const PROCESSING_MESSAGES = [
  'Reading resume...',
  'Extracting experience...',
  'Building profile...',
];
let pasteInputId = 0;

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

function getExtension(file) {
  const dotIndex = file.name.lastIndexOf('.');
  return dotIndex === -1 ? '' : file.name.slice(dotIndex).toLowerCase();
}

function validateFile(file) {
  if (!file) {
    return 'Choose a PDF, DOCX, or TXT resume file.';
  }

  if (file.size > MAX_FILE_SIZE) {
    return 'Resume file must be 5 MB or smaller.';
  }

  if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(getExtension(file))) {
    return 'Unsupported file type. Upload a PDF, DOCX, or TXT file.';
  }

  return '';
}

function hasExtractedData(parsedData) {
  if (!parsedData || typeof parsedData !== 'object') {
    return false;
  }

  return Object.values(parsedData).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== null && value !== '';
  });
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
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
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (hasMeaningfulValue(entry)) {
          fields.add(`${field}[${index}]`);
        }
      });
    } else if (hasMeaningfulValue(value)) {
      fields.add(field);
    }
  }

  return fields;
}

function supportsDesktopDrop() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: fine)').matches;
}

function stopEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

export const ResumeImport = {
  create({ onSuccess = () => {}, onDismiss = () => {} } = {}) {
    const root = createElement('section', 'resume-import');
    let authVisible = isAuthVisible(getAuthState());
    let completed = false;

    function applyVisibility() {
      root.hidden = !authVisible || completed;
      if (!authVisible) {
        root.replaceChildren(input);
      }
    }

    const input = document.createElement('input');
    const error = createElement('p', 'resume-import__error');
    const paste = document.createElement('textarea');
    const pasteId = `resume-import-paste-${pasteInputId += 1}`;
    let selectedFile = null;
    let processingIndex = 0;
    let processingTimer = null;

    input.type = 'file';
    input.accept = '.pdf,.docx,.txt';
    input.className = 'resume-import__input';
    input.setAttribute('aria-label', 'Choose resume file');
    input.hidden = true;
    paste.id = pasteId;
    paste.className = 'resume-import__paste-input';
    paste.rows = 6;
    paste.placeholder = 'Paste resume text here';
    error.hidden = true;
    applyVisibility();
    const unsubscribe = subscribeAuth((state) => {
      authVisible = isAuthVisible(state);
      applyVisibility();
      if (authVisible && root.children.length === 1) {
        renderIdle();
      }
    });

    function clearProcessingTimer() {
      if (processingTimer) {
        window.clearInterval(processingTimer);
        processingTimer = null;
      }
    }

    function showError(message) {
      error.textContent = message;
      error.hidden = !message;
    }

    function getPastedText() {
      return paste.value.trim();
    }

    function selectFile(file) {
      const message = validateFile(file);

      if (message) {
        // Clear any previously-valid selection so an invalid pick can't leave a
        // stale `selectedFile` that Process would silently use (Codex P2).
        selectedFile = null;
        input.value = '';
        showError(message);
        renderIdle();
        return;
      }

      selectedFile = file;
      showError('');
      renderSelected();
    }

    function renderShell(stateClass) {
      clearProcessingTimer();
      root.className = `resume-import ${stateClass}`;
      applyVisibility();
      root.setAttribute('aria-busy', 'false');
      root.replaceChildren(input);
    }

    function createPasteField() {
      const wrapper = createElement('div', 'resume-import__paste');
      const label = createElement('label', 'resume-import__paste-label', 'Paste resume text');

      label.setAttribute('for', pasteId);
      wrapper.append(label, paste);

      return wrapper;
    }

    function createDropZone() {
      const zone = createButton(
        'Import profile information from your resume',
        'resume-import__dropzone',
        () => input.click(),
      );

      zone.append(createElement('span', 'resume-import__hint', 'PDF, DOCX, or TXT up to 5 MB'));

      if (supportsDesktopDrop()) {
        zone.addEventListener('dragover', stopEvent);
        zone.addEventListener('drop', (event) => {
          stopEvent(event);
          selectFile(event.dataTransfer?.files?.[0]);
        });
      }

      return zone;
    }

    function createHeader() {
      const header = createElement('div', 'resume-import__header');

      header.append(createElement('div', 'section-label', 'RESUME IMPORT'));

      return header;
    }

    function renderIdle() {
      renderShell('resume-import--idle');
      if (!authVisible) {
        return;
      }
      const disclaimer = createElement(
        'p',
        'resume-import__disclaimer',
        'Auto-parsing may not be perfect — review all imported fields before saving.',
      );
      const actions = createElement('div', 'resume-import__actions');
      const process = createButton('Process Resume', 'profile-btn profile-btn--primary', () => {
        processBinding.run().catch(() => {});
      });
      const processBinding = bindBusyButton({
        button: process,
        action: processSelectedInput,
        silent: true,
      });

      actions.append(process);
      root.append(createHeader(), createDropZone(), createPasteField(), actions, disclaimer, error);
    }

    function renderSelected() {
      renderShell('resume-import--selected');

      const fileName = createElement('p', 'resume-import__filename', selectedFile.name);
      const actions = createElement('div', 'resume-import__actions');
      const chooseAgain = createButton('Choose Different File', 'profile-btn profile-btn--outline', () => input.click());
      const process = createButton('Process Resume', 'profile-btn profile-btn--primary', () => {
        processBinding.run().catch(() => {});
      });
      const processBinding = bindBusyButton({
        button: process,
        action: processSelectedInput,
        silent: true,
      });

      actions.append(chooseAgain, process);
      root.append(fileName, createPasteField(), actions, error);
    }

    function renderProcessing() {
      renderShell('resume-import--processing');
      root.setAttribute('aria-busy', 'true');

      const status = createElement('div', 'resume-import__status', PROCESSING_MESSAGES[0]);
      const process = createButton('Process Resume', 'profile-btn profile-btn--primary', () => {});

      process.disabled = true;
      status.setAttribute('aria-live', 'polite');
      root.append(status, process);

      processingIndex = 0;
      processingTimer = window.setInterval(() => {
        processingIndex = (processingIndex + 1) % PROCESSING_MESSAGES.length;
        status.textContent = PROCESSING_MESSAGES[processingIndex];
      }, 1200);

      return status;
    }

    function appendNotice(message) {
      if (!message) {
        return;
      }

      const notice = createElement('p', 'resume-import__notice', message);

      notice.setAttribute('role', 'status');
      root.append(notice);
    }

    function shouldAskForConsent() {
      return aiSettings.hasKey() && !aiSettings.hasConsent();
    }

    function renderConsentNotice() {
      renderShell('resume-import--consent');

      const notice = createElement('div', 'resume-import__consent');
      const title = createElement('p', 'resume-import__consent-title', 'Send resume text to OpenRouter?');
      const copy = createElement(
        'p',
        'resume-import__consent-copy',
        'Alice will send the resume text to OpenRouter for AI parsing. Your key stays in this browser.',
      );
      const actions = createElement('div', 'resume-import__actions');
      const accept = createButton('Send to OpenRouter', 'profile-btn profile-btn--primary resume-import__consent-accept', () => {
        aiSettings.setConsent();
        processSelectedInput().catch(() => {});
      });
      const decline = createButton('Use Rule-Based Import', 'profile-btn profile-btn--outline resume-import__consent-decline', () => {
        processSelectedInput({ forceRuleBased: true }).catch(() => {});
      });

      notice.setAttribute('role', 'dialog');
      notice.setAttribute('aria-label', 'AI resume parsing consent');
      actions.append(accept, decline);
      notice.append(title, copy, actions);
      root.append(notice);
    }

    async function runRuleBasedParser(rawText = '') {
      const pastedText = getPastedText();
      const text = rawText || pastedText;

      return {
        parsedData: text
          ? await parseText(text)
          : await parseResume(selectedFile),
        aiFieldSet: new Set(),
      };
    }

    async function runParser({ forceRuleBased = false } = {}) {
      const pastedText = getPastedText();

      if (!selectedFile && !pastedText) {
        showError('Paste resume text or choose a PDF, DOCX, or TXT resume file.');
        return null;
      }

      if (!forceRuleBased && aiSettings.hasKey() && aiSettings.hasConsent()) {
        const rawText = pastedText || await extractText(selectedFile);

        try {
          const result = await parseWithLlm(rawText, aiSettings.getKey());

          return {
            parsedData: result.draft,
            aiFieldSet: buildAiFieldSet(result.draft),
            notice: result.truncated
              ? 'The resume was long, so some content may not be parsed.'
              : '',
          };
        } catch {
          return {
            ...await runRuleBasedParser(rawText),
            notice: 'AI parsing was unavailable, so Alice used the rule-based importer.',
          };
        }
      }

      return runRuleBasedParser();
    }

    async function processSelectedInput({ forceRuleBased = false } = {}) {
      if (!selectedFile && !getPastedText()) {
        showError('Paste resume text or choose a PDF, DOCX, or TXT resume file.');
        return null;
      }

      if (!forceRuleBased && shouldAskForConsent()) {
        renderConsentNotice();
        return null;
      }

      const status = renderProcessing();

      try {
        const result = await runParser({ forceRuleBased });
        clearProcessingTimer();
        if (!result) {
          return null;
        }
        const { parsedData, aiFieldSet, notice } = result;

        if (!hasExtractedData(parsedData)) {
          throw new Error('No resume data extracted.');
        }

        appendNotice(notice);
        onSuccess(parsedData, aiFieldSet, { notice });
        completed = true;
        applyVisibility();
        return parsedData;
      } catch {
        clearProcessingTimer();
        root.setAttribute('aria-busy', 'false');
        const inlineError = renderInlineError({
          target: status,
          message: "Couldn't parse the resume. Try again.",
          onRetry: () => {
            processSelectedInput().catch(() => {});
          },
        });
        const dismiss = createButton('Continue Manually', 'profile-btn profile-btn--outline', () => {
          onDismiss();
          completed = true;
          applyVisibility();
        });
        inlineError.element.append(dismiss);
        return null;
      }
    }

    input.addEventListener('change', () => selectFile(input.files?.[0]));
    paste.addEventListener('input', () => showError(''));
    renderIdle();
    root.destroy = () => {
      clearProcessingTimer();
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };

    return root;
  },
};
