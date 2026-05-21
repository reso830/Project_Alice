// Scene 2 — Pipeline animation (`ScenePipeline`)
// docs/design/welcome_page.md §4.4
//
// Single straight preview card ("J024 · UX Engineer · Vertex AI", compat 94).
// Status cycles applied → phone_screen → interview → assessment → offer every
// 1100ms. Each stage swap re-keys the badge so the .scene-pipeline__badge
// CSS keyframe (`pipeline-badge`, 0.55s pop-in) plays.
// prefers-reduced-motion → render the final status statically, no setInterval.

let _state = null;

const STATUSES = ['applied', 'phone_screen', 'interview', 'assessment', 'offer'];
const STAGE_MS = 1100;

function prefersReducedMotion() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  try {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

function buildBadge(status) {
  const badge = document.createElement('span');
  badge.className = `scene-pipeline__badge scene-pipeline__badge--${status}`;
  badge.dataset.status = status;
  badge.textContent = status.replace('_', ' ');
  return badge;
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
  compat.textContent = '94 fit';

  foot.append(compat);
  card.append(eyebrow, role, company, foot);
  return { card, foot };
}

export function mount(container, { variant = 'default' } = {}) {
  unmount();
  const reduced = prefersReducedMotion();

  const root = document.createElement('div');
  root.className = `scene-pipeline scene-pipeline--${variant}`;
  root.dataset.variant = variant;

  const { card, foot } = buildCard();
  let statusIndex = reduced ? STATUSES.length - 1 : 0;
  let badge = buildBadge(STATUSES[statusIndex]);
  foot.append(badge);

  root.append(card);
  container.append(root);

  let interval = null;
  if (!reduced) {
    interval = globalThis.setInterval(() => {
      statusIndex = (statusIndex + 1) % STATUSES.length;
      const next = buildBadge(STATUSES[statusIndex]);
      badge.replaceWith(next);
      badge = next;
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
