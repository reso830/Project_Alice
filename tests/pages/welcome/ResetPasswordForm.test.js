// @vitest-environment jsdom
// Isolated unit coverage for ResetPasswordForm.js, mounted directly (not
// through AuthOverlay/WelcomePage). End-to-end view-transition + AuthOverlay
// integration coverage (recovery-expired routing, "Back to sign in" ending
// the session, footer chrome) lives in tests/components/welcome.test.js's
// AuthOverlay suite — this file focuses on the component's own contract:
// validation, the updateUser() success/failure/expired-session split, and
// the toggle/back-link affordances.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
}));
const authStoreMocks = vi.hoisted(() => ({
  setAuthNotice: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../../src/services/supabaseClient.js', () => ({
  supabase: { auth: { updateUser: supabaseMocks.updateUser } },
}));

vi.mock('../../../src/data/authStore.js', () => ({
  setAuthNotice: authStoreMocks.setAuthNotice,
  signOut: authStoreMocks.signOut,
}));

const { mountResetPasswordForm } = await import('../../../src/pages/welcome/ResetPasswordForm.js');

let container;
let unmount;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fillFields(newValue, confirmValue) {
  const newInput = container.querySelector('input[name="new-password"]');
  const confirmInput = container.querySelector('input[name="confirm-password"]');
  newInput.value = newValue;
  newInput.dispatchEvent(new Event('input'));
  confirmInput.value = confirmValue;
  confirmInput.dispatchEvent(new Event('input'));
}

function submit() {
  container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  supabaseMocks.updateUser.mockReset();
  authStoreMocks.setAuthNotice.mockReset();
  authStoreMocks.signOut.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  unmount?.();
  unmount = null;
  container.remove();
});

describe('mountResetPasswordForm', () => {
  it('renders a new-password and confirm-password field, each password-typed with a show/hide toggle', () => {
    unmount = mountResetPasswordForm(container);

    const newInput = container.querySelector('input[name="new-password"]');
    const confirmInput = container.querySelector('input[name="confirm-password"]');
    expect(newInput.type).toBe('password');
    expect(confirmInput.type).toBe('password');
    expect(container.querySelectorAll('.auth-form__password-toggle')).toHaveLength(2);
  });

  it('each toggle independently reveals only its own field', () => {
    unmount = mountResetPasswordForm(container);

    const [newToggle, confirmToggle] = container.querySelectorAll('.auth-form__password-toggle');
    const newInput = container.querySelector('input[name="new-password"]');
    const confirmInput = container.querySelector('input[name="confirm-password"]');

    newToggle.click();
    expect(newInput.type).toBe('text');
    expect(confirmInput.type).toBe('password');

    confirmToggle.click();
    expect(confirmInput.type).toBe('text');
  });

  it('does not validate before the first submit attempt', () => {
    unmount = mountResetPasswordForm(container);

    fillFields('short', 'short');

    expect(container.querySelector('.auth-form__field-error').textContent).toBe('');
  });

  it('shows a field error for a weak password on submit, without calling updateUser', () => {
    unmount = mountResetPasswordForm(container);

    fillFields('short', 'short');
    submit();

    const errors = [...container.querySelectorAll('.auth-form__field-error')].map((n) => n.textContent);
    expect(errors.some((text) => text.length > 0)).toBe(true);
    expect(supabaseMocks.updateUser).not.toHaveBeenCalled();
  });

  it('shows a mismatch error when the fields differ, without calling updateUser', () => {
    unmount = mountResetPasswordForm(container);

    fillFields('LongEnough1', 'Different1');
    submit();

    const [, confirmError] = container.querySelectorAll('.auth-form__field-error');
    expect(confirmError.textContent).toContain("don't match");
    expect(supabaseMocks.updateUser).not.toHaveBeenCalled();
  });

  it('re-validates on every input once touched by a first submit attempt', () => {
    unmount = mountResetPasswordForm(container);

    fillFields('short', 'short');
    submit();
    expect(container.querySelector('.auth-form__field-error').textContent).not.toBe('');

    fillFields('LongEnough1', 'LongEnough1');
    expect(container.querySelector('.auth-form__field-error').textContent).toBe('');
  });

  it('on a valid submit, calls updateUser, stages a success notice, then signs out', async () => {
    supabaseMocks.updateUser.mockResolvedValue({ data: {}, error: null });
    unmount = mountResetPasswordForm(container);

    fillFields('LongEnough1', 'LongEnough1');
    submit();
    await flush();

    expect(supabaseMocks.updateUser).toHaveBeenCalledWith({ password: 'LongEnough1' });
    expect(authStoreMocks.setAuthNotice).toHaveBeenCalledWith(
      expect.stringContaining('Password updated'),
      'success',
    );
    expect(authStoreMocks.signOut).toHaveBeenCalledTimes(1);
    // setAuthNotice must be staged before signOut() fires the reroute.
    expect(authStoreMocks.setAuthNotice.mock.invocationCallOrder[0])
      .toBeLessThan(authStoreMocks.signOut.mock.invocationCallOrder[0]);
  });

  it('a signOut() rejection after a successful update is swallowed, not reported as a failure', async () => {
    supabaseMocks.updateUser.mockResolvedValue({ data: {}, error: null });
    authStoreMocks.signOut.mockRejectedValue(new Error('network down'));
    unmount = mountResetPasswordForm(container);

    fillFields('LongEnough1', 'LongEnough1');
    submit();
    await flush();

    expect(container.querySelector('.auth-form__error').textContent).toBe('');
  });

  it('a signOut() rejection after a successful update still releases the pending state (no permanently disabled form)', async () => {
    supabaseMocks.updateUser.mockResolvedValue({ data: {}, error: null });
    authStoreMocks.signOut.mockRejectedValue(new Error('network down'));
    const onPendingChange = vi.fn();
    unmount = mountResetPasswordForm(container, { onPendingChange });

    fillFields('LongEnough1', 'LongEnough1');
    submit();
    await flush();

    expect(onPendingChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
    expect(container.querySelector('.auth-form__submit').disabled).toBe(false);
  });

  it('shows a generic error for a non-expired updateUser failure, without calling onExpired', async () => {
    supabaseMocks.updateUser.mockResolvedValue({ data: null, error: { message: 'network blip' } });
    const onExpired = vi.fn();
    unmount = mountResetPasswordForm(container, { onExpired });

    fillFields('LongEnough1', 'LongEnough1');
    submit();
    await flush();

    expect(container.querySelector('.auth-form__error').textContent).toContain("Couldn't update");
    expect(onExpired).not.toHaveBeenCalled();
    expect(authStoreMocks.signOut).not.toHaveBeenCalled();
  });

  // Code-review finding (2026-07-11, Gemini reviewer): a genuine password-
  // policy rejection from Supabase (too weak, same as the old one) was
  // discarded in favor of the generic message, leaving the user to guess
  // and repeat the same invalid input. Fixed by surfacing `updateError.
  // message` for these two specific, documented GoTrue codes only — not a
  // blanket "always show the provider's message", which would risk leaking
  // an unexpected/internal message for anything else.
  describe('password-policy errors (code-review fix, 2026-07-11)', () => {
    it.each([
      ['weak_password'],
      ['same_password'],
    ])('shows the real policy message for a %s error, instead of the generic one', async (code) => {
      supabaseMocks.updateUser.mockResolvedValue({
        data: null,
        error: { code, message: 'Password should contain at least one number.' },
      });
      unmount = mountResetPasswordForm(container);

      fillFields('LongEnough1', 'LongEnough1');
      submit();
      await flush();

      expect(container.querySelector('.auth-form__error').textContent)
        .toBe('Password should contain at least one number.');
    });

    it('falls back to the generic message when a policy-coded error has no message', async () => {
      supabaseMocks.updateUser.mockResolvedValue({ data: null, error: { code: 'weak_password' } });
      unmount = mountResetPasswordForm(container);

      fillFields('LongEnough1', 'LongEnough1');
      submit();
      await flush();

      expect(container.querySelector('.auth-form__error').textContent).toContain("Couldn't update");
    });
  });

  it.each([
    ['session_not_found'],
    ['session_expired'],
    ['bad_jwt'],
  ])('calls onExpired (not the generic error) for a %s updateUser error', async (code) => {
    supabaseMocks.updateUser.mockResolvedValue({ data: null, error: { code } });
    const onExpired = vi.fn();
    unmount = mountResetPasswordForm(container, { onExpired });

    fillFields('LongEnough1', 'LongEnough1');
    submit();
    await flush();

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.auth-form__error').textContent).toBe('');
  });

  it('calls onExpired when updateUser rejects with an AuthSessionMissingError', async () => {
    const err = new Error('no session');
    err.name = 'AuthSessionMissingError';
    supabaseMocks.updateUser.mockRejectedValue(err);
    const onExpired = vi.fn();
    unmount = mountResetPasswordForm(container, { onExpired });

    fillFields('LongEnough1', 'LongEnough1');
    submit();
    await flush();

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('calls onPendingChange(true) on submit and onPendingChange(false) on a non-expired failure', async () => {
    supabaseMocks.updateUser.mockResolvedValue({ data: null, error: { message: 'network blip' } });
    const onPendingChange = vi.fn();
    unmount = mountResetPasswordForm(container, { onPendingChange });

    fillFields('LongEnough1', 'LongEnough1');
    submit();
    await flush();

    expect(onPendingChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it('disables "Back to sign in" while a submit is in flight (T021 — matches DeleteAccountModal.js\'s loading-disables-close convention)', async () => {
    let resolveUpdate;
    supabaseMocks.updateUser.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }));
    unmount = mountResetPasswordForm(container);

    const backLink = container.querySelector('.auth-overlay__back-link');
    expect(backLink.disabled).toBe(false);

    fillFields('LongEnough1', 'LongEnough1');
    submit();
    await flush();

    expect(backLink.disabled).toBe(true);

    resolveUpdate({ data: {}, error: null });
    await flush();
  });

  it('disables the submit button and shows the pending label while in flight', async () => {
    let resolveUpdate;
    supabaseMocks.updateUser.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }));
    unmount = mountResetPasswordForm(container);

    fillFields('LongEnough1', 'LongEnough1');
    submit();
    await flush();

    const submitBtn = container.querySelector('.auth-form__submit');
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toBe('Updating…');

    resolveUpdate({ data: {}, error: null });
    await flush();
  });

  it('ignores a second submit while the first is still in flight', async () => {
    let resolveUpdate;
    supabaseMocks.updateUser.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }));
    unmount = mountResetPasswordForm(container);

    fillFields('LongEnough1', 'LongEnough1');
    submit();
    submit();
    await flush();

    expect(supabaseMocks.updateUser).toHaveBeenCalledTimes(1);

    resolveUpdate({ data: {}, error: null });
    await flush();
  });

  it('"Back to sign in" calls onClose without calling updateUser', () => {
    const onClose = vi.fn();
    unmount = mountResetPasswordForm(container, { onClose });

    container.querySelector('.auth-overlay__back-link').click();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.updateUser).not.toHaveBeenCalled();
  });

  it('unmount removes the form and its submit listener', () => {
    unmount = mountResetPasswordForm(container);
    expect(container.querySelector('form')).not.toBeNull();

    unmount();
    unmount = null;

    expect(container.querySelector('form')).toBeNull();
  });
});
