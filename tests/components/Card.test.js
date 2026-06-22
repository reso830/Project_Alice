// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Card } from '../../src/components/Card.js';

function application(overrides = {}) {
  return {
    id: 1,
    jobTitle: 'Frontend Engineer',
    companyName: 'Acme',
    status: 'applied',
    lastStatusUpdate: '2026-04-27',
    compat: 72,
    salary: 120000,
    fav: false,
    skills: [],
    responsibilities: 'Build useful things.',
    ...overrides,
  };
}

describe('Card selected state', () => {
  it('adds selected class and aria-selected only when selected', () => {
    const selected = Card.render(application(), {}, { selected: true });
    const plain = Card.render(application({ id: 2 }), {});

    expect(selected.classList.contains('card--selected')).toBe(true);
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(plain.classList.contains('card--selected')).toBe(false);
    expect(plain.hasAttribute('aria-selected')).toBe(false);
  });
});
