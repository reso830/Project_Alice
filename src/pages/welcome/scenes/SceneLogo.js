// Scene 4 — Big logo (`SceneLogo`)
// docs/design/welcome_page.md §4.4
//
// Alice_White.png floating with a 6s `scene-logo-float` ease-in-out loop and
// randomized gold sparkle stars (2.4s `scene-sparkle` scale/fade loop,
// staggered). Size `min(360px, 70%)` aspect-ratio 1 by default; fixed
// 200×200 for `centered` (tablet).
// Animation gated via @media (prefers-reduced-motion: reduce) in main.css —
// the module itself owns no JS timers.

import aliceWhite from '../../../assets/Alice_White.png';

const SPARKLE_COUNT = 12;

let _state = null;

export function mount(container, { variant = 'default' } = {}) {
  unmount();
  const root = document.createElement('div');
  root.className = `scene-logo scene-logo--${variant}`;
  root.dataset.variant = variant;

  const inner = document.createElement('div');
  inner.className = 'scene-logo__inner';

  const img = document.createElement('img');
  img.className = 'scene-logo__mark';
  img.src = aliceWhite;
  img.alt = '';
  inner.append(img);

  for (let i = 0; i < SPARKLE_COUNT; i += 1) {
    const sparkle = document.createElement('span');
    sparkle.className = 'scene-logo__sparkle';
    sparkle.setAttribute('aria-hidden', 'true');
    sparkle.style.setProperty('--scene-logo-sparkle-x', `${Math.round(8 + Math.random() * 84)}%`);
    sparkle.style.setProperty('--scene-logo-sparkle-y', `${Math.round(8 + Math.random() * 84)}%`);
    sparkle.style.setProperty('--scene-logo-sparkle-size', `${Math.round(10 + Math.random() * 12)}px`);
    sparkle.style.setProperty('--scene-logo-sparkle-delay', `${(i * 0.18 + Math.random() * 0.25).toFixed(2)}s`);
    inner.append(sparkle);
  }

  root.append(inner);
  container.append(root);

  _state = { root };
}

export function unmount() {
  if (!_state) return;
  _state.root.remove();
  _state = null;
}

export const SceneLogo = { mount, unmount };
