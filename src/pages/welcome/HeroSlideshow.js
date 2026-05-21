// Hero slideshow — docs/design/welcome_page.md §4.4
//
// Replaces the 6-screenshot rotation with a 4-scene cycler (stack → pipeline
// → profile → logo). 5500ms per scene, 700ms cross-fade between layers, 4
// bottom dots whose active dot shows a 0→1 progress bar matching scene
// duration. Click a dot to jump (and reset the rotation cadence).
//
// `heroScene` prop:
//   - 'auto' (default): rotates all 4 scenes, renders dots + progress bar.
//   - 'stack' | 'pipeline' | 'profile' | 'logo': pins to that scene, no
//     rotation, no dots.
//
// prefers-reduced-motion → renders scene 1 (`stack`) statically, no dots,
// no progress bar, no JS timers. Scenes themselves also bypass internal
// animations under reduced-motion.

import { SceneStack } from './scenes/SceneStack.js';
import { ScenePipeline } from './scenes/ScenePipeline.js';
import { SceneProfile } from './scenes/SceneProfile.js';
import { SceneLogo } from './scenes/SceneLogo.js';

const SCENE_NAMES = ['stack', 'pipeline', 'profile', 'logo'];
const SCENE_MODULES = {
  stack: SceneStack,
  pipeline: ScenePipeline,
  profile: SceneProfile,
  logo: SceneLogo,
};
const ROTATION_MS = 5500;
const FADE_MS = 700;

let _state = null;

function prefersReducedMotion() {
  if (typeof globalThis.matchMedia !== 'function') return false;
  try {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

function unmountLayer(state, layerIdx) {
  const mod = state.mountedModules[layerIdx];
  if (mod) {
    try {
      mod.unmount();
    } catch {
      // best-effort
    }
  }
  state.mountedModules[layerIdx] = null;
  state.layers[layerIdx].replaceChildren();
  delete state.layers[layerIdx].dataset.scene;
}

function mountSceneIntoLayer(state, layerIdx, sceneName) {
  const mod = SCENE_MODULES[sceneName];
  state.layers[layerIdx].dataset.scene = sceneName;
  mod.mount(state.layers[layerIdx], { variant: state.variant });
  state.mountedModules[layerIdx] = mod;
}

function setActiveDot(state, idx) {
  state.dots.forEach((dot, i) => {
    const progress = dot.querySelector('.hero-slideshow__dot-progress');
    if (i === idx) {
      dot.classList.add('hero-slideshow__dot--active');
      dot.setAttribute('aria-current', 'true');
      if (progress) {
        progress.classList.remove('hero-slideshow__dot-progress--running');
        // Force a reflow so the animation restarts in browsers that batch
        // class changes (jsdom is a no-op here, which is fine).
        void progress.offsetWidth;
        progress.classList.add('hero-slideshow__dot-progress--running');
      }
    } else {
      dot.classList.remove('hero-slideshow__dot--active');
      dot.removeAttribute('aria-current');
      if (progress) {
        progress.classList.remove('hero-slideshow__dot-progress--running');
      }
    }
  });
}

function goToSceneIndex(state, nextIdx) {
  if (nextIdx === state.activeSceneIndex) {
    if (state.dots.length) setActiveDot(state, nextIdx);
    return;
  }
  const oldLayerIdx = state.activeLayer;
  const newLayerIdx = 1 - oldLayerIdx;

  unmountLayer(state, newLayerIdx);
  mountSceneIntoLayer(state, newLayerIdx, SCENE_NAMES[nextIdx]);

  state.layers[newLayerIdx].classList.add('hero-slideshow__layer--active');
  state.layers[oldLayerIdx].classList.remove('hero-slideshow__layer--active');
  state.activeLayer = newLayerIdx;
  state.activeSceneIndex = nextIdx;

  if (state.dots.length) setActiveDot(state, nextIdx);

  if (state.fadeTimer) clearTimeout(state.fadeTimer);
  state.fadeTimer = setTimeout(() => {
    unmountLayer(state, oldLayerIdx);
    state.fadeTimer = null;
  }, FADE_MS);
}

function startRotation(state) {
  if (state.rotationTimer) globalThis.clearInterval(state.rotationTimer);
  state.rotationTimer = globalThis.setInterval(() => {
    const nextIdx = (state.activeSceneIndex + 1) % SCENE_NAMES.length;
    goToSceneIndex(state, nextIdx);
  }, ROTATION_MS);
}

function buildDots(state) {
  const row = document.createElement('div');
  row.className = 'hero-slideshow__dots';
  row.setAttribute('role', 'tablist');
  row.setAttribute('aria-label', 'Hero scene navigation');

  const dots = SCENE_NAMES.map((sceneName, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hero-slideshow__dot';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-label', `Show scene ${i + 1}: ${sceneName}`);
    btn.dataset.dotIndex = String(i);
    btn.dataset.dotScene = sceneName;

    const progress = document.createElement('span');
    progress.className = 'hero-slideshow__dot-progress';
    progress.setAttribute('aria-hidden', 'true');
    btn.append(progress);

    btn.addEventListener('click', () => {
      goToSceneIndex(state, i);
      startRotation(state);
    });

    row.append(btn);
    return btn;
  });

  return { row, dots };
}

function buildDisclaimer() {
  const note = document.createElement('div');
  note.className = 'hero-slideshow__disclaimer';
  note.textContent = 'Illustrative purposes';
  return note;
}

export function mount(container, { heroScene = 'auto', variant = 'default' } = {}) {
  unmount();

  const root = document.createElement('div');
  root.className = 'hero-slideshow';
  root.dataset.heroScene = heroScene;

  const layer0 = document.createElement('div');
  layer0.className = 'hero-slideshow__layer hero-slideshow__layer--active';
  const layer1 = document.createElement('div');
  layer1.className = 'hero-slideshow__layer';
  const disclaimer = buildDisclaimer();
  root.append(layer0, layer1, disclaimer);

  const state = {
    root,
    layers: [layer0, layer1],
    mountedModules: [null, null],
    activeLayer: 0,
    activeSceneIndex: 0,
    variant,
    rotationTimer: null,
    fadeTimer: null,
    dots: [],
  };

  const reduced = prefersReducedMotion();
  if (reduced) {
    // Reduced-motion: scene 1 only, static, no dots, no timers.
    mountSceneIntoLayer(state, 0, 'stack');
    container.append(root);
    _state = state;
    return;
  }

  // Pinned scene: render single scene, no rotation, no dots.
  if (heroScene !== 'auto') {
    const sceneName = SCENE_NAMES.includes(heroScene) ? heroScene : 'stack';
    state.activeSceneIndex = SCENE_NAMES.indexOf(sceneName);
    mountSceneIntoLayer(state, 0, sceneName);
    container.append(root);
    _state = state;
    return;
  }

  // Auto-cycle: dots + rotation timer.
  const { row, dots } = buildDots(state);
  state.dots = dots;
  mountSceneIntoLayer(state, 0, 'stack');
  root.append(row);
  setActiveDot(state, 0);
  container.append(root);
  _state = state;
  startRotation(state);
}

export function unmount() {
  if (!_state) return;
  if (_state.rotationTimer) globalThis.clearInterval(_state.rotationTimer);
  if (_state.fadeTimer) clearTimeout(_state.fadeTimer);
  unmountLayer(_state, 0);
  unmountLayer(_state, 1);
  _state.root.remove();
  _state = null;
}

export const HeroSlideshow = { mount, unmount };
