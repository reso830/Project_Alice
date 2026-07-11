import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let supabaseMock = null;
let isHostedAuthAvailableMock = false;

vi.mock('../../src/services/supabaseClient.js', () => ({
  get supabase() {
    return supabaseMock;
  },
  get isHostedAuthAvailable() {
    return isHostedAuthAvailableMock;
  },
}));

beforeEach(() => {
  supabaseMock = null;
  isHostedAuthAvailableMock = false;
  vi.resetModules();
});

function makeAuthMock({ session = null } = {}) {
  let onChangeCallback = null;
  const mock = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: session?.user ?? null }, error: null }),
      onAuthStateChange: vi.fn((cb) => {
        onChangeCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    fire(evt, nextSession) {
      onChangeCallback?.(evt, nextSession);
    },
  };
  return mock;
}

describe('authStore', () => {
  it('resolves to local-mode state when supabase is unavailable', async () => {
    isHostedAuthAvailableMock = false;
    const store = await import('../../src/data/authStore.js');

    await store.init();

    expect(store.getAuthState()).toEqual({
      status: 'local-mode',
      user: null,
      accessToken: null,
    });
    expect(store.getAccessToken()).toBeNull();
  });

  it('initialises to authenticated when a session is present', async () => {
    const session = {
      user: { id: 'user-1', email: 'jane@example.com' },
      access_token: 'tok-1',
    };
    supabaseMock = makeAuthMock({ session });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    expect(store.getAuthState()).toEqual({
      status: 'authenticated',
      user: { id: 'user-1', email: 'jane@example.com' },
      accessToken: 'tok-1',
    });
    expect(store.getAccessToken()).toBe('tok-1');
  });

  it('initialises to unauthenticated when no session is present', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    expect(store.getAuthState()).toEqual({
      status: 'unauthenticated',
      user: null,
      accessToken: null,
    });
  });

  it('updates state when onAuthStateChange fires with a new session', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();

    supabaseMock.fire('SIGNED_IN', {
      user: { id: 'user-2', email: 'mary@example.com' },
      access_token: 'tok-2',
    });

    expect(store.getAuthState().status).toBe('authenticated');
    expect(store.getAccessToken()).toBe('tok-2');
  });

  it('subscribe returns an unsubscribe that prevents further notifications', async () => {
    supabaseMock = makeAuthMock({ session: null });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    await store.init();
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsubscribe();

    supabaseMock.fire('SIGNED_IN', {
      user: { id: 'user-3', email: 'x@y.com' },
      access_token: 'tok-3',
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('signOut calls the client; subsequent SIGNED_OUT event flips to unauthenticated', async () => {
    const session = {
      user: { id: 'user-1', email: 'jane@example.com' },
      access_token: 'tok-1',
    };
    supabaseMock = makeAuthMock({ session });
    isHostedAuthAvailableMock = true;

    const store = await import('../../src/data/authStore.js');
    await store.init();
    expect(store.getAuthState().status).toBe('authenticated');

    await store.signOut();
    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);

    supabaseMock.fire('SIGNED_OUT', null);
    expect(store.getAuthState()).toEqual({
      status: 'unauthenticated',
      user: null,
      accessToken: null,
    });
  });

  it('signOut is a safe no-op when supabase is null', async () => {
    isHostedAuthAvailableMock = false;
    supabaseMock = null;

    const store = await import('../../src/data/authStore.js');
    await expect(store.signOut()).resolves.toBeUndefined();
  });

  describe('handleAuthFailure (FR-011a)', () => {
    const session = {
      user: { id: 'user-1', email: 'jane@example.com' },
      access_token: 'tok-1',
    };

    it('signs out and carries the deleted-account notice when getUser reports no user', async () => {
      supabaseMock = makeAuthMock({ session });
      isHostedAuthAvailableMock = true;
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'user not found' },
      });

      const store = await import('../../src/data/authStore.js');
      await store.init();

      await store.handleAuthFailure();

      expect(supabaseMock.auth.getUser).toHaveBeenCalledTimes(1);
      expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);
      // The notice is carried for the UI and is one-shot.
      expect(store.consumeAuthNotice()).toEqual({
        message: store.ACCOUNT_DELETED_NOTICE,
        type: 'error',
      });
      expect(store.consumeAuthNotice()).toBeNull();
    });

    it('does not sign out when getUser returns a valid user', async () => {
      supabaseMock = makeAuthMock({ session });
      isHostedAuthAvailableMock = true;
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: session.user },
        error: null,
      });

      const store = await import('../../src/data/authStore.js');
      await store.init();

      await store.handleAuthFailure();

      expect(supabaseMock.auth.getUser).toHaveBeenCalledTimes(1);
      expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
      expect(store.consumeAuthNotice()).toBeNull();
    });

    it('does not sign out when getUser rejects (transient error)', async () => {
      supabaseMock = makeAuthMock({ session });
      isHostedAuthAvailableMock = true;
      supabaseMock.auth.getUser.mockRejectedValue(new Error('network'));

      const store = await import('../../src/data/authStore.js');
      await store.init();

      await expect(store.handleAuthFailure()).resolves.toBeUndefined();
      expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
    });

    it('is a no-op in demo mode (no getUser call)', async () => {
      supabaseMock = makeAuthMock({ session: null });
      isHostedAuthAvailableMock = true;

      const store = await import('../../src/data/authStore.js');
      await store.init();
      store.enterDemo();

      await store.handleAuthFailure();

      expect(supabaseMock.auth.getUser).not.toHaveBeenCalled();
    });

    it('is a no-op in local mode (supabase unavailable)', async () => {
      isHostedAuthAvailableMock = false;
      supabaseMock = null;

      const store = await import('../../src/data/authStore.js');
      await store.init();

      await expect(store.handleAuthFailure()).resolves.toBeUndefined();
    });
  });

  // Feature 045: verified directly against @supabase/auth-js@2.105.4 source
  // (research.md D1) — a freshly-registered onAuthStateChange callback
  // receives an INITIAL_SESSION event (carrying the just-saved recovery
  // session) before the macrotask-deferred PASSWORD_RECOVERY event fires.
  // Unguarded, that early event would transiently resolve `authenticated`.
  // The guard holds ANY event that isn't literally PASSWORD_RECOVERY, by
  // design — these tests cover both the real INITIAL_SESSION case and a
  // SIGNED_IN case (e.g. a stray cross-tab event) to demonstrate the guard
  // doesn't hardcode a single "expected other event" name.
  describe('password-recovery guard (feature 045)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('with no recovery URL marker, SIGNED_IN still resolves authenticated immediately (unaffected by the guard)', async () => {
      vi.stubGlobal('location', { hash: '', search: '' });
      supabaseMock = makeAuthMock({ session: null });
      isHostedAuthAvailableMock = true;

      const store = await import('../../src/data/authStore.js');
      await store.init();
      expect(store.getAuthState().status).toBe('unauthenticated');

      supabaseMock.fire('SIGNED_IN', {
        user: { id: 'user-4', email: 'no-recovery@example.com' },
        access_token: 'tok-4',
      });

      expect(store.getAuthState().status).toBe('authenticated');
    });

    it('recovery URL + INITIAL_SESSION (carrying the recovery session) then PASSWORD_RECOVERY resolves password-recovery, never transiently authenticated', async () => {
      // This is the real auth-js@2.105.4 sequence (see research.md D1):
      // onAuthStateChange's own INITIAL_SESSION replay fires before the
      // setTimeout(0)-deferred PASSWORD_RECOVERY event.
      vi.stubGlobal('location', { hash: '#access_token=abc&type=recovery', search: '' });
      supabaseMock = makeAuthMock({ session: null });
      isHostedAuthAvailableMock = true;

      const store = await import('../../src/data/authStore.js');
      const listener = vi.fn();
      const initPromise = store.init();
      store.subscribe(listener);

      const recoverySession = {
        user: { id: 'user-5', email: 'recover@example.com' },
        access_token: 'tok-recovery',
      };
      supabaseMock.fire('INITIAL_SESSION', recoverySession);
      // The held INITIAL_SESSION must not have resolved `authenticated`.
      expect(store.getAuthState().status).not.toBe('authenticated');
      expect(listener).not.toHaveBeenCalled();

      supabaseMock.fire('PASSWORD_RECOVERY', recoverySession);
      await initPromise;

      expect(store.getAuthState()).toEqual({
        status: 'password-recovery',
        user: { id: 'user-5', email: 'recover@example.com' },
        accessToken: 'tok-recovery',
      });
    });

    it('recovery URL detected via the query string (not just the hash) also arms the guard', async () => {
      vi.stubGlobal('location', { hash: '', search: '?type=recovery&code=abc' });
      supabaseMock = makeAuthMock({ session: null });
      isHostedAuthAvailableMock = true;

      const store = await import('../../src/data/authStore.js');
      await store.init();

      supabaseMock.fire('PASSWORD_RECOVERY', {
        user: { id: 'user-6', email: 'pkce@example.com' },
        access_token: 'tok-pkce',
      });

      expect(store.getAuthState().status).toBe('password-recovery');
    });

    it('recovery URL + neither event arrives resolves recovery-expired after the guard timeout', async () => {
      vi.useFakeTimers();
      vi.stubGlobal('location', { hash: '#type=recovery', search: '' });
      supabaseMock = makeAuthMock({ session: null });
      isHostedAuthAvailableMock = true;

      const store = await import('../../src/data/authStore.js');
      await store.init();
      expect(store.getAuthState().status).not.toBe('recovery-expired');

      await vi.advanceTimersByTimeAsync(10000);

      expect(store.getAuthState()).toEqual({
        status: 'recovery-expired',
        user: null,
        accessToken: null,
      });
    });

    it('recovery URL + a non-recovery event only (e.g. SIGNED_IN, no PASSWORD_RECOVERY ever) resolves recovery-expired, not stuck on authenticated', async () => {
      // Uses SIGNED_IN here deliberately (rather than INITIAL_SESSION) to
      // demonstrate the guard's allow-list is generic — it doesn't matter
      // which other event arrives, only PASSWORD_RECOVERY ever resolves it.
      vi.useFakeTimers();
      vi.stubGlobal('location', { hash: '#type=recovery', search: '' });
      supabaseMock = makeAuthMock({ session: null });
      isHostedAuthAvailableMock = true;

      const store = await import('../../src/data/authStore.js');
      await store.init();

      supabaseMock.fire('SIGNED_IN', {
        user: { id: 'user-7', email: 'dead-link@example.com' },
        access_token: 'tok-7',
      });
      expect(store.getAuthState().status).not.toBe('authenticated');

      await vi.advanceTimersByTimeAsync(10000);

      expect(store.getAuthState().status).toBe('recovery-expired');
    });

    it('a confirmed PASSWORD_RECOVERY disarms the guard so the timeout never fires afterward', async () => {
      vi.useFakeTimers();
      vi.stubGlobal('location', { hash: '#type=recovery', search: '' });
      supabaseMock = makeAuthMock({ session: null });
      isHostedAuthAvailableMock = true;

      const store = await import('../../src/data/authStore.js');
      await store.init();

      supabaseMock.fire('PASSWORD_RECOVERY', {
        user: { id: 'user-8', email: 'confirmed@example.com' },
        access_token: 'tok-8',
      });
      expect(store.getAuthState().status).toBe('password-recovery');

      await vi.advanceTimersByTimeAsync(10000);

      // Still password-recovery — the timeout must not have fired and
      // overwritten it with recovery-expired.
      expect(store.getAuthState().status).toBe('password-recovery');
    });

    // Live-browser finding (2026-07-11, via temporary diagnostic logging on
    // a real deployed preview): a real Supabase client can deliver a SECOND
    // event — an extra INITIAL_SESSION — after PASSWORD_RECOVERY has already
    // fired and resolved, which the original design (fully disarming the
    // guard the instant PASSWORD_RECOVERY resolved) had no defense against —
    // it fell straight through to applySession() and silently overwrote
    // password-recovery with authenticated. This is the actual root cause of
    // "a valid recovery link lands on Tracker instead of Reset Password."
    describe('a confirmed recovery session stays sticky against later events (live-browser fix, 2026-07-11)', () => {
      it('a second INITIAL_SESSION after PASSWORD_RECOVERY does not overwrite password-recovery with authenticated', async () => {
        vi.stubGlobal('location', { hash: '#type=recovery', search: '' });
        supabaseMock = makeAuthMock({ session: null });
        isHostedAuthAvailableMock = true;

        const store = await import('../../src/data/authStore.js');
        await store.init();

        const recoverySession = {
          user: { id: 'user-12', email: 'sticky@example.com' },
          access_token: 'tok-12',
        };
        supabaseMock.fire('PASSWORD_RECOVERY', recoverySession);
        expect(store.getAuthState().status).toBe('password-recovery');

        // The exact real-world reproduction: a second, later INITIAL_SESSION
        // carrying the same (still-valid) session.
        supabaseMock.fire('INITIAL_SESSION', recoverySession);

        expect(store.getAuthState().status).toBe('password-recovery');
      });

      it('a later SIGNED_IN after PASSWORD_RECOVERY is also held, not just INITIAL_SESSION specifically', async () => {
        vi.stubGlobal('location', { hash: '#type=recovery', search: '' });
        supabaseMock = makeAuthMock({ session: null });
        isHostedAuthAvailableMock = true;

        const store = await import('../../src/data/authStore.js');
        await store.init();

        supabaseMock.fire('PASSWORD_RECOVERY', {
          user: { id: 'user-13', email: 'sticky2@example.com' },
          access_token: 'tok-13',
        });
        supabaseMock.fire('SIGNED_IN', {
          user: { id: 'user-13', email: 'sticky2@example.com' },
          access_token: 'tok-13',
        });

        expect(store.getAuthState().status).toBe('password-recovery');
      });

      it('a genuine SIGNED_OUT after PASSWORD_RECOVERY still correctly transitions to unauthenticated (the real success/abandon paths must keep working)', async () => {
        vi.stubGlobal('location', { hash: '#type=recovery', search: '' });
        supabaseMock = makeAuthMock({ session: null });
        isHostedAuthAvailableMock = true;

        const store = await import('../../src/data/authStore.js');
        await store.init();

        supabaseMock.fire('PASSWORD_RECOVERY', {
          user: { id: 'user-14', email: 'ends@example.com' },
          access_token: 'tok-14',
        });
        expect(store.getAuthState().status).toBe('password-recovery');

        supabaseMock.fire('SIGNED_OUT', null);

        expect(store.getAuthState()).toEqual({
          status: 'unauthenticated',
          user: null,
          accessToken: null,
        });
      });

      it('after that SIGNED_OUT, a later real sign-in resolves normally (the sticky filter itself gets cleared, not stuck forever)', async () => {
        vi.stubGlobal('location', { hash: '#type=recovery', search: '' });
        supabaseMock = makeAuthMock({ session: null });
        isHostedAuthAvailableMock = true;

        const store = await import('../../src/data/authStore.js');
        await store.init();

        supabaseMock.fire('PASSWORD_RECOVERY', {
          user: { id: 'user-15', email: 'reset@example.com' },
          access_token: 'tok-15',
        });
        supabaseMock.fire('SIGNED_OUT', null);
        expect(store.getAuthState().status).toBe('unauthenticated');

        supabaseMock.fire('SIGNED_IN', {
          user: { id: 'user-16', email: 'newlogin@example.com' },
          access_token: 'tok-16',
        });

        expect(store.getAuthState().status).toBe('authenticated');
      });
    });

    // Live-verification finding (2026-07-10, Browser Smoke Test): a real
    // expired/invalid recovery link's Supabase redirect carries NO `type=
    // recovery` at all — only `#error=access_denied&error_code=otp_expired
    // &error_description=...`. RECOVERY_URL_MARKER alone missed this
    // entirely (guard never armed, app fell through to a plain
    // `unauthenticated` boot, and WelcomePage.js wrongly showed the signup-
    // verification "Email verified" banner). Fixed via RECOVERY_FLOW_MARKER
    // (`flow=recovery`), which ForgotPasswordForm.js appends to its own
    // `redirectTo` and which Supabase preserves on both success and
    // failure.
    describe('RECOVERY_FLOW_MARKER (live-verification fix, 2026-07-10)', () => {
      it('withRecoveryFlowMarker appends flow=recovery to an absolute redirect URL', async () => {
        const store = await import('../../src/data/authStore.js');
        expect(store.withRecoveryFlowMarker('http://localhost:5173/?auth=callback'))
          .toBe('http://localhost:5173/?auth=callback&flow=recovery');
        expect(store.withRecoveryFlowMarker('http://localhost:5173/'))
          .toBe('http://localhost:5173/?flow=recovery');
      });

      it('withRecoveryFlowMarker falls back to the raw input for an unparseable URL', async () => {
        const store = await import('../../src/data/authStore.js');
        expect(store.withRecoveryFlowMarker('not-a-url')).toBe('not-a-url');
      });

      it('a URL carrying only flow=recovery (no type=recovery) still arms the guard', async () => {
        vi.stubGlobal('location', { hash: '', search: '?flow=recovery' });
        supabaseMock = makeAuthMock({ session: null });
        isHostedAuthAvailableMock = true;

        const store = await import('../../src/data/authStore.js');
        await store.init();

        supabaseMock.fire('PASSWORD_RECOVERY', {
          user: { id: 'user-9', email: 'flow-marker@example.com' },
          access_token: 'tok-9',
        });

        expect(store.getAuthState().status).toBe('password-recovery');
      });

      it('flow=recovery + an explicit Supabase error resolves recovery-expired IMMEDIATELY, without waiting for the guard timeout', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('location', {
          hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
          search: '?auth=callback&flow=recovery',
        });
        supabaseMock = makeAuthMock({ session: null });
        isHostedAuthAvailableMock = true;

        const store = await import('../../src/data/authStore.js');
        await store.init();

        // Resolved already — no vi.advanceTimersByTimeAsync() call at all.
        // If this were relying on the 8s timeout instead, status would
        // still be the pre-resolution default here.
        expect(store.getAuthState()).toEqual({
          status: 'recovery-expired',
          user: null,
          accessToken: null,
        });
      });

      it('an error with NEITHER recovery marker (e.g. a failed signup-verification link) does not arm the guard or resolve recovery-expired', async () => {
        vi.stubGlobal('location', {
          hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
          search: '?auth=callback',
        });
        supabaseMock = makeAuthMock({ session: null });
        isHostedAuthAvailableMock = true;

        const store = await import('../../src/data/authStore.js');
        await store.init();

        expect(store.getAuthState().status).toBe('unauthenticated');

        // Guard never armed — a later SIGNED_IN resolves authenticated
        // immediately, exactly like the no-recovery-URL case above.
        supabaseMock.fire('SIGNED_IN', {
          user: { id: 'user-10', email: 'signup-fail@example.com' },
          access_token: 'tok-10',
        });
        expect(store.getAuthState().status).toBe('authenticated');
      });

      it('after an immediate error-based recovery-expired resolution, a later real sign-in still resolves normally (guard properly disarmed)', async () => {
        vi.stubGlobal('location', {
          hash: '#error=access_denied&error_code=otp_expired',
          search: '?auth=callback&flow=recovery',
        });
        supabaseMock = makeAuthMock({ session: null });
        isHostedAuthAvailableMock = true;

        const store = await import('../../src/data/authStore.js');
        await store.init();
        expect(store.getAuthState().status).toBe('recovery-expired');

        supabaseMock.fire('SIGNED_IN', {
          user: { id: 'user-11', email: 'later-sign-in@example.com' },
          access_token: 'tok-11',
        });

        expect(store.getAuthState().status).toBe('authenticated');
      });
    });
  });
});
