const SVG_NS = 'http://www.w3.org/2000/svg';

const TABS = [
  { id: 'tracker', label: 'Tracker', icon: createTrackerIcon },
  { id: 'calendar', label: 'Calendar', icon: createCalendarIcon },
  { id: 'profile', label: 'Profile', icon: createProfileIcon },
];

let _root = null;
let _updateStatus = 'idle';

function badgeTone(status) {
  if (status === 'ready-to-restart') return 'ready';
  if (['available', 'downloading', 'fetching', 'verifying', 'extracting'].includes(status)) return 'active';
  return null;
}

function svgBase() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'bottom-tab__icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

function strokePath(d) {
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  return path;
}

function createTrackerIcon() {
  // List / clipboard glyph — rect outline with three horizontal rules.
  const svg = svgBase();
  const frame = document.createElementNS(SVG_NS, 'rect');
  frame.setAttribute('x', '4');
  frame.setAttribute('y', '4');
  frame.setAttribute('width', '16');
  frame.setAttribute('height', '16');
  frame.setAttribute('rx', '2');
  frame.setAttribute('fill', 'none');
  frame.setAttribute('stroke', 'currentColor');
  frame.setAttribute('stroke-width', '2');
  svg.append(frame, strokePath('M8 9h8'), strokePath('M8 13h8'), strokePath('M8 17h5'));
  return svg;
}

function createCalendarIcon() {
  // Month-grid glyph — rect with header rule and tick marks.
  const svg = svgBase();
  const frame = document.createElementNS(SVG_NS, 'rect');
  frame.setAttribute('x', '4');
  frame.setAttribute('y', '5');
  frame.setAttribute('width', '16');
  frame.setAttribute('height', '15');
  frame.setAttribute('rx', '2');
  frame.setAttribute('fill', 'none');
  frame.setAttribute('stroke', 'currentColor');
  frame.setAttribute('stroke-width', '2');
  svg.append(
    frame,
    strokePath('M4 10h16'),
    strokePath('M8 3v4'),
    strokePath('M16 3v4'),
  );
  return svg;
}

function createProfileIcon() {
  // Person glyph — circle head + shoulders arc.
  const svg = svgBase();
  const head = document.createElementNS(SVG_NS, 'circle');
  head.setAttribute('cx', '12');
  head.setAttribute('cy', '8');
  head.setAttribute('r', '3.5');
  head.setAttribute('fill', 'none');
  head.setAttribute('stroke', 'currentColor');
  head.setAttribute('stroke-width', '2');
  svg.append(head, strokePath('M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7'));
  return svg;
}

export function render({ onSelect } = {}) {
  destroy();

  const nav = document.createElement('nav');
  nav.className = 'bottom-tab-bar';
  nav.setAttribute('aria-label', 'Primary navigation');

  for (const tab of TABS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bottom-tab';
    button.dataset.page = tab.id;
    button.setAttribute('aria-label', tab.label);

    const icon = tab.icon();
    const label = document.createElement('span');
    label.className = 'bottom-tab__label';
    label.textContent = tab.label;

    button.append(icon, label);

    if (typeof onSelect === 'function') {
      button.addEventListener('click', () => onSelect(tab.id));
    }

    nav.append(button);
  }

  _root = nav;
  setUpdateStatus(_updateStatus);
  return nav;
}

export function setActive(page) {
  if (!_root) {
    return;
  }
  for (const button of _root.querySelectorAll('.bottom-tab')) {
    button.classList.toggle('bottom-tab--active', button.dataset.page === page);
  }
}

export function setUpdateStatus(status) {
  _updateStatus = status;
  if (!_root) {
    return;
  }

  const profile = _root.querySelector('.bottom-tab[data-page="profile"]');
  if (!profile) {
    return;
  }

  profile.querySelector('.bottom-tab__update-badge')?.remove();
  const tone = badgeTone(status);
  profile.classList.toggle('bottom-tab--update', Boolean(tone));
  profile.classList.toggle('bottom-tab--update-ready', tone === 'ready');
  if (!tone) {
    return;
  }

  const badge = document.createElement('span');
  badge.className = `bottom-tab__update-badge bottom-tab__update-badge--${tone}`;
  badge.setAttribute('aria-label', 'Update available');
  profile.append(badge);
}

export function destroy() {
  _root = null;
}

export const BottomTabBar = { render, setActive, setUpdateStatus, destroy };
