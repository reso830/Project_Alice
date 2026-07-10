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
      redirectTo: 'https://example.com/?auth=callback',
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

  it('calls onSuccess even when resetPasswordForEmail rejects (non-enumeration)', async () => {
    supabaseMocks.resetPasswordForEmail.mockRejectedValue(new TypeError('network down'));
    const onSuccess = vi.fn();
    unmount = mountForgotPasswordForm(container, { onSuccess });

    const form = container.querySelector('form');
    form.querySelector('input[name="email"]').value = 'jane@example.com';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(onSuccess).toHaveBeenCalledTimes(1);
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
