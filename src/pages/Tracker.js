import { Card } from '../components/Card.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { Toolbar } from '../components/Toolbar.js';
import * as api from '../services/api.js';

let _container = null;
let _cardList = null;
let _applications = [];

function coerceId(id) {
  return typeof id === 'number' ? id : parseInt(id, 10);
}

function findApplication(id) {
  const numericId = coerceId(id);
  return _applications.find((application) => application.id === numericId);
}

function replaceApplication(application) {
  _applications = _applications.map((current) => (
    current.id === application.id ? application : current
  ));
}

function removeApplication(id) {
  const numericId = coerceId(id);
  _applications = _applications.filter((application) => application.id !== numericId);
}

function renderMessage(message, className = 'empty-state') {
  const messageEl = document.createElement('div');
  messageEl.className = className;
  messageEl.textContent = message;
  return messageEl;
}

function createCallbacks() {
  return {
    onOpen: async (id) => {
      try {
        const application = await api.getById(coerceId(id));
        Modal.open(application, {
          onStatusChange: async (applicationId, newStatus) => {
            try {
              const updated = await api.update(coerceId(applicationId), { status: newStatus });
              replaceApplication(updated);
              refreshCard(updated.id);
              return true;
            } catch {
              Toast.show('Status update failed', 'failure');
              return false;
            }
          },
        });
      } catch {
        Toast.show('Application details failed to load', 'failure');
      }
    },
    onStatusChange: async (id, newStatus) => {
      try {
        const updated = await api.update(coerceId(id), { status: newStatus });
        replaceApplication(updated);
        refreshCard(updated.id);
      } catch {
        Toast.show('Status update failed', 'failure');
      }
    },
    onFavToggle: async (id) => {
      const application = findApplication(id);

      if (!application) {
        return;
      }

      try {
        const updated = await api.update(coerceId(id), { fav: !application.fav });
        replaceApplication(updated);
        refreshCard(updated.id);
      } catch {
        Toast.show('Star update failed', 'failure');
        refreshCard(id);
      }
    },
    onArchive: async (id) => {
      try {
        await api.archive(coerceId(id));
        removeApplication(id);

        const card = _cardList?.querySelector(`[data-id="${coerceId(id)}"]`);
        card?.remove();
        Toolbar.updateCount(_applications.length);

        if (_applications.length === 0 && _container && !_container.querySelector('.empty-state')) {
          _container.append(renderMessage('No applications yet. Add your first one!'));
        }
      } catch {
        Toast.show('Archive failed', 'failure');
      }
    },
    onCopyUrl: async (id) => {
      let application;

      try {
        application = await api.getById(coerceId(id));
      } catch {
        Toast.show('Application details failed to load', 'failure');
        return;
      }

      if (!application?.jobPostingUrl) {
        Toast.show('No URL on file', 'failure');
        return;
      }

      if (!navigator.clipboard) {
        Toast.show('Copy failed — clipboard not available', 'failure');
        return;
      }

      navigator.clipboard.writeText(application.jobPostingUrl)
        .then(() => Toast.show('URL copied to clipboard', 'success'))
        .catch(() => Toast.show('Copy failed — check browser permissions', 'failure'));
    },
  };
}

export function refreshCard(id) {
  if (!_cardList) {
    return;
  }

  const numericId = coerceId(id);
  const application = findApplication(numericId);
  const currentCard = [..._cardList.querySelectorAll('.card')]
    .find((card) => parseInt(card.dataset.id, 10) === numericId);

  if (!application || !currentCard) {
    return;
  }

  currentCard.replaceWith(Card.render(application, createCallbacks()));
}

export async function mount(container) {
  _container = container;
  _container.replaceChildren();
  _applications = [];

  const toolbar = Toolbar.render(0);
  toolbar.setAttribute('aria-busy', 'true');
  toolbar.setAttribute('aria-disabled', 'true');
  _container.append(toolbar);

  try {
    _applications = await api.getAll();
  } catch (error) {
    toolbar.removeAttribute('aria-busy');
    toolbar.removeAttribute('aria-disabled');

    if (error.code === 'NETWORK_ERROR') {
      _container.append(renderMessage(
        'Cannot connect to the backend — is the server running?',
        'empty-state empty-state--error',
      ));
    } else {
      Toast.show('Applications failed to load', 'failure');
      _container.append(renderMessage('Applications failed to load', 'empty-state empty-state--error'));
    }

    window.scrollTo(0, 0);
    return;
  }

  toolbar.removeAttribute('aria-busy');
  toolbar.removeAttribute('aria-disabled');
  Toolbar.updateCount(_applications.length);

  if (_applications.length === 0) {
    _container.append(renderMessage('No applications yet. Add your first one!'));
    window.scrollTo(0, 0);
    return;
  }

  _cardList = document.createElement('div');
  _cardList.className = 'card-list';

  for (const application of _applications) {
    _cardList.append(Card.render(application, createCallbacks()));
  }

  _container.append(_cardList);
  window.scrollTo(0, 0);
}

export function unmount() {
  if (_container) {
    _container.replaceChildren();
  }

  _container = null;
  _cardList = null;
  _applications = [];
}

export const Tracker = { mount, unmount };
