// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScenePipeline } from '../../../../src/pages/welcome/scenes/ScenePipeline.js';

let container;

function stubMatchMedia(matches) {
  globalThis.matchMedia = vi.fn().mockImplementation(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  stubMatchMedia(false);
});

afterEach(() => {
  ScenePipeline.unmount();
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ScenePipeline', () => {
  it('mounts a single card with the initial "applied" status', () => {
    ScenePipeline.mount(container, { variant: 'default' });
    const card = container.querySelector('.scene-pipeline__card');
    expect(card).not.toBeNull();
    expect(container.querySelectorAll('.scene-pipeline__card').length).toBe(1);
    expect(container.querySelectorAll('.scene-pipeline__node')).toHaveLength(4);
    const badge = container.querySelector('.scene-pipeline__badge');
    expect(badge.dataset.status).toBe('applied');
  });

  it('cycles through all four handoff statuses over time (fake timers)', () => {
    vi.useFakeTimers();
    ScenePipeline.mount(container, { variant: 'default' });

    const seen = [];
    seen.push(container.querySelector('.scene-pipeline__badge').dataset.status);
    for (let i = 0; i < 3; i += 1) {
      vi.advanceTimersByTime(1150);
      seen.push(container.querySelector('.scene-pipeline__badge').dataset.status);
    }
    expect(seen).toEqual(['applied', 'phone_screen', 'interview', 'offer']);

    // One more cycle wraps back to applied.
    vi.advanceTimersByTime(1150);
    expect(container.querySelector('.scene-pipeline__badge').dataset.status).toBe('applied');
  });

  it('unmount stops the cycle (no pending timers)', () => {
    vi.useFakeTimers();
    ScenePipeline.mount(container, { variant: 'default' });
    expect(vi.getTimerCount()).toBe(1);
    ScenePipeline.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('.scene-pipeline')).toBeNull();
  });

  it('reduced-motion: renders the final status statically with no setInterval', () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    ScenePipeline.mount(container, { variant: 'default' });
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector('.scene-pipeline__badge').dataset.status).toBe('applied');
    expect(container.querySelectorAll('.scene-pipeline__node.is-current')).toHaveLength(1);
  });
});
