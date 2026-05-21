// Scene 3 — Profile donut (`SceneProfile`)
// docs/design/welcome_page.md §4.4
//
// Flex column with generous default spacing; centered/tablet is compacted in CSS.
// Top row: 4 stat chips. Bottom row: donut plus 2-column legend.
// Donut animates 0 → strokeDasharray over 0.7s (CSS transition); at 2700ms
// the DONUT_INITIAL → DONUT_AFTER swap re-allocates segments and ticks
// chip numbers via cubic ease-out.
// prefers-reduced-motion → render final state directly, no setTimeout.

let _state = null;

const DONUT_INITIAL = [
  { key: 'applied', label: 'Applied', value: 12, color: '#4F46E5' },
  { key: 'interview', label: 'Interview', value: 6, color: '#818CF8' },
  { key: 'offered', label: 'Offered', value: 2, color: '#F2B544' },
  { key: 'rejected', label: 'Rejected', value: 8, color: '#9CA3AF' },
];

const DONUT_AFTER = [
  { key: 'applied', label: 'Applied', value: 10, color: '#4F46E5' },
  { key: 'interview', label: 'Interview', value: 8, color: '#818CF8' },
  { key: 'offered', label: 'Offered', value: 4, color: '#F2B544' },
  { key: 'rejected', label: 'Rejected', value: 6, color: '#9CA3AF' },
];

const SWAP_MS = 2700;
const TICK_MS = 700;
const DONUT_VIEWBOX = 168;
const DONUT_RADIUS = 73;
const DONUT_CIRC = 2 * Math.PI * DONUT_RADIUS;

function prefersReducedMotion() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  try {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

function computeStats(donut) {
  const total = donut.reduce((s, d) => s + d.value, 0);
  return {
    total,
    active: donut[0].value + donut[1].value,
    pending: donut[1].value,
    offer: donut[2].value,
  };
}

function paintDonut(svgGroup, donut) {
  const total = donut.reduce((s, d) => s + d.value, 0) || 1;
  let offset = 0;
  const segments = donut.map((d) => {
    const fraction = d.value / total;
    const length = fraction * DONUT_CIRC;
    const seg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    seg.classList.add('scene-profile__donut-segment');
    seg.dataset.segment = d.key;
    seg.setAttribute('cx', String(DONUT_VIEWBOX / 2));
    seg.setAttribute('cy', String(DONUT_VIEWBOX / 2));
    seg.setAttribute('r', String(DONUT_RADIUS));
    seg.setAttribute('fill', 'none');
    seg.setAttribute('stroke', d.color);
    seg.setAttribute('stroke-width', '22');
    seg.setAttribute('stroke-linecap', 'butt');
    seg.setAttribute('stroke-dasharray', `${length.toFixed(2)} ${(DONUT_CIRC - length).toFixed(2)}`);
    seg.setAttribute('stroke-dashoffset', String((-offset).toFixed(2)));
    seg.style.setProperty('--scene-profile-segment-delay', `${donut.indexOf(d) * 120}ms`);
    offset += length;
    return seg;
  });
  svgGroup.replaceChildren(...segments);
}

function paintLegend(legendEl, donut) {
  const rows = donut.map((d) => {
    const row = document.createElement('div');
    row.className = 'scene-profile__legend-row';
    row.dataset.segment = d.key;
    const dot = document.createElement('span');
    dot.className = 'scene-profile__legend-dot';
    dot.style.background = d.color;
    const label = document.createElement('span');
    label.className = 'scene-profile__legend-label';
    label.textContent = d.label;
    const value = document.createElement('span');
    value.className = 'scene-profile__legend-value';
    value.dataset.legendValue = d.key;
    value.textContent = String(d.value);
    row.append(dot, label, value);
    return row;
  });
  legendEl.replaceChildren(...rows);
}

function buildChips(stats) {
  const wrap = document.createElement('div');
  wrap.className = 'scene-profile__chips';
  const items = [
    ['total', 'Total'],
    ['active', 'Active'],
    ['pending', 'Pending'],
    ['offer', 'Offer'],
  ];
  items.forEach(([key, label]) => {
    const chip = document.createElement('div');
    chip.className = 'scene-profile__chip';
    chip.dataset.stat = key;
    const lbl = document.createElement('span');
    lbl.className = 'scene-profile__chip-label';
    lbl.textContent = label;
    const val = document.createElement('span');
    val.className = 'scene-profile__chip-value';
    val.dataset.statValue = key;
    val.textContent = String(stats[key]);
    chip.append(lbl, val);
    wrap.append(chip);
  });
  return wrap;
}

function setChipValues(root, stats) {
  Object.entries(stats).forEach(([key, val]) => {
    const el = root.querySelector(`[data-stat-value="${key}"]`);
    if (el) el.textContent = String(val);
  });
}

export function mount(container, { variant = 'default' } = {}) {
  unmount();
  const reduced = prefersReducedMotion();

  const root = document.createElement('div');
  root.className = `scene-profile scene-profile--${variant}`;
  root.dataset.variant = variant;

  const startDonut = reduced ? DONUT_AFTER : DONUT_INITIAL;
  const startStats = computeStats(startDonut);

  const chips = buildChips(startStats);

  const bottom = document.createElement('div');
  bottom.className = 'scene-profile__bottom';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('scene-profile__donut');
  svg.setAttribute('viewBox', `0 0 ${DONUT_VIEWBOX} ${DONUT_VIEWBOX}`);
  svg.setAttribute('width', String(DONUT_VIEWBOX));
  svg.setAttribute('height', String(DONUT_VIEWBOX));
  svg.setAttribute('aria-hidden', 'true');

  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.classList.add('scene-profile__donut-track');
  track.setAttribute('cx', String(DONUT_VIEWBOX / 2));
  track.setAttribute('cy', String(DONUT_VIEWBOX / 2));
  track.setAttribute('r', String(DONUT_RADIUS));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'rgba(255,255,255,.08)');
  track.setAttribute('stroke-width', '22');

  const segGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  segGroup.classList.add('scene-profile__donut-segments');
  segGroup.dataset.donutSegments = '';
  segGroup.setAttribute('transform', `rotate(-90 ${DONUT_VIEWBOX / 2} ${DONUT_VIEWBOX / 2})`);
  paintDonut(segGroup, startDonut);

  svg.append(track, segGroup);

  const legend = document.createElement('div');
  legend.className = 'scene-profile__legend';
  legend.dataset.legend = '';
  paintLegend(legend, startDonut);

  bottom.append(svg, legend);
  root.append(chips, bottom);
  container.append(root);

  const timers = [];
  let tickInterval = null;

  if (!reduced) {
    const swapTimer = setTimeout(() => {
      paintDonut(segGroup, DONUT_AFTER);
      paintLegend(legend, DONUT_AFTER);
      // Tween chip numbers from initial → after over TICK_MS using setInterval
      // (kept under fake-timers control; cleaned up on unmount or completion).
      const before = computeStats(DONUT_INITIAL);
      const after = computeStats(DONUT_AFTER);
      const startedAt = Date.now();
      tickInterval = globalThis.setInterval(() => {
        const t = Math.min(1, (Date.now() - startedAt) / TICK_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        setChipValues(root, {
          total: Math.round(before.total + (after.total - before.total) * eased),
          active: Math.round(before.active + (after.active - before.active) * eased),
          pending: Math.round(before.pending + (after.pending - before.pending) * eased),
          offer: Math.round(before.offer + (after.offer - before.offer) * eased),
        });
        if (t >= 1 && tickInterval) {
          globalThis.clearInterval(tickInterval);
          tickInterval = null;
          setChipValues(root, after);
        }
      }, 50);
      const idx = timers.indexOf(swapTimer);
      if (idx !== -1) timers.splice(idx, 1);
    }, SWAP_MS);
    timers.push(swapTimer);
  }

  _state = { root, timers, getTickInterval: () => tickInterval, clearTick: () => {
    if (tickInterval) {
      globalThis.clearInterval(tickInterval);
      tickInterval = null;
    }
  } };
}

export function unmount() {
  if (!_state) return;
  _state.timers.forEach((t) => clearTimeout(t));
  _state.clearTick();
  _state.root.remove();
  _state = null;
}

export const SceneProfile = { mount, unmount };
