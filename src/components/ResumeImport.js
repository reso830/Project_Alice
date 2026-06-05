import { getAuthState, subscribe as subscribeAuth } from '../data/authStore.js';
import * as aiSettings from '../data/aiSettings.js';
import { mapErrorToReason, parseWithLlm, REASON_CODES } from '../services/llmParser.js';
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
  create({
    onSuccess = () => {},
    onDismiss = () => {},
    navigate = () => {},
    smartInput = false,
    title = 'Resume Import',
    showHeader = true,
  } = {}) {
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
    let activeMode = 'file';
    let pendingBasicText = '';
    let processButtons = new Set();

    input.type = 'file';
    input.accept = '.pdf,.docx,.txt';
    input.className = 'resume-import__input';
    input.setAttribute('aria-label', 'Choose resume file');
    input.hidden = true;
    paste.id = pasteId;
    paste.className = 'resume-import__paste-input';
    paste.rows = 6;
    paste.placeholder = smartInput ? 'Paste the full text of your resume here...' : 'Paste resume text here';
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

    function hasProcessInput() {
      if (selectedFile) {
        return true;
      }

      const text = getPastedText();
      return smartInput ? text.length > 20 : Boolean(text);
    }

    function updateProcessButtons() {
      for (const button of processButtons) {
        button.disabled = smartInput && !hasProcessInput();
      }
    }

    function createProcessButton(action) {
      const process = createButton('Process Resume', 'profile-btn profile-btn--primary resume-import__process', () => {
        action();
      });

      processButtons.add(process);
      updateProcessButtons();

      return process;
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
      processButtons = new Set();
      root.className = `resume-import ${stateClass}${smartInput ? ' resume-import--smart' : ''}`;
      applyVisibility();
      root.setAttribute('aria-busy', 'false');
      root.replaceChildren(input);
    }

    function createModeTabs() {
      const tabs = createElement('div', 'resume-import__mode-tabs');
      const upload = createButton('Upload file', `resume-import__mode${activeMode === 'file' ? ' is-active' : ''}`, () => {
        activeMode = 'file';
        renderIdle();
      });
      const pasteMode = createButton('Paste text', `resume-import__mode${activeMode === 'paste' ? ' is-active' : ''}`, () => {
        activeMode = 'paste';
        renderIdle();
        paste.focus();
      });

      upload.setAttribute('aria-pressed', String(activeMode === 'file'));
      pasteMode.setAttribute('aria-pressed', String(activeMode === 'paste'));
      tabs.append(upload, pasteMode);

      return tabs;
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
        smartInput ? 'Browse resume file' : 'Import profile information from your resume',
        'resume-import__dropzone',
        () => input.click(),
      );

      zone.append(createElement(
        'span',
        'resume-import__hint',
        smartInput ? 'Drag and drop or browse. PDF, DOCX, or TXT up to 5 MB.' : 'PDF, DOCX, or TXT up to 5 MB',
      ));

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

      header.append(createElement('div', 'section-label', title.toUpperCase()));

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
      const process = createProcessButton(() => {
        processBinding.run().catch(() => {});
      });
      const processBinding = bindBusyButton({
        button: process,
        action: processSelectedInput,
        silent: true,
      });
      const content = [];

      actions.append(process);
      if (showHeader) {
        content.push(createHeader());
      }
      if (smartInput) {
        content.push(createModeTabs(), activeMode === 'file' ? createDropZone() : createPasteField());
      } else {
        content.push(createDropZone(), createPasteField());
      }
      root.append(...content, actions, disclaimer, error);
    }

    function renderSelected() {
      renderShell('resume-import--selected');

      const fileName = createElement('p', 'resume-import__filename', selectedFile.name);
      const actions = createElement('div', 'resume-import__actions');
      const chooseAgain = createButton('Choose Different File', 'profile-btn profile-btn--outline', () => input.click());
      const process = createProcessButton(() => {
        processBinding.run().catch(() => {});
      });
      const processBinding = bindBusyButton({
        button: process,
        action: processSelectedInput,
        silent: true,
      });

      actions.append(chooseAgain, process);
      root.append(
        ...(showHeader ? [createHeader()] : []),
        ...(smartInput ? [createModeTabs()] : []),
        fileName,
        ...(smartInput ? [] : [createPasteField()]),
        actions,
        error,
      );
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

    function getReason(reasonKey) {
      return REASON_CODES[reasonKey] ?? REASON_CODES.rate_limit;
    }

    function getFileContext() {
      return selectedFile?.name ?? 'Pasted résumé text';
    }

    function renderReasonLine(reasonKey) {
      const reason = getReason(reasonKey);
      const line = createElement('p', 'resume-import-failure__reason');
      const code = createElement('span', 'resume-import-failure__code', reason.code);
      const message = createElement('span', 'resume-import-failure__message', reason.message);

      line.append(code, message);
      return line;
    }

    function renderFailureDialog(reasonKey) {
      const reason = getReason(reasonKey);
      const isDeadEnd = reason.fix === 'dead-end';
      const dialog = createElement(
        'div',
        `resume-import-failure${isDeadEnd ? ' resume-import-failure--dead-end' : ''}`,
      );
      const title = createElement(
        'p',
        'resume-import-failure__title',
        isDeadEnd ? "We couldn't read that résumé" : 'Smart parsing is unavailable right now',
      );
      const copy = createElement(
        'p',
        'resume-import-failure__copy',
        isDeadEnd
          ? 'A text-based PDF or pasting the text usually works better.'
          : 'You can switch to the basic parser and review the results before saving.',
      );
      const file = createElement('span', 'resume-import-failure__file', getFileContext());
      const actions = createElement('div', 'resume-import-failure__actions');
      const tryAgain = createButton('Try again', 'profile-btn profile-btn--outline', () => {
        processSelectedInput().catch(() => {});
      });

      if (isDeadEnd) {
        const different = createButton('Use a different file', 'profile-btn profile-btn--primary', () => {
          selectedFile = null;
          input.value = '';
          renderIdle();
        });
        const cancel = createButton('Cancel', 'profile-btn profile-btn--outline', () => {
          onDismiss();
        });

        actions.append(tryAgain, different, cancel);
      } else {
        const basic = createButton('Use basic parser', 'profile-btn profile-btn--primary', () => {
          processSelectedInput({ forceRuleBased: true }).catch(() => {});
        });

        actions.append(basic);
        if (reason.fix === 'settings') {
          actions.append(createButton('Update key in Settings →', 'profile-btn profile-btn--outline', () => {
            navigate('profile', { focusSettings: true });
          }));
        } else {
          actions.append(createButton('Try AI again', 'profile-btn profile-btn--outline', () => {
            processSelectedInput().catch(() => {});
          }));
        }
        actions.append(createButton('Cancel', 'profile-btn profile-btn--outline', () => {
          onDismiss();
        }));
      }

      dialog.setAttribute('role', 'alertdialog');
      dialog.append(title, copy, file, renderReasonLine(reasonKey), actions);
      root.replaceChildren(input, dialog);
      root.setAttribute('aria-busy', 'false');
    }

    function isAiFeatureDisabled() {
      return !aiSettings.isEnabled() || !aiSettings.getFeature('cv');
    }

    function canUseAiParser() {
      return !isAiFeatureDisabled() && aiSettings.hasKey();
    }

    function renderSettingsAffordance() {
      renderShell('resume-import--settings-required');

      const notice = createElement('div', 'resume-import__settings-required');
      const title = createElement('p', 'resume-import__settings-title', 'AI resume parsing is off');
      const copy = createElement(
        'p',
        'resume-import__settings-copy',
        'Resume import is paused until AI features and resume parsing are enabled.',
      );
      const actions = createElement('div', 'resume-import__actions');
      const settings = createButton('Enable AI in Settings →', 'profile-btn profile-btn--outline resume-import__settings-link', () => {
        navigate('profile', { focusSettings: true });
      });

      notice.setAttribute('role', 'status');
      actions.append(settings);
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

      if (!forceRuleBased && canUseAiParser()) {
        const rawText = pastedText || await extractText(selectedFile);

        try {
          const result = await parseWithLlm(rawText, aiSettings.getKey(), aiSettings.getModel());

          return {
            parsedData: result.draft,
            aiFieldSet: buildAiFieldSet(result.draft),
            source: 'ai',
            notice: result.truncated
              ? 'The resume was long, so some content may not be parsed.'
              : '',
          };
        } catch (error) {
          return {
            reason: mapErrorToReason(error),
            rawText,
          };
        }
      }

      return {
        ...await runRuleBasedParser(),
        source: 'basic',
      };
    }

    async function processSelectedInput({ forceRuleBased = false } = {}) {
      if (!selectedFile && !getPastedText()) {
        showError('Paste resume text or choose a PDF, DOCX, or TXT resume file.');
        return null;
      }

      if (!forceRuleBased && isAiFeatureDisabled()) {
        renderSettingsAffordance();
        return null;
      }

      if (!forceRuleBased) {
        pendingBasicText = '';
      }

      const status = renderProcessing();

      try {
        const result = forceRuleBased
          ? { ...await runRuleBasedParser(pendingBasicText), source: 'basic' }
          : await runParser({ forceRuleBased });
        clearProcessingTimer();
        if (!result) {
          return null;
        }
        if (result.reason) {
          pendingBasicText = result.rawText ?? '';
          renderFailureDialog(result.reason);
          return null;
        }
        const { parsedData, aiFieldSet, notice } = result;

        if (!hasExtractedData(parsedData)) {
          renderFailureDialog('NO_TEXT');
          return null;
        }

        appendNotice(notice);
        onSuccess(parsedData, aiFieldSet, { notice, source: result.source });
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
    paste.addEventListener('input', () => {
      showError('');
      updateProcessButtons();
    });
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
