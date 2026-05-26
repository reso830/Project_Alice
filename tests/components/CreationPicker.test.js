// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/Modal.js', () => ({
  Modal: { open: vi.fn(), close: vi.fn() },
}));

import { CreationPicker } from '../../src/components/CreationPicker.js';
import { Modal } from '../../src/components/Modal.js';

function findCardByTitle(title) {
  return [...document.querySelectorAll('.creation-picker-card')]
    .find((card) => card.querySelector('.creation-picker-card__title')?.textContent === title);
}

describe('CreationPicker.open() callback contract (issue #41)', () => {
  beforeEach(() => {
    Modal.open.mockClear();
  });

  afterEach(() => {
    CreationPicker.close();
  });

  it('forwards only the documented callbacks to Modal.open, dropping unknown keys', () => {
    const onApplicationCreate = vi.fn();
    const onApplicationUpdate = vi.fn();
    const onArchiveSuccess = vi.fn();

    CreationPicker.open({
      onApplicationCreate,
      onApplicationUpdate,
      onArchiveSuccess,
      prefill: { companyName: 'Should not leak' },
      mode: 'edit',
      onSubmit: vi.fn(),
    });

    findCardByTitle('Manual Entry').click();

    expect(Modal.open).toHaveBeenCalledTimes(1);
    expect(Modal.open).toHaveBeenCalledWith(null, {
      mode: 'create',
      onApplicationCreate,
      onApplicationUpdate,
      onArchiveSuccess,
    });
  });

  it('tolerates a missing callbacks argument', () => {
    CreationPicker.open();
    findCardByTitle('Manual Entry').click();

    expect(Modal.open).toHaveBeenCalledWith(null, {
      mode: 'create',
      onApplicationCreate: undefined,
      onApplicationUpdate: undefined,
      onArchiveSuccess: undefined,
    });
  });
});
