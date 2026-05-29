// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeleteAccountModal } from '../../src/components/DeleteAccountModal.js';

let modal;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const q = (sel) => document.querySelector(sel);

function setInput(value) {
  const input = q('.delete-modal__input');
  input.value = value;
  input.dispatchEvent(new Event('input'));
  return input;
}

afterEach(() => {
  modal?.close?.();
  modal = null;
  document.body.replaceChildren();
});

describe('DeleteAccountModal', () => {
  it('hosted: password field, danger button disabled until non-empty', () => {
    modal = DeleteAccountModal.open({ mode: 'hosted', onConfirm: vi.fn() });

    expect(q('.delete-modal__input').type).toBe('password');
    expect(q('.delete-modal__btn--danger').disabled).toBe(true);

    setInput('pw');
    expect(q('.delete-modal__btn--danger').disabled).toBe(false);
  });

  it('local: danger button enables only on exact "DELETE"', () => {
    modal = DeleteAccountModal.open({ mode: 'local', onConfirm: vi.fn() });

    expect(q('.delete-modal__input').type).toBe('text');

    setInput('delete');
    expect(q('.delete-modal__btn--danger').disabled).toBe(true);

    setInput('DELETE');
    expect(q('.delete-modal__btn--danger').disabled).toBe(false);
  });

  it('calls onConfirm with the gate value and closes on success', async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    modal = DeleteAccountModal.open({ mode: 'hosted', onConfirm });

    setInput('s3cret');
    q('.delete-modal__btn--danger').click();
    await flush();

    expect(onConfirm).toHaveBeenCalledWith('s3cret');
    expect(q('.delete-modal-backdrop')).toBeNull();
  });

  it('keeps open and shows the inline error on INVALID_PASSWORD', async () => {
    const onConfirm = vi.fn().mockRejectedValue({
      code: 'INVALID_PASSWORD',
      message: 'Incorrect password.',
    });
    modal = DeleteAccountModal.open({ mode: 'hosted', onConfirm });

    setInput('wrong');
    q('.delete-modal__btn--danger').click();
    await flush();

    expect(q('.delete-modal-backdrop')).not.toBeNull();
    const error = q('.delete-modal__error');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('Incorrect password.');
  });

  it('closes on a non-INVALID_PASSWORD error', async () => {
    const onConfirm = vi.fn().mockRejectedValue({ code: 'INTERNAL_ERROR' });
    modal = DeleteAccountModal.open({ mode: 'hosted', onConfirm });

    setInput('pw');
    q('.delete-modal__btn--danger').click();
    await flush();

    expect(q('.delete-modal-backdrop')).toBeNull();
  });

  it('locks background scroll while open and restores it on close', () => {
    expect(document.body.style.overflow).toBe('');
    modal = DeleteAccountModal.open({ mode: 'hosted', onConfirm: vi.fn() });
    expect(document.body.style.overflow).toBe('hidden');

    document.querySelector('.delete-modal__btn--cancel').click();
    expect(document.body.style.overflow).toBe('');
  });

  it('Cancel closes without calling onConfirm', () => {
    const onConfirm = vi.fn();
    modal = DeleteAccountModal.open({ mode: 'hosted', onConfirm });

    q('.delete-modal__btn--cancel').click();

    expect(q('.delete-modal-backdrop')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape closes without calling onConfirm', () => {
    const onConfirm = vi.fn();
    modal = DeleteAccountModal.open({ mode: 'hosted', onConfirm });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(q('.delete-modal-backdrop')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('backdrop click closes without calling onConfirm', () => {
    const onConfirm = vi.fn();
    modal = DeleteAccountModal.open({ mode: 'hosted', onConfirm });
    const backdrop = q('.delete-modal-backdrop');

    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(q('.delete-modal-backdrop')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
