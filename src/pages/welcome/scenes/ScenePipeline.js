// Scene 3 - Pipeline: a tracker card whose badge walks the hiring stages.

let _state = null;

const STATUSES = [
  { key: 'applied', label: 'Applied' },
  { key: 'phone_screen', label: 'Phone Screen' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
];
const STAGE_MS = 1150;

function prefersReducedMotion() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  try {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

function effectiveMotion(motion) {
  return motion !== undefined ? motion : !prefersReducedMotion();
}

function buildBadge(status) {
  const badge = document.createElement('span');
  badge.className = `scene-pipeline__badge scene-pipeline__badge--${status.key}`;
  badge.dataset.status = status.key;
  badge.textContent = status.label;
  return badge;
}

function buildTrack(activeIndex) {
  const track = document.createElement('div');
  track.className = 'scene-pipeline__track';
  STATUSES.forEach((status, index) => {
    const node = document.createElement('span');
    node.className = [
      'scene-pipeline__node',
      index <= activeIndex ? 'is-done' : '',
      index === activeIndex ? 'is-current' : '',
    ].filter(Boolean).join(' ');
    node.dataset.status = status.key;
    track.append(node);
  });
  return track;
}

function buildCard() {
  const card = document.createElement('div');
  card.className = 'scene-pipeline__card';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'scene-pipeline__eyebrow';
  eyebrow.textContent = 'J024';

  const role = document.createElement('p');
  role.className = 'scene-pipeline__role';
  role.textContent = 'UX Engineer';

  const company = document.createElement('p');
  company.className = 'scene-pipeline__company';
  company.textContent = 'Vertex AI';

  const foot = document.createElement('div');
  foot.className = 'scene-pipeline__foot';

  const compat = document.createElement('span');
  compat.className = 'scene-pipeline__compat';
  compat.textContent = '88% compat';

  foot.append(compat);
  card.append(eyebrow, role, company, foot);
  return { card, foot };
}

function updateTrack(root, activeIndex) {
  root.querySelector('.scene-pipeline__track')?.replaceWith(buildTrack(activeIndex));
}

export function mount(container, { variant = 'default', motion } = {}) {
  unmount();
  const animate = effectiveMotion(motion);

  const root = document.createElement('div');
  root.className = `scene-pipeline scene-pipeline--${variant}`;
  root.dataset.variant = variant;

  const { card, foot } = buildCard();
  let statusIndex = 0;
  let badge = buildBadge(STATUSES[statusIndex]);
  foot.append(badge);

  root.append(buildTrack(statusIndex), card);
  container.append(root);

  let interval = null;
  if (animate) {
    interval = globalThis.setInterval(() => {
      statusIndex = (statusIndex + 1) % STATUSES.length;
      const next = buildBadge(STATUSES[statusIndex]);
      badge.replaceWith(next);
      badge = next;
      updateTrack(root, statusIndex);
    }, STAGE_MS);
  }

  _state = { root, interval };
}

export function unmount() {
  if (!_state) return;
  if (_state.interval) globalThis.clearInterval(_state.interval);
  _state.root.remove();
  _state = null;
}

export const ScenePipeline = { mount, unmount };
