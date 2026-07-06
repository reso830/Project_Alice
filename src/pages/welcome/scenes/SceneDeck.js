// Scene 5 - Deck: a fanned stack of tracker cards that float gently.

let _state = null;

// Ordered back-to-front (matches the prototype deck: offer behind, applied in front).
const CARDS = [
  { id: 'J017', status: 'Offer', badgeCls: 'offer', upd: 'Jun 09', role: 'Staff Engineer', company: 'Lumen Systems', compat: 94, x: -118, y: 8, rotation: -8 },
  { id: 'J031', status: 'Interview', badgeCls: 'interview', upd: 'Jun 11', role: 'Design Lead', company: 'Vesper Studio', compat: 71, x: 0, y: -6, rotation: 0 },
  { id: 'J042', status: 'Applied', badgeCls: 'applied', upd: 'Jun 12', role: 'Product Designer', company: 'Northwind Labs', compat: 52, x: 118, y: 8, rotation: 8 },
];

function compatClass(value) {
  if (value >= 85) return 'great';
  if (value >= 65) return 'good';
  return 'low';
}

function buildCard(card, index) {
  const el = document.createElement('article');
  const accent = document.createElement('span');
  const row = document.createElement('div');
  const id = document.createElement('span');
  const badge = document.createElement('span');
  const upd = document.createElement('span');
  const body = document.createElement('div');
  const role = document.createElement('p');
  const company = document.createElement('p');
  const bar = document.createElement('span');
  const fill = document.createElement('span');
  const barLabel = document.createElement('span');

  el.className = `scene-deck__card scene-deck__card--${index}`;
  el.style.setProperty('--deck-x', `${card.x}px`);
  el.style.setProperty('--deck-y', `${card.y}px`);
  el.style.setProperty('--deck-rotation', `${card.rotation}deg`);

  accent.className = 'scene-deck__accent';
  accent.setAttribute('aria-hidden', 'true');

  row.className = 'scene-deck__row';
  id.className = 'scene-deck__id';
  id.textContent = card.id;
  badge.className = `scene-deck__badge scene-deck__badge--${card.badgeCls}`;
  badge.textContent = card.status;
  upd.className = 'scene-deck__upd';
  upd.textContent = card.upd;
  row.append(id, badge, upd);

  body.className = 'scene-deck__body';
  role.className = 'scene-deck__role';
  role.textContent = card.role;
  company.className = 'scene-deck__company';
  company.textContent = card.company;
  body.append(role, company);

  bar.className = 'scene-deck__bar';
  fill.className = `scene-deck__bar-fill scene-deck__bar-fill--${compatClass(card.compat)}`;
  fill.style.width = `${card.compat}%`;
  barLabel.className = 'scene-deck__bar-label';
  barLabel.textContent = `${card.compat}% compat`;
  bar.append(fill, barLabel);

  el.append(accent, row, body, bar);
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
