// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/api.js', () => ({
  archive: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../src/components/ConfirmDialog.js', () => ({
  ConfirmDialog: { show: vi.fn() },
}));

import * as api from '../../src/services/api.js';
import { ConfirmDialog } from '../../src/components/ConfirmDialog.js';
import {
  Modal,
  getHeaderContrastClass,
  getHeaderContrastRatio,
} from '../../src/components/Modal.js';
import { STATUS_CONFIG } from '../../src/models/application.js';
import { formatPeso } from '../../src/utils/currency.js';

function application(overrides = {}) {
  return {
    id: 1,
    jobTitle: 'Frontend Engineer',
    companyName: 'Acme',
    status: 'wishlisted',
    lastStatusUpdate: '2026-04-30',
    compat: 80,
    recruiter: '',
    salary: 150000,
    responsibilities: 'Build UI',
    skills: ['JavaScript'],
    jobPostingUrl: '',
    ...overrides,
  };
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
}

function getSalaryFieldValue() {
  return [...document.querySelectorAll('.modal-field')]
    .find((field) => field.querySelector('.modal-field__label')?.textContent === 'Salary')
    ?.querySelector('.modal-field__value');
}

afterEach(() => {
  Modal.close();
  document.body.replaceChildren();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('Modal', () => {
  it('renders the status-colored header and badge from STATUS_CONFIG', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());

    const header = document.querySelector('.modal-header');
    const badge = document.querySelector('#modal-status-badge');

    expect(header.style.backgroundColor).toBe(hexToRgb(STATUS_CONFIG.wishlisted.borderAccent));
    expect(header.style.color).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeText));
    expect(badge.style.backgroundColor).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeBg));
    expect(badge.style.color).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeText));
  });

  it('chooses contrast classes that meet WCAG AA for every status accent', () => {
    for (const config of Object.values(STATUS_CONFIG)) {
      expect(getHeaderContrastRatio(config.borderAccent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('renders icon-only quick actions in the required order', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());

    const actions = [...document.querySelectorAll('.modal-quick-action')];

    expect(actions).toHaveLength(3);
    expect(actions[0].classList.contains('modal-quick-action--favorite')).toBe(true);
    expect(actions[1].classList.contains('modal-quick-action--status')).toBe(true);
    expect(actions[2].classList.contains('modal-quick-action--archive')).toBe(true);
    expect(actions.every((button) => button.querySelector('svg.icon'))).toBe(true);
    expect(actions.every((button) => !button.querySelector('.modal-quick-action__label'))).toBe(true);
  });

  it('formats salary as Philippine Peso', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ salary: 150000 }));

    expect(document.body.textContent).toContain(formatPeso(150000));
  });

  it('renders empty salary text for absent salary values', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application({ salary: null }));

    expect(getSalaryFieldValue().textContent).toBe('');
  });

  it('toggles favorite through PATCH and updates the quick action state', async () => {
    const onApplicationUpdate = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    api.update.mockResolvedValue({ ...application(), fav: true });

    Modal.open(application(), { onApplicationUpdate });
    document.querySelector('.modal-quick-action--favorite').click();
    await Promise.resolve();

    expect(api.update).toHaveBeenCalledWith(1, { fav: true });
    expect(document.querySelector('.modal-quick-action--favorite svg.icon')).not.toBeNull();
    expect(document.querySelector('.modal-quick-action--favorite .modal-quick-action__label')).toBeNull();
    expect(onApplicationUpdate).toHaveBeenCalledWith(expect.objectContaining({ fav: true }));
  });

  it('archives only after confirmation and reports the updated record', async () => {
    const onArchiveSuccess = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    api.archive.mockResolvedValue({ ...application(), archived: true, fav: false });

    Modal.open(application(), { onArchiveSuccess });
    document.querySelector('.modal-quick-action--archive').click();
    await Promise.resolve();

    expect(api.archive).not.toHaveBeenCalled();
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();

    document.querySelector('.modal-quick-action--archive').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.archive).toHaveBeenCalledWith(1);
    expect(onArchiveSuccess).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('keeps the overlay open and shows an error when archive fails', async () => {
    const onArchiveSuccess = vi.fn();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    ConfirmDialog.show.mockResolvedValue(true);
    api.archive.mockRejectedValue(new Error('server error'));

    Modal.open(application(), { onArchiveSuccess });
    document.querySelector('.modal-quick-action--archive').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.archive).toHaveBeenCalledWith(1);
    expect(onArchiveSuccess).not.toHaveBeenCalled();
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();
    expect(document.body.textContent).toContain('Archive failed');
  });

  it('copies populated job links and disables empty link fields', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    Modal.open(application({ jobPostingUrl: 'https://example.com/job' }));
    document.querySelector('.modal-link-field').click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('https://example.com/job');
    expect(document.body.textContent).toContain('Link copied');

    Modal.open(application({ jobPostingUrl: '' }));
    const disabledLink = document.querySelector('.modal-link-field');

    expect(disabledLink.disabled).toBe(true);
    expect(disabledLink.classList.contains('modal-link-field--disabled')).toBe(true);
    disabledLink.click();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('Could not copy link');
  });

  it('shows an error toast when clipboard copy fails', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
    });

    Modal.open(application({ jobPostingUrl: 'https://example.com/job' }));
    document.querySelector('.modal-link-field').click();
    await Promise.resolve();

    expect(document.body.textContent).toContain('Could not copy link');
  });
});
