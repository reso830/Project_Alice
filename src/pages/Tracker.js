import { Card } from '../components/Card.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import { Toolbar } from '../components/Toolbar.js';
import { store } from '../data/store.js';
import * as api from '../services/api.js';

let _container = null;
let _cardList = null;

function createCallbacks() {
  return {
    onOpen: (id) => {
      Modal.open(store.getById(id), {
        onStatusChange: async (applicationId, newStatus) => {
          try {
            await api.update(applicationId, { status: newStatus });
            return true;
          } catch {
            Toast.show('Status update failed', 'failure');
            return false;
          }
        },
      });
    },
    onStatusChange: async (id, newStatus) => {
      try {
        await api.update(id, { status: newStatus });
      } catch {
        Toast.show('Status update failed', 'failure');
      }
    },
    onFavToggle: (id) => {
      store.toggleFav(id);
      refreshCard(id);
    },
    onCopyUrl: (id) => {
      const application = store.getById(id);

      if (!application?.url) {
        Toast.show('No URL on file', 'failure');
        return;
      }

      if (!navigator.clipboard) {
        Toast.show('Copy failed — clipboard not available', 'failure');
        return;
      }

      navigator.clipboard.writeText(application.url)
        .then(() => Toast.show('URL copied to clipboard', 'success'))
        .catch(() => Toast.show('Copy failed — check browser permissions', 'failure'));
    },
  };
}

export function refreshCard(id) {
  if (!_cardList) {
    return;
  }

  const application = store.getById(id);
  const currentCard = [..._cardList.querySelectorAll('.card')]
    .find((card) => card.dataset.id === id);

  if (!application || !currentCard) {
    return;
  }

  currentCard.replaceWith(Card.render(application, createCallbacks()));
}

export function mount(container) {
  _container = container;
  _container.replaceChildren();

  const applications = store.getAll();
  _container.append(Toolbar.render(applications.length));

  if (applications.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No applications yet. Add your first one!';
    _container.append(emptyState);
    window.scrollTo(0, 0);
    return;
  }

  _cardList = document.createElement('div');
  _cardList.className = 'card-list';

  for (const application of applications) {
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
}

export const Tracker = { mount, unmount };
