// Scene 5 - Deck: a fanned stack of tracker cards with the white sigil.

import aliceWhite from '../../../assets/logo/alice-sigil-full-white.svg';

let _state = null;

const CARDS = [
  { id: 'J017', status: 'Offer', role: 'Staff Engineer', company: 'Lumen Systems', compat: 94, rotation: -8, x: -118 },
  { id: 'J031', status: 'Interview', role: 'Design Lead', company: 'Vesper Studio', compat: 71, rotation: 0, x: 0 },
  { id: 'J042', status: 'Applied', role: 'Product Designer', company: 'Northwind Labs', compat: 52, rotation: 8, x: 118 },
];

function compatClass(value) {
  if (value >= 85) return 'great';
  if (value >= 65) return 'good';
  return 'low';
}

function buildCard(card, index) {
  const el = document.createElement('article');
  const mark = document.createElement('img');
  const top = document.createElement('div');
  const id = document.createElement('span');
  const badge = document.createElement('span');
  const role = document.createElement('p');
  const company = document.createElement('p');
  const bar = document.createElement('span');
  const fill = document.createElement('span');

  el.className = `scene-deck__card scene-deck__card--${index}`;
  el.style.setProperty('--deck-x', `${card.x}px`);
  el.style.setProperty('--deck-rotation', `${card.rotation}deg`);
  mark.className = 'scene-deck__sigil';
  mark.src = aliceWhite;
  mark.alt = '';
  mark.setAttribute('aria-hidden', 'true');
  top.className = 'scene-deck__top';
  id.className = 'scene-deck__id';
  id.textContent = card.id;
  badge.className = 'scene-deck__badge';
  badge.textContent = card.status;
  role.className = 'scene-deck__role';
  role.textContent = card.role;
  company.className = 'scene-deck__company';
  company.textContent = card.company;
  bar.className = 'scene-deck__bar';
  fill.className = `scene-deck__bar-fill scene-deck__bar-fill--${compatClass(card.compat)}`;
  fill.style.width = `${card.compat}%`;

  top.append(id, badge);
  bar.append(fill);
  el.append(mark, top, role, company, bar);
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
