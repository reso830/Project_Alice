// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Card } from '../../src/components/Card.js';
import { Toast } from '../../src/components/Toast.js';
import * as api from '../../src/services/api.js';
import { STATUS_CONFIG, TERMINAL_STATES } from '../../src/models/application.js';
import { formatPeso } from '../../src/utils/currency.js';

const mainCss = readFileSync(join(cwd(), 'src/styles/main.css'), 'utf8');

vi.mock('../../src/services/api.js', () => ({
  unarchive: vi.fn(),
}));

vi.mock('../../src/components/Toast.js', () => ({
  Toast: { show: vi.fn() },
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

async function flushPromises(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
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

  it('does not style disabled card actions as interactive on hover', () => {
    expect(mainCss).toContain('.card-btn:not(:disabled):hover');
    expect(mainCss).toContain('.card-btn:disabled');
    expect(mainCss).toContain('cursor: not-allowed;');
  });

  it('clamps skill tags to two rows so long skill lists do not stretch cards', () => {
    const skillsRule = [...mainCss.matchAll(/\.skills\s*\{[^}]+\}/gu)]
      .map((match) => match[0])
      .find((rule) => rule.includes('display: flex;'));

    expect(skillsRule).toContain('flex-wrap: wrap;');
    expect(skillsRule).toContain('max-height: calc(((11px * 1.45) + 4px) * 2 + 5px);');
    expect(skillsRule).toContain('overflow: hidden;');
  });

  it('summarizes long card skill lists with a visible hidden-count chip', () => {
    const skills = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'GraphQL', 'Jest', 'Playwright', 'AWS'];
    const card = Card.render(application({ skills }));
    const skillsEl = card.querySelector('.skills');
    const tags = [...skillsEl.querySelectorAll('.skill-tag')];

    expect(tags.map((tag) => tag.textContent)).toEqual([
      'React',
      'TypeScript',
      'Node.js',
      'PostgreSQL',
      'GraphQL',
      'Jest',
      '+2 more',
    ]);
    expect(tags.at(-1).classList.contains('skill-tag--more')).toBe(true);
    expect(tags.at(-1).getAttribute('aria-label')).toBe('2 more required skills');
    expect(skillsEl.title).toBe('8 required skills. Open details to view all.');
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

  it('marks the archive action busy and prevents duplicate archive requests', async () => {
    let resolveArchive;
    const onArchive = vi.fn(() => new Promise((resolve) => {
      resolveArchive = resolve;
    }));
    const card = Card.render(application(), { onArchive });
    const archiveButton = card.querySelector('.card-btn--archive');

    archiveButton.click();
    archiveButton.click();

    expect(archiveButton.getAttribute('aria-busy')).toBe('true');
    expect(archiveButton.disabled).toBe(true);
    expect(onArchive).toHaveBeenCalledTimes(1);

    resolveArchive();
    await flushPromises();

    expect(archiveButton.hasAttribute('aria-busy')).toBe(false);
    expect(archiveButton.disabled).toBe(false);
  });

  it('uses the archive-specific failure toast when archive fails', async () => {
    const onArchive = vi.fn(() => Promise.reject(new Error('nope')));
    const card = Card.render(application(), { onArchive });
    const archiveButton = card.querySelector('.card-btn--archive');

    archiveButton.click();
    await flushPromises();

    expect(Toast.show).toHaveBeenCalledWith("Couldn't archive.", 'failure');
  });

  it('marks the unarchive action busy and prevents duplicate unarchive requests', async () => {
    const updated = application({ archived: false, archivedDate: null });
    let resolveUnarchive;
    api.unarchive.mockReturnValue(new Promise((resolve) => {
      resolveUnarchive = resolve;
    }));
    const onUnarchiveSuccess = vi.fn();
    const card = Card.render(application({ archived: true }), { onUnarchiveSuccess });
    const unarchiveButton = card.querySelector('.card-btn--unarchive');

    unarchiveButton.click();
    unarchiveButton.click();

    expect(unarchiveButton.getAttribute('aria-busy')).toBe('true');
    expect(unarchiveButton.disabled).toBe(true);
    expect(api.unarchive).toHaveBeenCalledTimes(1);

    resolveUnarchive(updated);
    await flushPromises();

    expect(unarchiveButton.hasAttribute('aria-busy')).toBe(false);
    expect(unarchiveButton.disabled).toBe(false);
    expect(onUnarchiveSuccess).toHaveBeenCalledWith(updated);
  });
});
