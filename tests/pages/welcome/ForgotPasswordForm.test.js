// @vitest-environment jsdom
// Isolated unit coverage for ForgotPasswordForm.js, mounted directly (not
// through AuthOverlay/WelcomePage). End-to-end view-transition + AuthOverlay
// integration coverage (non-enumeration across success/error responses,
// "Back to sign in", footer chrome, email persistence across views) lives in
// tests/components/welcome.test.js's "AuthOverlay — Forgot Password" suite —
// this file focuses on the component's own contract in isolation.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('../../../src/services/supabaseClient.js', () => ({
  supabase: { auth: { resetPasswordForEmail: supabaseMocks.resetPasswordForEmail } },
  emailRedirectUrl: 'https://example.com/?auth=callback',
}));

const { mountForgotPasswordForm } = await import('../../../src/pages/welcome/ForgotPasswordForm.js');

let container;
let unmount;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  supabaseMocks.resetPasswordForEmail.mockReset();
});

afterEach(() => {
  unmount?.();
  unmount = null;
  container.remove();
});

describe('mountForgotPasswordForm', () => {
  it('renders a single email field, pre-filled from the email option', () => {
    unmount = mountForgotPasswordForm(container, { email: 'existing@example.com' });

    const input = container.querySelector('input[name="email"]');
    expect(input).not.toBeNull();
    expect(input.type).toBe('email');
    expect(input.value).toBe('existing@example.com');
    expect(container.querySelectorAll('input')).toHaveLength(1);
  });

  it('calls onEmailChange as the user types', () => {
    const onEmailChange = vi.fn();
    unmount = mountForgotPasswordForm(container, { onEmailChange });

    const input = container.querySelector('input[name="email"]');
    input.value = 'typed@example.com';
    input.dispatchEvent(new Event('input'));

    expect(onEmailChange).toHaveBeenCalledWith('typed@example.com');
  });

  it('does not validate before the first submit attempt', () => {
    unmount = mountForgotPasswordForm(container);

    const input = container.querySelector('input[name="email"]');
    input.value = 'not-an-email';
    input.dispatchEvent(new Event('input'));

    expect(container.querySelector('.auth-form__field-error').textContent).toBe('');
  });

  it('validates on blur once touched, and on every input after that', () => {
    unmount = mountForgotPasswordForm(container);

    const input = container.querySelector('input[name="email"]');
    input.value = 'not-an-email';
    input.dispatchEvent(new Event('blur'));
    expect(container.querySelector('.auth-form__field-error').textContent).toContain('valid email');

    input.value = 'valid@example.com';
    input.dispatchEvent(new Event('input'));
    expect(container.querySelector('.auth-form__field-error').textContent).toBe('');
  });

  it('blurring an empty field does not trigger validation (avoids nagging on an untouched form)', () => {
    unmount = mountForgotPasswordForm(container);

    container.querySelector('input[name="email"]').dispatchEvent(new Event('blur'));

    expect(container.querySelector('.auth-form__field-error').textContent).toBe('');
  });

  it('does not call resetPasswordForEmail or onSuccess for a malformed email', () => {
    const onSuccess = vi.fn();
    unmount = mountForgotPasswordForm(container, { onSuccess });

    const form = container.querySelector('form');
    form.querySelector('input[name="email"]').value = 'nope';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(supabaseMocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('calls resetPasswordForEmail with the redirect URL, then onSuccess, on a valid submit', async () => {
    supabaseMocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const onSuccess = vi.fn();
    unmount = mountForgotPasswordForm(container, { onSuccess });

    const form = container.querySelector('form');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(supabaseMocks.resetPasswordForEmail).toHaveBeenCalledWith('jane@example.com', {
      redirectTo: 'https://example.com/?auth=callback&flow=recovery',
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('calls onSuccess even when resetPasswordForEmail resolves with an error (non-enumeration)', async () => {
    supabaseMocks.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: 'user not found' },
    });
    const onSuccess = vi.fn();
    unmount = mountForgotPasswordForm(container, { onSuccess });

    const form = container.querySelector('form');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('calls onSuccess even when resetPasswordForEmail rejects with an unrecognized error (non-enumeration)', async () => {
    supabaseMocks.resetPasswordForEmail.mockRejectedValue(new TypeError('network down'));
    const onSuccess = vi.fn();
    unmount = mountForgotPasswordForm(container, { onSuccess });

    const form = container.querySelector('form');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  // Code-review finding (2026-07-11, three independent reviewers): every
  // failure — including genuine transport/provider outages — was being
  // masked into a fake "check your inbox" success, contradicting the
  // spec's own edge case (network/provider failure → retryable inline
  // error). Fixed via a narrow allow-list (isGenuineDeliveryFailure) of
  // auth-js's own documented signals for "this actually failed to send",
  // not account-existence ambiguity.
  describe('genuine delivery failures (code-review fix, 2026-07-11)', () => {
    it('does NOT call onSuccess, and shows a retryable inline error, when resetPasswordForEmail throws AuthRetryableFetchError', async () => {
      const err = new Error('fetch failed');
      err.name = 'AuthRetryableFetchError';
      supabaseMocks.resetPasswordForEmail.mockRejectedValue(err);
      const onSuccess = vi.fn();
      unmount = mountForgotPasswordForm(container, { onSuccess });

      const form = container.querySelector('form');
      form.querySelector('input[name="email"]').value = 'jane@example.com';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();

      expect(onSuccess).not.toHaveBeenCalled();
      expect(container.querySelector('.auth-form__error').textContent).toContain("Couldn't send");
    });

    it.each([
      ['over_email_send_rate_limit'],
      ['over_request_rate_limit'],
    ])('does NOT call onSuccess when resetPasswordForEmail resolves with error code %s', async (code) => {
      supabaseMocks.resetPasswordForEmail.mockResolvedValue({ data: null, error: { code, message: 'rate limited' } });
      const onSuccess = vi.fn();
      unmount = mountForgotPasswordForm(container, { onSuccess });

      const form = container.querySelector('form');
      form.querySelector('input[name="email"]').value = 'jane@example.com';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();

      expect(onSuccess).not.toHaveBeenCalled();
      expect(container.querySelector('.auth-form__error').textContent).toContain("Couldn't send");
    });

    it('the submit button re-enables after a genuine delivery failure, so the user can retry', async () => {
      const err = new Error('fetch failed');
      err.name = 'AuthRetryableFetchError';
      supabaseMocks.resetPasswordForEmail.mockRejectedValue(err);
      unmount = mountForgotPasswordForm(container);

      const form = container.querySelector('form');
      form.querySelector('input[name="email"]').value = 'jane@example.com';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();

      const submitBtn = form.querySelector('.auth-form__submit');
      expect(submitBtn.disabled).toBe(false);
      expect(submitBtn.textContent).toBe('Send reset link');
    });

    it('still calls onSuccess for a returned error with an unrecognized code (non-enumeration default)', async () => {
      supabaseMocks.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { code: 'user_not_found', message: 'no user' },
      });
      const onSuccess = vi.fn();
      unmount = mountForgotPasswordForm(container, { onSuccess });

      const form = container.querySelector('form');
      form.querySelector('input[name="email"]').value = 'jane@example.com';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    // Follow-up code-review finding (2026-07-11): the original two-code
    // allow-list missed other genuine operational failures GoTrue can
    // return. Fixed via a general `status >= 500 || status === 429` rule
    // instead of continuing to hand-pick codes — these three are the
    // reviewer's own named examples, now caught by that general rule
    // rather than by name.
    it.each([
      ['unexpected_failure', 500],
      ['email_provider_disabled', 500],
      ['request_timeout', 504],
    ])('does NOT call onSuccess for a %s error (status %i) — caught by the general 5xx rule, not a hand-picked code', async (code, status) => {
      supabaseMocks.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { code, status, message: 'operational failure' },
      });
      const onSuccess = vi.fn();
      unmount = mountForgotPasswordForm(container, { onSuccess });

      const form = container.querySelector('form');
      form.querySelector('input[name="email"]').value = 'jane@example.com';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();

      expect(onSuccess).not.toHaveBeenCalled();
      expect(container.querySelector('.auth-form__error').textContent).toContain("Couldn't send");
    });

    it('a 429 status alone (no rate-limit code) is also caught by the general rule', async () => {
      supabaseMocks.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { code: 'some_future_rate_limit_code', status: 429, message: 'slow down' },
      });
      const onSuccess = vi.fn();
      unmount = mountForgotPasswordForm(container, { onSuccess });

      const form = container.querySelector('form');
      form.querySelector('input[name="email"]').value = 'jane@example.com';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('a 4xx status (account/input-shaped, e.g. user_not_found) still masks to success even though a status is present', async () => {
      supabaseMocks.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { code: 'user_not_found', status: 404, message: 'no user' },
      });
      const onSuccess = vi.fn();
      unmount = mountForgotPasswordForm(container, { onSuccess });

      const form = container.querySelector('form');
      form.querySelector('input[name="email"]').value = 'jane@example.com';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('disables the submit button and shows the pending label while in flight', async () => {
    let resolveReset;
    supabaseMocks.resetPasswordForEmail.mockReturnValue(
      new Promise((resolve) => { resolveReset = resolve; }),
    );
    unmount = mountForgotPasswordForm(container);

    const form = container.querySelector('form');
    const submitBtn = form.querySelector('.auth-form__submit');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toBe('Sending…');
    expect(submitBtn.getAttribute('aria-busy')).toBe('true');

    resolveReset({ data: {}, error: null });
    await flush();

    expect(submitBtn.disabled).toBe(false);
    expect(submitBtn.textContent).toBe('Send reset link');
  });

  it('ignores a second submit while the first is still in flight', async () => {
    let resolveReset;
    supabaseMocks.resetPasswordForEmail.mockReturnValue(
      new Promise((resolve) => { resolveReset = resolve; }),
    );
    unmount = mountForgotPasswordForm(container);

    const form = container.querySelector('form');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(supabaseMocks.resetPasswordForEmail).toHaveBeenCalledTimes(1);

    resolveReset({ data: {}, error: null });
    await flush();
  });

  it('"Back to sign in" calls onSwitch("login") without calling resetPasswordForEmail', () => {
    const onSwitch = vi.fn();
    unmount = mountForgotPasswordForm(container, { onSwitch });

    container.querySelector('.auth-overlay__back-link').click();

    expect(onSwitch).toHaveBeenCalledWith('login');
    expect(supabaseMocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('unmount removes the form and its submit listener', () => {
    unmount = mountForgotPasswordForm(container);
    expect(container.querySelector('form')).not.toBeNull();

    unmount();
    unmount = null;

    expect(container.querySelector('form')).toBeNull();
  });
});
