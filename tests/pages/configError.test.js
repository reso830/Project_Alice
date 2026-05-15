// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/Alice_White.png', () => ({ default: '/Alice_White.png' }));

import { ConfigError } from '../../src/pages/ConfigError.js';

let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  ConfigError.unmount();
  container.remove();
});

describe('ConfigError', () => {
  it('mounts a config-error page with the operator message', () => {
    ConfigError.mount(container);

    const page = container.querySelector('.config-error');
    expect(page).not.toBeNull();
    expect(page.getAttribute('role')).toBe('alert');
    expect(container.querySelector('.config-error__headline')?.textContent).toBe(
      'Configuration Error',
    );
    expect(container.querySelector('.config-error__body')?.textContent).toBe(
      'This deployment is misconfigured. Contact the operator.',
    );
  });

  it('renders the Project Alice brand block', () => {
    ConfigError.mount(container);

    expect(container.querySelector('.config-error__brand-mark')).not.toBeNull();
    expect(container.querySelector('.config-error__brand-text')?.textContent).toBe('Project Alice');
  });

  it('unmount clears the container', () => {
    ConfigError.mount(container);
    expect(container.children.length).toBe(1);

    ConfigError.unmount();

    expect(container.children.length).toBe(0);
  });
});
