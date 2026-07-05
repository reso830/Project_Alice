// Scene 1 - Constellation: pipeline statuses plotted as a glowing path.

let _state = null;

const STATUSES = [
  { key: 'wishlisted', label: 'Wishlisted', color: '#ffafcc', x: 8, y: 88 },
  { key: 'applied', label: 'Applied', color: '#60A5FA', x: 23, y: 78 },
  { key: 'phone', label: 'Phone', color: '#F2B544', x: 38, y: 65 },
  { key: 'interview', label: 'Interview', color: '#FBBF24', x: 54, y: 50 },
  { key: 'technical', label: 'Technical', color: '#A78BFA', x: 69, y: 32 },
  { key: 'offer', label: 'Offer', color: '#4ADE80', x: 83, y: 16 },
  { key: 'accepted', label: 'Accepted', color: '#2EC4B6', x: 94, y: 8, bright: true },
];

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

function svgEl(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

function createStar(status, index, motion) {
  const group = svgEl('g');
  group.classList.add('scene-constellation__node');
  if (status.bright) group.classList.add('scene-constellation__node--bright');
  group.dataset.status = status.key;
  group.style.setProperty('--node-color', status.color);
  group.style.setProperty('--node-delay', `${index * 180}ms`);

  // The end node (Accepted) is emphasised — a larger star than the rest.
  const scale = status.bright ? 0.34 : 0.22;
  const offset = (12 * scale).toFixed(2);
  const star = svgEl('path');
  star.classList.add('scene-constellation__star');
  star.setAttribute('d', 'M12 1.5c.8 6.4 3.1 8.7 9.5 9.5-6.4.8-8.7 3.1-9.5 9.5-.8-6.4-3.1-8.7-9.5-9.5 6.4-.8 8.7-3.1 9.5-9.5Z');
  star.setAttribute('transform', `translate(${status.x - offset} ${status.y - offset}) scale(${scale})`);
  star.setAttribute('fill', status.color);

  const label = svgEl('text');
  label.classList.add('scene-constellation__label');
  label.setAttribute('x', String(status.x));
  label.setAttribute('y', String(status.y + (index % 2 ? -7 : 8)));
  label.setAttribute('text-anchor', 'middle');
  label.textContent = status.label.toUpperCase();

  if (!motion) {
    group.classList.add('is-settled');
  }
  group.append(star, label);
  return group;
}

export function mount(container, { variant = 'default', motion } = {}) {
  unmount();
  const animate = effectiveMotion(motion);
  const root = document.createElement('div');
  const svg = svgEl('svg');
  const lineGroup = svgEl('g');
  const nodeGroup = svgEl('g');

  root.className = `scene-constellation scene-constellation--${variant}`;
  root.dataset.variant = variant;
  svg.classList.add('scene-constellation__svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  lineGroup.classList.add('scene-constellation__lines');
  nodeGroup.classList.add('scene-constellation__nodes');

  STATUSES.slice(0, -1).forEach((status, index) => {
    const next = STATUSES[index + 1];
    const line = svgEl('line');
    line.classList.add('scene-constellation__line');
    line.setAttribute('x1', String(status.x));
    line.setAttribute('y1', String(status.y));
    line.setAttribute('x2', String(next.x));
    line.setAttribute('y2', String(next.y));
    line.style.setProperty('--line-delay', `${260 + index * 260}ms`);
    if (!animate) {
      line.classList.add('is-settled');
    }
    lineGroup.append(line);
  });

  STATUSES.forEach((status, index) => {
    nodeGroup.append(createStar(status, index, animate));
  });

  svg.append(lineGroup, nodeGroup);
  root.append(svg);
  container.append(root);
  _state = { root };
}

export function unmount() {
  if (!_state) return;
  _state.root.remove();
  _state = null;
}

export const SceneConstellation = { mount, unmount };
