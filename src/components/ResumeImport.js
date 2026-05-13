import { parseResume } from '../services/resumeApi.js';

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
    const input = document.createElement('input');
    const error = createElement('p', 'resume-import__error');
    let selectedFile = null;
    let processingIndex = 0;
    let processingTimer = null;

    input.type = 'file';
    input.accept = '.pdf,.docx,.txt';
    input.className = 'resume-import__input';
    input.setAttribute('aria-label', 'Choose resume file');
    input.hidden = true;
    error.hidden = true;

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

    function selectFile(file) {
      const message = validateFile(file);

      if (message) {
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
      root.hidden = false;
      root.setAttribute('aria-busy', 'false');
      root.replaceChildren(input);
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
      const disclaimer = createElement(
        'p',
        'resume-import__disclaimer',
        'Auto-parsing may not be perfect — review all imported fields before saving.',
      );
      root.append(createHeader(), createDropZone(), disclaimer, error);
    }

    function renderSelected() {
      renderShell('resume-import--selected');

      const fileName = createElement('p', 'resume-import__filename', selectedFile.name);
      const actions = createElement('div', 'resume-import__actions');
      const chooseAgain = createButton('Choose Different File', 'profile-btn profile-btn--outline', () => input.click());
      const process = createButton('Process Resume', 'profile-btn profile-btn--primary', renderProcessing);

      actions.append(chooseAgain, process);
      root.append(fileName, actions, error);
    }

    function renderProcessing() {
      renderShell('resume-import--processing');
      root.setAttribute('aria-busy', 'true');

      const status = createElement('p', 'resume-import__status', PROCESSING_MESSAGES[0]);
      const process = createButton('Process Resume', 'profile-btn profile-btn--primary', () => {});

      process.disabled = true;
      status.setAttribute('aria-live', 'polite');
      root.append(status, process);

      processingIndex = 0;
      processingTimer = window.setInterval(() => {
        processingIndex = (processingIndex + 1) % PROCESSING_MESSAGES.length;
        status.textContent = PROCESSING_MESSAGES[processingIndex];
      }, 1200);

      parseResume(selectedFile)
        .then((parsedData) => {
          clearProcessingTimer();
          if (!hasExtractedData(parsedData)) {
            renderError();
            return;
          }

          onSuccess(parsedData);
          root.hidden = true;
        })
        .catch(() => {
          clearProcessingTimer();
          renderError();
        });
    }

    function renderError() {
      renderShell('resume-import--error');

      const message = createElement('p', 'resume-import__error-message', 'Unable to parse resume. Try a different file or continue manually.');
      const actions = createElement('div', 'resume-import__actions');
      const retry = createButton('Retry', 'profile-btn profile-btn--primary', renderSelected);
      const dismiss = createButton('Continue Manually', 'profile-btn profile-btn--outline', () => {
        onDismiss();
        root.hidden = true;
      });

      actions.append(retry, dismiss);
      root.append(message, actions);
    }

    input.addEventListener('change', () => selectFile(input.files?.[0]));
    renderIdle();
    root.destroy = clearProcessingTimer;

    return root;
  },
};
