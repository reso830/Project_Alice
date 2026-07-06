// Scene 3 - Pipeline: a tracker card whose status badge walks the hiring stages.

import { buildBadge, buildTrackerCard } from './trackerCard.js';

let _state = null;

const STAGES = [
  { key: 'applied', status: 'Applied', badgeCls: 'applied' },
  { key: 'phone_screen', status: 'Phone Screen', badgeCls: 'phone' },
  { key: 'interview', status: 'Interview', badgeCls: 'interview' },
  { key: 'offer', status: 'Offer', badgeCls: 'offer' },
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

// Pipeline reuses the shared badge but tags it for the cycle logic + tests.
function pipelineBadge(stage) {
  const badge = buildBadge(stage.status, stage.badgeCls);
  badge.classList.add('scene-pipeline__badge');
  badge.dataset.status = stage.key;
  return badge;
}

function buildTrack(activeIndex) {
  const track = document.createElement('div');
  track.className = 'scene-pipeline__track';
  STAGES.forEach((stage, index) => {
    const node = document.createElement('span');
    node.className = [
      'scene-pipeline__node',
      index <= activeIndex ? 'is-done' : '',
      index === activeIndex ? 'is-current' : '',
    ].filter(Boolean).join(' ');
    node.dataset.status = stage.key;
    track.append(node);
  });
  return track;
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

  let statusIndex = 0;
  const { card, badge: cardBadge } = buildTrackerCard({
    id: 'J024',
    status: STAGES[statusIndex].status,
    badgeCls: STAGES[statusIndex].badgeCls,
    upd: 'Just now',
    role: 'UX Engineer',
    company: 'Vertex AI',
    compat: 88,
  });
  card.classList.add('scene-pipeline__card');
  // Swap the shared card's badge for a pipeline-tagged one (drives the cycle).
  let badge = pipelineBadge(STAGES[statusIndex]);
  cardBadge.replaceWith(badge);

  root.append(buildTrack(statusIndex), card);
  container.append(root);

  let interval = null;
  if (animate) {
    interval = globalThis.setInterval(() => {
      statusIndex = (statusIndex + 1) % STAGES.length;
      const next = pipelineBadge(STAGES[statusIndex]);
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
