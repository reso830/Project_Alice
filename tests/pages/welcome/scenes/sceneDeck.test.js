// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/assets/logo/alice-sigil-full-white.svg', () => ({
  default: '/alice-sigil-full-white.svg',
}));

import { SceneDeck } from '../../../../src/pages/welcome/scenes/SceneDeck.js';

let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  SceneDeck.unmount();
  container.remove();
  vi.restoreAllMocks();
});

describe('SceneDeck', () => {
  it('mounts three fanned cards with the white sigil asset', () => {
    SceneDeck.mount(container, { variant: 'default' });

    expect(container.querySelector('.scene-deck')?.dataset.variant).toBe('default');
    expect(container.querySelectorAll('.scene-deck__card')).toHaveLength(3);
    expect(container.querySelector('.scene-deck__sigil')?.getAttribute('src'))
      .toBe('/alice-sigil-full-white.svg');
  });

  it('mounts with the centered variant class', () => {
    SceneDeck.mount(container, { variant: 'centered' });
    expect(container.querySelector('.scene-deck--centered')).not.toBeNull();
  });

  it('unmounts cleanly', () => {
    SceneDeck.mount(container);
    SceneDeck.unmount();
    expect(container.querySelector('.scene-deck')).toBeNull();
  });
});
