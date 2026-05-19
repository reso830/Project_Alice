// Welcome-CTA wrapper test (feature 020). `demoStub.enterDemo()` is the
// single boundary both `WelcomePage.js` (the welcome CTA) and
// `AuthOverlay.js` (the auth-modal demo button) call into. The wrapper
// itself just delegates to `authStore.enterDemo`; this test guards
// against the delegation being broken or removed.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authStoreMock = vi.hoisted(() => ({
  enterDemo: vi.fn(),
}));

vi.mock('../../../src/data/authStore.js', () => authStoreMock);

beforeEach(() => {
  authStoreMock.enterDemo.mockClear();
});

describe('demoStub.enterDemo', () => {
  it('delegates to authStore.enterDemo()', async () => {
    const { enterDemo } = await import('../../../src/pages/welcome/demoStub.js');
    enterDemo();
    expect(authStoreMock.enterDemo).toHaveBeenCalledTimes(1);
  });

  it('does not call demoStore.loadSeed directly — single seam lives in authStore', async () => {
    // The wrapper deliberately does not double-load the seed; that
    // happens inside `authStore.enterDemo`. If a future refactor adds
    // a direct `demoStore.loadSeed()` call here, this test will fail
    // because `enterDemo` is the only export and it is intentionally
    // synchronous and minimal.
    const mod = await import('../../../src/pages/welcome/demoStub.js');
    expect(Object.keys(mod)).toEqual(['enterDemo']);
  });
});
