// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordChangeModal } from '../../src/components/PasswordChangeModal.js';

let modal;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const q = (sel) => document.querySelector(sel);
const curInput = () => q('#pcf-cur');
const newInput = () => q('#pcf-new');
const confirmInput = () => q('#pcf-confirm');
const submitBtn = () => q('.pcf-btn-primary[type="submit"]');

function fill(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function submitValid({ current = 'old-pw', next = 'new-password' } = {}) {
  fill(curInput(), current);
  fill(newInput(), next);
  fill(confirmInput(), next);
  submitBtn().click();
}

afterEach(() => {
  modal?.close?.();
  modal = null;
  document.body.replaceChildren();
});

describe('PasswordChangeModal', () => {
  it('renders three password fields, each with its own show/hide toggle', () => {
    modal = PasswordChangeModal.open({ onConfirm: vi.fn() });

    expect(curInput().type).toBe('password');
    expect(newInput().type).toBe('password');
    expect(confirmInput().type).toBe('password');
    expect(document.querySelectorAll('.pcf-peek')).toHaveLength(3);

    document.querySelectorAll('.pcf-peek')[1].click();
    expect(newInput().type).toBe('text');
  });

  it('shows no validation errors before the first submit attempt', () => {
    modal = PasswordChangeModal.open({ onConfirm: vi.fn() });

    fill(curInput(), '');
    fill(newInput(), 'short');

    expect(document.querySelectorAll('.pcf-err')).toHaveLength(0);
  });

  it('validates required current password, 8-char new password, and confirm-match on submit', () => {
    modal = PasswordChangeModal.open({ onConfirm: vi.fn() });

    fill(newInput(), 'short');
    fill(confirmInput(), 'mismatch');
    submitBtn().click();

    expect(q('.pcf-field:nth-of-type(1)').classList.contains('pcf-err')).toBe(true);
    expect(q('.pcf-field:nth-of-type(2)').classList.contains('pcf-err')).toBe(true);
    expect(q('.pcf-field:nth-of-type(3)').classList.contains('pcf-err')).toBe(true);
  });

  it('does not call onConfirm while the form is invalid', () => {
    const onConfirm = vi.fn();
    modal = PasswordChangeModal.open({ onConfirm });

    submitBtn().click();

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm with currentPassword/newPassword and shows the success card on resolve', async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    modal = PasswordChangeModal.open({ onConfirm });

    submitValid({ current: 's3cret', next: 'new-password' });
    await flush();

    expect(onConfirm).toHaveBeenCalledWith({ currentPassword: 's3cret', newPassword: 'new-password' });
    // In-modal success card, not an immediate close (unlike DeleteAccountModal).
    expect(q('.pcf-scrim')).not.toBeNull();
    expect(q('.pcf-center')).not.toBeNull();
    expect(q('.pcf-center').textContent).toContain('Password updated');
    // The form is gone; the × close button remains.
    expect(q('form.pcf-body')).toBeNull();
    expect(q('.pcf-x')).not.toBeNull();
  });

  it('"Done" on the success card closes the modal', async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    modal = PasswordChangeModal.open({ onConfirm });

    submitValid();
    await flush();
    q('.pcf-center .pcf-btn-primary').click();

    expect(q('.pcf-scrim')).toBeNull();
  });

  it('keeps the modal open and shows an inline error under Current password on INVALID_PASSWORD', async () => {
    const onConfirm = vi.fn().mockRejectedValue({ code: 'INVALID_PASSWORD', message: 'Incorrect password.' });
    modal = PasswordChangeModal.open({ onConfirm });

    submitValid({ current: 'wrong' });
    await flush();

    expect(q('.pcf-scrim')).not.toBeNull();
    expect(q('.pcf-field:nth-of-type(1)').classList.contains('pcf-err')).toBe(true);
    const error = q('.pcf-field:nth-of-type(1) .pcf-err-msg');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('Incorrect password.');
    // New/confirm fields are untouched by the error.
    expect(q('.pcf-field:nth-of-type(2)').classList.contains('pcf-err')).toBe(false);
  });

  it('closes on a non-INVALID_PASSWORD rejection (caller is responsible for its own toast)', async () => {
    const onConfirm = vi.fn().mockRejectedValue({ code: 'INTERNAL_ERROR' });
    modal = PasswordChangeModal.open({ onConfirm });

    submitValid();
    await flush();

    expect(q('.pcf-scrim')).toBeNull();
  });

  it('disables inputs and the submit button while a request is in flight', async () => {
    let resolveConfirm;
    const onConfirm = vi.fn(() => new Promise((resolve) => { resolveConfirm = resolve; }));
    modal = PasswordChangeModal.open({ onConfirm });

    submitValid();
    await flush();

    expect(curInput().disabled).toBe(true);
    expect(newInput().disabled).toBe(true);
    expect(confirmInput().disabled).toBe(true);
    expect(submitBtn().disabled).toBe(true);
    expect(submitBtn().textContent).toContain('Updating');

    resolveConfirm();
    await flush();
  });

  it('locks background scroll while open and restores it on close', () => {
    expect(document.body.style.overflow).toBe('');
    modal = PasswordChangeModal.open({ onConfirm: vi.fn() });
    expect(document.body.style.overflow).toBe('hidden');

    q('.pcf-x').click();
    expect(document.body.style.overflow).toBe('');
  });

  it('the × button closes without calling onConfirm', () => {
    const onConfirm = vi.fn();
    modal = PasswordChangeModal.open({ onConfirm });

    q('.pcf-x').click();

    expect(q('.pcf-scrim')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Cancel closes without calling onConfirm', () => {
    const onConfirm = vi.fn();
    modal = PasswordChangeModal.open({ onConfirm });

    q('.pcf-btn-outline').click();

    expect(q('.pcf-scrim')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape closes without calling onConfirm', () => {
    const onConfirm = vi.fn();
    modal = PasswordChangeModal.open({ onConfirm });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(q('.pcf-scrim')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('backdrop click closes without calling onConfirm', () => {
    const onConfirm = vi.fn();
    modal = PasswordChangeModal.open({ onConfirm });
    const scrim = q('.pcf-scrim');

    scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(q('.pcf-scrim')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape does not close while a request is in flight', async () => {
    const onConfirm = vi.fn(() => new Promise(() => {})); // never resolves
    modal = PasswordChangeModal.open({ onConfirm });

    submitValid();
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(q('.pcf-scrim')).not.toBeNull();
  });

  it('has dialog ARIA semantics and an accessible label on the peek toggle', () => {
    modal = PasswordChangeModal.open({ onConfirm: vi.fn() });

    const dialog = q('.pcf-modal');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('pcf-title');
    expect(document.getElementById('pcf-title').textContent).toBe('Change password');
    expect(document.querySelectorAll('.pcf-peek')[0].getAttribute('aria-label')).toBe('Show password');
  });

  it('T025: each field error region is a live region, and each peek toggle stays in the tab order', () => {
    modal = PasswordChangeModal.open({ onConfirm: vi.fn() });

    for (const errorEl of document.querySelectorAll('.pcf-err-msg')) {
      expect(errorEl.getAttribute('aria-live')).toBe('polite');
    }
    for (const peekBtn of document.querySelectorAll('.pcf-peek')) {
      expect(peekBtn.tabIndex).not.toBe(-1);
    }
  });

  it('keeps aria-labelledby pointing at a real element once the success card replaces the form', async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    modal = PasswordChangeModal.open({ onConfirm });

    submitValid();
    await flush();

    const dialog = q('.pcf-modal');
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(labelledById).toBe('pcf-title');
    const labelEl = document.getElementById(labelledById);
    expect(labelEl).not.toBeNull();
    expect(labelEl.textContent).toBe('Password updated');
    // The original "Change password" header title is gone with the form —
    // #pcf-title must now resolve to the success heading, not a stale node.
    expect(document.querySelectorAll('#pcf-title')).toHaveLength(1);
  });
});
