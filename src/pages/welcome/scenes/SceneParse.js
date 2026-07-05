// Scene 2 - Parse: pasted posting window scans into an auto-filled card.

let _state = null;

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

function buildPasteWindow() {
  const windowEl = document.createElement('div');
  windowEl.className = 'scene-parse__window';
  windowEl.innerHTML = `
    <div class="scene-parse__window-head"><span></span><span></span><span></span><b>pasted job post</b></div>
    <p class="scene-parse__title">Product Designer</p>
    <p class="scene-parse__meta">Northwind Labs · Remote</p>
    <span class="scene-parse__line scene-parse__line--long"></span>
    <span class="scene-parse__line"></span>
    <span class="scene-parse__line scene-parse__line--short"></span>
    <span class="scene-parse__line scene-parse__line--mid"></span>
    <span class="scene-parse__beam"></span>
  `;
  return windowEl;
}

function buildCard() {
  const card = document.createElement('div');
  card.className = 'scene-parse__card';
  card.innerHTML = `
    <span class="scene-parse__tag">Auto-filled</span>
    <p class="scene-parse__card-title">Product Designer</p>
    <p class="scene-parse__card-meta">Northwind Labs · Remote</p>
    <div class="scene-parse__chips">
      <span>$110k-$130k</span>
      <span>Figma</span>
      <span>Design Systems</span>
    </div>
  `;
  return card;
}

function buildSpark(index) {
  const spark = document.createElement('span');
  spark.className = 'scene-parse__spark';
  spark.style.setProperty('--spark-angle', `${index * 16}deg`);
  spark.style.setProperty('--spark-delay', `${index * 18}ms`);
  spark.setAttribute('aria-hidden', 'true');
  const svgns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  const path = document.createElementNS(svgns, 'path');
  path.setAttribute('d', 'M12 1.5c.8 6.4 3.1 8.7 9.5 9.5-6.4.8-8.7 3.1-9.5 9.5-.8-6.4-3.1-8.7-9.5-9.5 6.4-.8 8.7-3.1 9.5-9.5Z');
  svg.append(path);
  spark.append(svg);
  return spark;
}

export function mount(container, { variant = 'default', motion } = {}) {
  unmount();
  const animate = effectiveMotion(motion);
  const root = document.createElement('div');
  const wrap = document.createElement('div');
  const pasteWindow = buildPasteWindow();
  const card = buildCard();
  const burst = document.createElement('div');
  const spinner = document.createElement('div');
  const timers = [];

  root.className = `scene-parse scene-parse--${variant}`;
  root.dataset.variant = variant;
  wrap.className = 'scene-parse__wrap';
  spinner.className = 'scene-parse__spinner';
  spinner.setAttribute('aria-hidden', 'true');
  burst.className = 'scene-parse__burst';
  for (let i = 0; i < 22; i += 1) {
    burst.append(buildSpark(i));
  }
  wrap.append(pasteWindow, spinner, burst, card);
  root.append(wrap);
  container.append(root);

  if (!animate) {
    root.classList.add('is-settled');
  } else {
    timers.push(setTimeout(() => root.classList.add('is-scanned'), 520));
    timers.push(setTimeout(() => root.classList.add('is-parsed'), 1800));
  }

  _state = { root, timers };
}

export function unmount() {
  if (!_state) return;
  _state.timers.forEach((timer) => clearTimeout(timer));
  _state.root.remove();
  _state = null;
}

export const SceneParse = { mount, unmount };
