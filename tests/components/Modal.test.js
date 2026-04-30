// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../../src/components/Modal.js';
import { STATUS_CONFIG } from '../../src/models/application.js';

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

afterEach(() => {
  Modal.close();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Modal', () => {
  it('renders the header status badge from STATUS_CONFIG', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    Modal.open(application());

    const badge = document.querySelector('#modal-status-badge');

    expect(badge.style.backgroundColor).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeBg));
    expect(badge.style.color).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeText));
  });
});
