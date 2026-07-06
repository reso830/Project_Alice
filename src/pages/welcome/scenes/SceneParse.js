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

function buildSpark(index, total) {
  const spark = document.createElement('span');
  spark.className = 'scene-parse__spark';
  // Evenly distributed around a full circle with a little jitter, so the
  // stars fan out radially all at once (not a staggered spiral).
  const angle = (Math.PI * 2 * index) / total + (Math.random() * 0.4 - 0.2);
  const dist = 100 + Math.random() * 120;
  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist * 0.8;
  const size = 12 + Math.random() * 18;
  const rot = Math.random() * 160 - 80;
  const dur = 0.65 + Math.random() * 0.4;
  spark.style.setProperty('--spark-dx', `${dx.toFixed(0)}px`);
  spark.style.setProperty('--spark-dy', `${dy.toFixed(0)}px`);
  spark.style.setProperty('--spark-rot', `${rot.toFixed(0)}deg`);
  spark.style.setProperty('--spark-size', `${size.toFixed(0)}px`);
  spark.style.setProperty('--spark-dur', `${dur.toFixed(2)}s`);
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
    burst.append(buildSpark(i, 22));
  }
  wrap.append(pasteWindow, spinner, burst, card);
  root.append(wrap);
  container.append(root);

  if (!animate) {
    root.classList.add('is-settled');
  } else {
    // Phased: scan → window shrinks/fades + spinner spins → card pops + burst.
    timers.push(setTimeout(() => root.classList.add('is-scanned'), 420));
    timers.push(setTimeout(() => root.classList.add('is-shrunk'), 1550));
    timers.push(setTimeout(() => root.classList.add('is-parsed'), 2750));
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
