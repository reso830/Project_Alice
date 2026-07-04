import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from '../data/legalContent.js';

const DOCUMENTS = {
  terms: TERMS_AND_CONDITIONS,
  privacy: PRIVACY_POLICY,
};

let titleCounter = 0;

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (textContent) {
    element.textContent = textContent;
  }
  return element;
}

function getFocusableElements(dialog) {
  return Array.from(dialog.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
}

export const LegalModal = {
  render(type, onClose = () => {}) {
    const documentContent = DOCUMENTS[type];
    if (!documentContent) {
      throw new Error(`Unknown legal document type: ${type}`);
    }

    const overlay = createElement('div', 'legal-overlay');
    const dialog = createElement('section', 'legal-modal');
    const header = createElement('header', 'legal-modal__header');
    const handle = createElement('span', 'legal-modal__handle');
    const title = createElement('h2', 'legal-modal__title', documentContent.title);
    const closeButton = createElement('button', 'legal-modal__close', '✕');
    const body = createElement('div', 'legal-modal__body');
    const disclaimer = createElement('p', 'legal-modal__disclaimer', documentContent.disclaimer);
    const footer = createElement('footer', 'legal-modal__footer');
    const metadata = createElement('span', 'legal-modal__meta', documentContent.version);
    const footerButton = createElement('button', 'legal-modal__footer-button', 'Close');

    titleCounter += 1;
    title.id = `legal-modal-title-${titleCounter}`;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', title.id);
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', `Close ${documentContent.title}`);
    footerButton.type = 'button';

    for (const section of documentContent.sections) {
      const sectionElement = createElement('section', 'legal-modal__section');
      const sectionTitle = createElement('h3', 'legal-modal__section-title', section.title);
      const sectionCopy = createElement('p', 'legal-modal__copy', section.content);
      sectionElement.append(sectionTitle, sectionCopy);
      body.append(sectionElement);
    }

    let isClosed = false;

    function cleanup() {
      document.removeEventListener('keydown', escapeHandler);
      document.body.style.overflow = overlay.dataset.previousBodyOverflow || '';
      overlay.remove();
    }

    function requestClose() {
      if (isClosed) {
        return;
      }

      isClosed = true;
      cleanup();
      onClose();
    }

    closeButton.addEventListener('click', requestClose);
    footerButton.addEventListener('click', requestClose);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        requestClose();
      }
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    });

    const escapeHandler = (event) => {
      if (event.key === 'Escape') {
        requestClose();
      }
    };
    document.addEventListener('keydown', escapeHandler);

    overlay.dataset.previousBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';

    header.append(handle, title, closeButton);
    body.prepend(disclaimer);
    footer.append(metadata, footerButton);
    dialog.append(header, body, footer);
    overlay.append(dialog);
    document.body.append(overlay);
    closeButton.focus();

    return overlay;
  },
};
