// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  it('mounts three fanned tracker cards with accent, badge, and compat label', () => {
    SceneDeck.mount(container, { variant: 'default' });

    expect(container.querySelector('.scene-deck')?.dataset.variant).toBe('default');
    expect(container.querySelectorAll('.scene-deck__card')).toHaveLength(3);
    expect(container.querySelectorAll('.tracker-card__accent')).toHaveLength(3);
    expect(container.querySelector('.tracker-card__badge--offer')?.textContent).toBe('Offer');
    expect(container.querySelector('.tracker-card__bar-label')?.textContent).toBe('94% compat');
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
