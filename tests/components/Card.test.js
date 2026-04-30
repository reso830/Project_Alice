// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Card } from '../../src/components/Card.js';
import { STATUS_CONFIG } from '../../src/models/application.js';

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
});
