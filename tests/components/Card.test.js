// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Card } from '../../src/components/Card.js';
import { STATUS_CONFIG, TERMINAL_STATES } from '../../src/models/application.js';
import { formatPeso } from '../../src/utils/currency.js';

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
});
