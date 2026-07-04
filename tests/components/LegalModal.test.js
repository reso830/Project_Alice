// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach } from 'vitest';
import { LegalModal } from '../../src/components/LegalModal.js';

describe('LegalModal renderer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  it('renders the terms dialog with legal content and required accessibility attributes', () => {
    const onClose = vi.fn();

    const overlay = LegalModal.render('terms', onClose);

    expect(overlay.className).toBe('legal-overlay');
    const dialog = overlay.querySelector('.legal-modal');
    const title = overlay.querySelector('.legal-modal__title');

    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(title.textContent).toBe('Terms & Conditions');
    expect(overlay.querySelector('.legal-modal__close').textContent).toBe('✕');
    expect(overlay.textContent).toContain('v0.3.0 · Effective Apr 1, 2026');
    expect(overlay.textContent).toContain('Notice:');
    expect(overlay.textContent).toContain('1. Acceptance of terms');
    expect(overlay.querySelector('.legal-modal__handle')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('calls onClose from close button, footer button, backdrop, and Escape', () => {
    const onClose = vi.fn();
    const overlay = LegalModal.render('privacy', onClose);

    overlay.querySelector('.legal-modal__close').click();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.body.contains(overlay)).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('cleans up document-level Escape listeners after dismissal', () => {
    const onCloseA = vi.fn();
    const overlayA = LegalModal.render('terms', onCloseA);

    overlayA.querySelector('.legal-modal__footer-button').click();

    const onCloseB = vi.fn();
    LegalModal.render('privacy', onCloseB);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onCloseA).toHaveBeenCalledTimes(1);
    expect(onCloseB).toHaveBeenCalledTimes(1);
  });

  it('dismisses from footer button, backdrop, and Escape', () => {
    for (const triggerClose of [
      (overlay) => overlay.querySelector('.legal-modal__footer-button').click(),
      (overlay) => overlay.dispatchEvent(new MouseEvent('click', { bubbles: true })),
      () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    ]) {
      const onClose = vi.fn();
      const overlay = LegalModal.render('privacy', onClose);

      triggerClose(overlay);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(document.body.contains(overlay)).toBe(false);
    }
  });

  it('cycles focus inside the dialog on Tab', () => {
    const overlay = LegalModal.render('privacy', vi.fn());
    const closeButton = overlay.querySelector('.legal-modal__close');
    const footerButton = overlay.querySelector('.legal-modal__footer-button');

    closeButton.focus();
    overlay.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
    }));

    expect(document.activeElement).toBe(footerButton);

    overlay.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
    }));

    expect(document.activeElement).toBe(closeButton);
  });
});
