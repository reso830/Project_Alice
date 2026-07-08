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

describe('Card pending state', () => {
  it('adds pending class and aria-busy only when pending', () => {
    const pending = Card.render(application(), {}, { pending: true });
    const plain = Card.render(application({ id: 2 }), {});

    expect(pending.classList.contains('card--pending')).toBe(true);
    expect(pending.getAttribute('aria-busy')).toBe('true');
    expect(plain.classList.contains('card--pending')).toBe(false);
    expect(plain.hasAttribute('aria-busy')).toBe(false);
  });

  it('disables all action buttons while pending, so keyboard users cannot activate them', () => {
    const pending = Card.render(application(), {}, { pending: true });
    const buttons = [...pending.querySelectorAll('.card-btn')];

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });
});

describe('Card quick action tooltips', () => {
  it('adds native hover titles to active application card actions', () => {
    const card = Card.render(application());

    expect(card.querySelector('.card-btn--edit').title).toBe('Edit');
    expect(card.querySelector('.card-btn--status').title).toBe('Change status');
    expect(card.querySelector('.card-btn--copy').title).toBe('Copy URL');
    expect(card.querySelector('.card-btn--star').title).toBe('Star');
    expect(card.querySelector('.card-btn--archive').title).toBe('Archive');
  });

  it('uses unstar copy for favorited application card actions', () => {
    const card = Card.render(application({ fav: true }));
    const starButton = card.querySelector('.card-btn--star');

    expect(starButton.getAttribute('aria-label')).toBe('Unstar application');
    expect(starButton.title).toBe('Unstar');
  });

  it('keeps the star tooltip and accessible name in sync after clicking', () => {
    const card = Card.render(application());
    const starButton = card.querySelector('.card-btn--star');

    starButton.click();
    expect(starButton.classList).toContain('card-btn--starred');
    expect(starButton.getAttribute('aria-label')).toBe('Unstar application');
    expect(starButton.title).toBe('Unstar');

    starButton.click();
    expect(starButton.classList).not.toContain('card-btn--starred');
    expect(starButton.getAttribute('aria-label')).toBe('Star application');
    expect(starButton.title).toBe('Star');
  });

  it('keeps terminal status title focused on the disabled reason', () => {
    const card = Card.render(application({ status: 'ghosted' }));
    const statusButton = card.querySelector('.card-btn--status');

    expect(statusButton.disabled).toBe(true);
    expect(statusButton.getAttribute('aria-label')).toBe('Status locked — workflow complete');
    expect(statusButton.title).toBe('Workflow complete');
  });
});
