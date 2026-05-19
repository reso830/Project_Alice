// @vitest-environment jsdom
//
// ResumeImport demo visibility (feature 020). The component's existing
// `VISIBLE_STATUSES` set keeps the upload widget hidden whenever the
// auth status isn't `'local-mode'` or `'authenticated'`. The demo status
// is intentionally not in that set, so demo visitors see nothing
// rendered by this component.
//
// The third test below is the design-by-contract guard: it imports
// both `VISIBLE_STATUSES` (now an export) and `DEMO_STATUS` and
// asserts the demo status is NOT in the set. A future maintainer who
// adds `'demo'` to the set (e.g. "to be thorough") fails this test
// immediately.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authStoreMock = vi.hoisted(() => ({
  DEMO_STATUS: 'demo',
  getAuthState: vi.fn(),
  subscribe: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('../../src/data/authStore.js', () => authStoreMock);

import { ResumeImport, VISIBLE_STATUSES } from '../../src/components/ResumeImport.js';
import { DEMO_STATUS } from '../../src/data/authStore.js';

let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  authStoreMock.getAuthState.mockReset();
  authStoreMock.subscribe.mockReset().mockReturnValue(() => {});
});

afterEach(() => {
  container.remove();
});

describe('ResumeImport — demo visibility', () => {
  it('hides its root (display: none via [hidden]) when authStore status is "demo"', () => {
    authStoreMock.getAuthState.mockReturnValue({
      status: 'demo',
      user: null,
      accessToken: null,
    });

    const node = ResumeImport.create({ onSuccess: () => {}, onDismiss: () => {} });
    container.append(node);

    // The component's `applyVisibility` flips `root.hidden = true`
    // whenever the auth status isn't in VISIBLE_STATUSES. The DOM is
    // still constructed (for cheap re-show on a status change), but
    // nothing is visible to the visitor.
    expect(node.hidden).toBe(true);
  });

  it('shows its root when status is "authenticated" (regression guard)', () => {
    authStoreMock.getAuthState.mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', email: 'real@example.com' },
      accessToken: 'tok',
    });

    const node = ResumeImport.create({ onSuccess: () => {}, onDismiss: () => {} });
    container.append(node);

    expect(node.hidden).toBe(false);
    // The authenticated branch renders the (hidden but present) file
    // input the visible button delegates clicks to.
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('design-by-contract: DEMO_STATUS must NOT be in VISIBLE_STATUSES', () => {
    // This is the canonical regression guard. A future change that
    // adds `'demo'` to the set will surface here immediately and
    // signal that the ProfileEdit inline-note slot has been bypassed.
    expect(VISIBLE_STATUSES.has(DEMO_STATUS)).toBe(false);
    // Sanity: the existing two are still present.
    expect(VISIBLE_STATUSES.has('local-mode')).toBe(true);
    expect(VISIBLE_STATUSES.has('authenticated')).toBe(true);
  });
});
