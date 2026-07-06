// Scene 5 - Deck: a fanned stack of tracker cards that float gently.

import { buildTrackerCard } from './trackerCard.js';

let _state = null;

// Ordered back-to-front (matches the prototype deck: offer behind, applied in front).
const CARDS = [
  { id: 'J017', status: 'Offer', badgeCls: 'offer', upd: 'Jun 09', role: 'Staff Engineer', company: 'Lumen Systems', compat: 94, x: -118, y: 8, rotation: -8 },
  { id: 'J031', status: 'Interview', badgeCls: 'interview', upd: 'Jun 11', role: 'Design Lead', company: 'Vesper Studio', compat: 71, x: 0, y: -6, rotation: 0 },
  { id: 'J042', status: 'Applied', badgeCls: 'applied', upd: 'Jun 12', role: 'Product Designer', company: 'Northwind Labs', compat: 52, x: 118, y: 8, rotation: 8 },
];

function buildCard(card, index) {
  const { card: el } = buildTrackerCard(card);
  el.classList.add('scene-deck__card', `scene-deck__card--${index}`);
  el.style.setProperty('--deck-x', `${card.x}px`);
  el.style.setProperty('--deck-y', `${card.y}px`);
  el.style.setProperty('--deck-rotation', `${card.rotation}deg`);
  return el;
}

export function mount(container, { variant = 'default' } = {}) {
  unmount();
  const root = document.createElement('div');
  const deck = document.createElement('div');

  root.className = `scene-deck scene-deck--${variant}`;
  root.dataset.variant = variant;
  deck.className = 'scene-deck__stack';
  CARDS.forEach((card, index) => deck.append(buildCard(card, index)));
  root.append(deck);
  container.append(root);
  _state = { root };
}

export function unmount() {
  if (!_state) return;
  _state.root.remove();
  _state = null;
}

export const SceneDeck = { mount, unmount };
