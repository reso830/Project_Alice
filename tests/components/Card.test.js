// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Card } from '../../src/components/Card.js';
import * as api from '../../src/services/api.js';
import { STATUS_CONFIG, TERMINAL_STATES } from '../../src/models/application.js';
import { formatPeso } from '../../src/utils/currency.js';

const mainCss = readFileSync(join(cwd(), 'src/styles/main.css'), 'utf8');

vi.mock('../../src/services/api.js', () => ({
  unarchive: vi.fn(),
}));

function application(overrides = {}) {
  return {
    id: 1,
    jobTitle: 'Frontend Engineer',
    companyName: 'Acme',
    status: 'wishlisted',
    lastStatusUpdate: '2026-04-30',
    compat: 80,
    fav: false,
    responsibilities: 'Build UI',
    skills: ['JavaScript'],
    salary: 150000,
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
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe('Card', () => {
  it('renders status badge and accent from STATUS_CONFIG', () => {
    const card = Card.render(application());
    const badge = card.querySelector('.status-badge');

    expect(card.style.borderLeft).toBe(`4px solid ${hexToRgb(STATUS_CONFIG.wishlisted.borderAccent)}`);
    expect(badge.style.backgroundColor).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeBg));
    expect(badge.style.color).toBe(hexToRgb(STATUS_CONFIG.wishlisted.badgeText));
  });

  it('uses an inline SVG clipboard icon for the copy action', () => {
    const card = Card.render(application());
    const copyButton = card.querySelector('[aria-label="Copy job URL"]');

    expect(copyButton.textContent).toBe('');
    expect(copyButton.querySelector('svg')).not.toBeNull();
  });

  it('uses normalized SVG icons for all card action buttons', () => {
    const card = Card.render(application());
    const actions = card.querySelectorAll('.card-btn');

    expect(actions).toHaveLength(5);
    expect([...actions].every((button) => button.textContent === '')).toBe(true);
    expect([...actions].every((button) => button.querySelector('svg.icon'))).toBe(true);
  });

  it('disables the status button for terminal states', () => {
    for (const status of TERMINAL_STATES) {
      const card = Card.render(application({ status }));
      const statusButton = card.querySelector('[aria-label="Change status"]');

      expect(statusButton.disabled).toBe(true);
      expect(statusButton.title).toBe('Workflow complete');
    }
  });

  it('does not style disabled card actions as interactive on hover', () => {
    expect(mainCss).toContain('.card-btn:not(:disabled):hover');
    expect(mainCss).toContain('.card-btn:disabled');
    expect(mainCss).toContain('cursor: not-allowed;');
  });

  it('keeps the status button enabled for active states', () => {
    const card = Card.render(application({ status: 'applied' }));
    const statusButton = card.querySelector('[aria-label="Change status"]');

    expect(statusButton.disabled).toBe(false);
  });

  it('keeps all card actions visible for terminal states', () => {
    const card = Card.render(application({ status: 'rejected' }));

    expect(card.querySelectorAll('.card-btn')).toHaveLength(5);
  });

  it('uses a filing-box archive icon distinct from close semantics', () => {
    const card = Card.render(application());
    const archiveButton = card.querySelector('[aria-label="Archive application permanently from active list"]');

    expect(archiveButton.querySelector('path')?.getAttribute('d')).toContain('M4 7h16v12H4V7');
  });

  it('formats salary as Philippine Peso', () => {
    const card = Card.render(application({ salary: 150000 }));

    expect(card.querySelector('.salary').textContent).toBe(formatPeso(150000));
  });

  it('renders empty salary text for absent salary values', () => {
    const card = Card.render(application({ salary: 0 }));

    expect(card.querySelector('.salary').textContent).toBe('');
  });

  it('renders archived card metadata and collapses actions to unarchive', () => {
    const card = Card.render(application({
      archived: true,
      archivedDate: '2026-05-01',
    }));

    expect(card.classList.contains('card-archived')).toBe(true);
    expect(card.querySelector('.card-archived-stamp')?.textContent).toBe('Archived');
    expect(card.querySelector('.date')?.textContent).toMatch(/^Archived /);
    expect(card.querySelectorAll('.card-btn')).toHaveLength(1);
    expect(card.querySelector('.card-btn--unarchive')).not.toBeNull();
    expect(card.querySelector('.card-btn--archive')).toBeNull();
    expect(card.querySelector('.card-btn--edit')).toBeNull();
    expect(card.querySelector('.card-btn--status')).toBeNull();
    expect(card.querySelector('.card-btn--copy')).toBeNull();
    expect(card.querySelector('.card-btn--star')).toBeNull();
  });

  it('falls back to lastStatusUpdate for archived date text', () => {
    const card = Card.render(application({
      archived: true,
      archivedDate: null,
      lastStatusUpdate: '2026-04-30',
    }));

    expect(card.querySelector('.date')?.textContent).toMatch(/^Archived /);
    expect(card.querySelector('.date')?.textContent).toContain('Apr');
  });

  it('unarchives from the archived action without opening the card', async () => {
    const onOpen = vi.fn();
    const onUnarchiveSuccess = vi.fn();
    const updated = application({ archived: false, archivedDate: null });
    api.unarchive.mockResolvedValue(updated);

    const card = Card.render(application({ archived: true }), {
      onOpen,
      onUnarchiveSuccess,
    });

    card.querySelector('.card-btn--unarchive')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(api.unarchive).toHaveBeenCalledWith(1);
    expect(onUnarchiveSuccess).toHaveBeenCalledWith(updated);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
