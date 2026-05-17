// Scene 1 — Tilted card stack (`SceneStack`)
// design/welcome_page.md §4.4
//
// `default` (diagonal/split/hero): 4 tilted preview cards, rotation -4°→+4°,
// ghost opacities 42% / 100% / 100% / 55%, 90ms stagger enter from
// scale(.55) opacity(0) via cubic-bezier(.2,.7,.3,1.05).
// `centered` (tablet): 2 flat cards in a row, no rotation, no ghosting.
// prefers-reduced-motion → final/static state, no JS timers.

let _state = null;

function prefersReducedMotion() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  try {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

const CARDS = [
  { id: 'C014', role: 'Frontend Engineer', company: 'Acme Labs', compat: 92, status: 'phone_screen' },
  { id: 'C019', role: 'Product Designer', company: 'Nimbus', compat: 88, status: 'applied' },
  { id: 'C022', role: 'Project Manager', company: 'Helix Co.', compat: 84, status: 'interview' },
  { id: 'C027', role: 'UX Researcher', company: 'Sigma', compat: 80, status: 'assessment' },
];

const ROTATIONS = [-4, -1.5, 1.5, 4];
const OPACITIES = [1, 1, 1, 1];

function buildCard(card, rotation, opacity, indexClass) {
  const el = document.createElement('div');
  el.className = `scene-stack__card scene-stack__card--${indexClass}`;
  el.style.setProperty('--scene-stack-rotation', `${rotation}deg`);
  el.style.setProperty('--scene-stack-opacity', String(opacity));

  const eyebrow = document.createElement('span');
  eyebrow.className = 'scene-stack__card-eyebrow';
  eyebrow.textContent = card.id;
  const role = document.createElement('p');
  role.className = 'scene-stack__card-role';
  role.textContent = card.role;
  const company = document.createElement('p');
  company.className = 'scene-stack__card-company';
  company.textContent = card.company;
  const foot = document.createElement('div');
  foot.className = 'scene-stack__card-foot';
  const compat = document.createElement('span');
  compat.className = 'scene-stack__card-compat';
  compat.textContent = `${card.compat} fit`;
  const status = document.createElement('span');
  status.className = `scene-stack__card-status scene-stack__card-status--${card.status}`;
  status.textContent = card.status.replace('_', ' ');
  foot.append(compat, status);

  el.append(eyebrow, role, company, foot);
  return el;
}

export function mount(container, { variant = 'default' } = {}) {
  unmount();
  const reduced = prefersReducedMotion();
  const isCentered = variant === 'centered';

  const root = document.createElement('div');
  root.className = `scene-stack scene-stack--${variant}`;
  root.dataset.variant = variant;

  const cards = isCentered ? CARDS.slice(0, 2) : CARDS;
  const timers = [];

  cards.forEach((card, i) => {
    const rotation = isCentered ? 0 : ROTATIONS[i];
    const opacity = isCentered ? 1 : OPACITIES[i];
    const cardEl = buildCard(card, rotation, opacity, String(i));
    if (!reduced && !isCentered) {
      cardEl.classList.add('scene-stack__card--entering');
      const t = setTimeout(() => {
        cardEl.classList.remove('scene-stack__card--entering');
        const idx = timers.indexOf(t);
        if (idx !== -1) timers.splice(idx, 1);
      }, i * 90 + 20);
      timers.push(t);
    }
    root.append(cardEl);
  });

  container.append(root);
  _state = { root, timers };
}

export function unmount() {
  if (!_state) return;
  _state.timers.forEach((t) => clearTimeout(t));
  _state.timers = [];
  _state.root.remove();
  _state = null;
}

export const SceneStack = { mount, unmount };
