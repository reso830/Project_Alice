// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneConstellation } from '../../../../src/pages/welcome/scenes/SceneConstellation.js';

let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  SceneConstellation.unmount();
  container.remove();
  vi.restoreAllMocks();
});

describe('SceneConstellation', () => {
  it('mounts seven pipeline status stars with six connecting lines', () => {
    SceneConstellation.mount(container, { variant: 'default' });

    expect(container.querySelector('.scene-constellation')?.dataset.variant).toBe('default');
    expect(container.querySelectorAll('.scene-constellation__node')).toHaveLength(7);
    expect(container.querySelectorAll('.scene-constellation__line')).toHaveLength(6);
    expect([...container.querySelectorAll('.scene-constellation__node')].map((node) => node.dataset.status))
      .toEqual(['wishlisted', 'applied', 'phone', 'interview', 'technical', 'offer', 'accepted']);
  });

  it('passes reduced motion as settled DOM with no CSS animation dependency', () => {
    SceneConstellation.mount(container, { motion: false });

    expect(container.querySelectorAll('.scene-constellation__node.is-settled')).toHaveLength(7);
    expect(container.querySelectorAll('.scene-constellation__line.is-settled')).toHaveLength(6);
  });

  it('unmounts cleanly', () => {
    SceneConstellation.mount(container);
    SceneConstellation.unmount();
    expect(container.querySelector('.scene-constellation')).toBeNull();
  });
});
