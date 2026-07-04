// Scene 4 - Momentum: stat chips plus an animated donut growth moment.

let _state = null;

const INITIAL = [
  { key: 'applied', label: 'Applied', value: 9, color: '#60A5FA' },
  { key: 'interview', label: 'Interview', value: 2, color: '#FBBF24' },
  { key: 'offer', label: 'Offer', value: 0, color: '#4ADE80' },
  { key: 'rejected', label: 'Rejected', value: 2, color: '#F87171' },
  { key: 'ghosted', label: 'Ghosted', value: 2, color: '#94A3B8' },
];

const GROWN = [
  { key: 'applied', label: 'Applied', value: 19, color: '#60A5FA' },
  { key: 'interview', label: 'Interview', value: 8, color: '#FBBF24' },
  { key: 'offer', label: 'Offer', value: 3, color: '#4ADE80' },
  { key: 'rejected', label: 'Rejected', value: 3, color: '#F87171' },
  { key: 'ghosted', label: 'Ghosted', value: 3, color: '#94A3B8' },
];

const SWAP_MS = 2500;
const SIZE = 150;
const RADIUS = 65;
const CIRC = 2 * Math.PI * RADIUS;

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

function sum(data) {
  return data.reduce((total, item) => total + item.value, 0);
}

function paintDonut(group, data) {
  const total = sum(data) || 1;
  let offset = 0;
  group.replaceChildren(...data.map((item, index) => {
    const length = (item.value / total) * CIRC;
    const segment = svgEl('circle');
    segment.classList.add('scene-momentum__segment');
    segment.dataset.segment = item.key;
    segment.setAttribute('cx', String(SIZE / 2));
    segment.setAttribute('cy', String(SIZE / 2));
    segment.setAttribute('r', String(RADIUS));
    segment.setAttribute('fill', 'none');
    segment.setAttribute('stroke', item.color);
    segment.setAttribute('stroke-width', '18');
    segment.setAttribute('stroke-dasharray', `${length.toFixed(2)} ${(CIRC - length).toFixed(2)}`);
    segment.setAttribute('stroke-dashoffset', String((-offset).toFixed(2)));
    segment.style.setProperty('--segment-delay', `${index * 120}ms`);
    offset += length;
    return segment;
  }));
}

function renderChips(root, data) {
  root.querySelector('.scene-momentum__chips')?.replaceChildren(...data.map((item) => {
    const chip = document.createElement('div');
    const label = document.createElement('span');
    const value = document.createElement('span');

    chip.className = 'scene-momentum__chip';
    chip.dataset.stat = item.key;
    label.className = 'scene-momentum__chip-label';
    label.textContent = item.label;
    value.className = 'scene-momentum__chip-value';
    value.style.color = item.color;
    value.textContent = String(item.value);
    chip.append(label, value);
    return chip;
  }));
  root.querySelector('.scene-momentum__total-value').textContent = String(sum(data));
}

export function mount(container, { variant = 'default', motion } = {}) {
  unmount();
  const animate = effectiveMotion(motion);
  const root = document.createElement('div');
  const chips = document.createElement('div');
  const donutWrap = document.createElement('div');
  const svg = svgEl('svg');
  const track = svgEl('circle');
  const segments = svgEl('g');
  const total = document.createElement('div');
  const value = document.createElement('span');
  const label = document.createElement('span');
  const timers = [];

  root.className = `scene-momentum scene-momentum--${variant}`;
  root.dataset.variant = variant;
  chips.className = 'scene-momentum__chips';
  donutWrap.className = 'scene-momentum__donut';
  svg.classList.add('scene-momentum__svg');
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('aria-hidden', 'true');
  track.classList.add('scene-momentum__track');
  track.setAttribute('cx', String(SIZE / 2));
  track.setAttribute('cy', String(SIZE / 2));
  track.setAttribute('r', String(RADIUS));
  track.setAttribute('fill', 'none');
  segments.classList.add('scene-momentum__segments');
  segments.setAttribute('transform', `rotate(-90 ${SIZE / 2} ${SIZE / 2})`);
  total.className = 'scene-momentum__total';
  value.className = 'scene-momentum__total-value';
  label.className = 'scene-momentum__total-label';
  label.textContent = 'tracked';
  total.append(value, label);
  svg.append(track, segments);
  donutWrap.append(svg, total);
  root.append(chips, donutWrap);

  paintDonut(segments, animate ? INITIAL : GROWN);
  renderChips(root, animate ? INITIAL : GROWN);
  container.append(root);

  if (animate) {
    timers.push(setTimeout(() => {
      paintDonut(segments, GROWN);
      renderChips(root, GROWN);
    }, SWAP_MS));
  }

  _state = { root, timers };
}

export function unmount() {
  if (!_state) return;
  _state.timers.forEach((timer) => clearTimeout(timer));
  _state.root.remove();
  _state = null;
}

export const SceneMomentum = { mount, unmount };
