// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/api.js', () => ({
  getAll: vi.fn(),
  getProfile: vi.fn(),
}));

import * as api from '../../src/services/api.js';
import { Profile } from '../../src/pages/Profile.js';

afterEach(() => {
  Profile.unmount();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

function createApplication(overrides = {}) {
  return {
    id: 1,
    companyName: 'Acme Corp',
    jobTitle: 'Frontend Engineer',
    status: 'applied',
    ...overrides,
  };
}

function getButton(container, label) {
  return [...container.querySelectorAll('button')]
    .find((button) => button.textContent === label);
}

function getSubsection(container, label) {
  return [...container.querySelectorAll('.profile-subsection')]
    .find((section) => section.querySelector('.profile-subsection__label')?.textContent.includes(label));
}

describe('Profile page', () => {
  it('scopes desktop application stat chips to a two-column grid', () => {
    const css = readFileSync('src/styles/main.css', 'utf8').replace(/\r\n/g, '\n');

    expect(css).toContain(`.apps-desktop-vis__stats .stat-chip-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}`);
  });

  it('renders the no-profile state and wires navigation callbacks', async () => {
    const container = document.createElement('main');
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue(null);
    api.getAll.mockResolvedValue([createApplication()]);

    await Profile.mount(container, { navigate });

    expect(container.querySelector('h1')?.textContent).toBe('Welcome back.');
    expect(container.textContent).toContain('No profile set up yet.');

    expect(getButton(container, 'Set Up Profile')).toBeUndefined();
    expect(getButton(container, 'Upload Resume')).toBeTruthy();
    expect(getButton(container, 'Build Profile Manually')).toBeTruthy();

    getButton(container, 'Go to Tracker').click();
    getButton(container, 'Upload Resume').click();
    getButton(container, 'Build Profile Manually').click();

    expect(navigate).toHaveBeenCalledWith('tracker');
    expect(navigate).toHaveBeenCalledWith('profile-edit', { highlightImport: true });
    expect(navigate).toHaveBeenCalledWith('profile-edit');
  });

  it('renders a saved profile and wires edit navigation', async () => {
    const container = document.createElement('main');
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue({
      firstName: 'Alex',
      lastName: 'Rivera',
      city: 'Austin',
      email: 'alex@example.com',
      phone: '555-0100',
      summary: 'Frontend engineer.',
      experience: [{
        role: 'Frontend Engineer',
        company: 'Acme',
        responsibilities: 'Build dashboards.',
        dateStarted: '01/2022',
        currentWork: true,
      }],
      education: [{
        degreeMajor: 'BS Computer Science',
        university: 'State University',
        yearCompleted: '2020',
      }],
      skills: ['JavaScript'],
      languages: [{ language: 'English', proficiency: 'Fluent' }],
      certifications: [{ name: 'AWS Developer', issuingBody: 'Amazon', issuanceDate: '02/2023' }],
      awards: [{ awardName: 'Top Performer', issuingBody: 'Acme', date: '03/2024' }],
      links: [
        { friendlyName: 'Portfolio', url: 'https://alex.dev' },
        { friendlyName: '', url: 'https://github.com/alex' },
        { friendlyName: 'bad link', url: 'javascript:alert(1)' },
      ],
    });
    api.getAll.mockResolvedValue([createApplication({ status: 'offer' })]);

    await Profile.mount(container, { navigate });

    expect(container.querySelector('h1')?.textContent).toBe('Welcome back, Alex.');
    expect(container.querySelector('.profile-basic__name')?.textContent).toBe('Alex Rivera');
    expect(container.textContent).toContain('Frontend engineer.');
    expect(container.textContent).toContain('Build dashboards.');
    expect(container.textContent).toContain('01/2022 - Present');
    expect(container.textContent).toContain('BS Computer Science');
    expect(container.textContent).toContain('State University | 2020');
    expect(container.textContent).toContain('JavaScript');
    expect(container.textContent).toContain('AWS Developer');
    expect(container.textContent).toContain('Amazon');
    expect(container.textContent).toContain('02/2023');
    expect(container.textContent).toContain('Top Performer');
    expect(container.textContent).toContain('Acme | 03/2024');
    expect(container.textContent).toContain('English | Fluent');
    expect(container.querySelectorAll('.link-chip')[0].getAttribute('href')).toBe('https://alex.dev/');
    expect(container.querySelectorAll('.link-chip')[0].textContent).toBe('Portfolio');
    expect(container.querySelectorAll('.link-chip')[1].textContent).toBe('github.com');
    expect(container.querySelectorAll('.link-chip')[2].getAttribute('href')).toBe('#');

    getButton(container, 'Edit Profile').click();

    expect(navigate).toHaveBeenCalledWith('profile-edit');
  });

  it('handles application load failures without blocking profile rendering', async () => {
    const container = document.createElement('main');

    api.getProfile.mockResolvedValue({
      firstName: 'Taylor',
      lastName: 'Ng',
      skills: [],
      languages: [],
      certifications: [],
      awards: [],
      links: [],
    });
    api.getAll.mockRejectedValue(new Error('offline'));

    await Profile.mount(container, { navigate: vi.fn() });

    expect(container.textContent).toContain('Application data is unavailable right now.');
    expect([...container.querySelectorAll('.stat-chip__value')].map((chip) => chip.textContent))
      .toEqual(['0', '0', '0', '0', '0', '0', '0', '0']);
    expect(container.querySelector('.profile-basic__name')?.textContent).toBe('Taylor Ng');
    expect(container.querySelector('.pill-tag')).toBeNull();
  });

  it('shows desktop status legend counts and highlights the matching legend item from donut hover', async () => {
    const container = document.createElement('main');

    api.getProfile.mockResolvedValue(null);
    api.getAll.mockResolvedValue([
      createApplication({ id: 1, status: 'applied' }),
      createApplication({ id: 2, status: 'applied' }),
      createApplication({ id: 3, status: 'offer' }),
    ]);

    await Profile.mount(container, { navigate: vi.fn() });

    const legendItems = [...container.querySelectorAll('.apps-desktop-vis .chart-legend__item')];
    const applied = legendItems.find((item) => item.dataset.status === 'applied');
    const offer = legendItems.find((item) => item.dataset.status === 'offer');

    expect(applied.querySelector('.chart-legend__label').textContent).toBe('Applied');
    expect(applied.querySelector('.chart-legend__value').textContent).toBe('2');
    expect(offer.querySelector('.chart-legend__value').textContent).toBe('1');

    container.querySelector('.donut-chart path[data-status="applied"]')
      .dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true, clientX: 100, clientY: 100 }));

    expect(applied.classList.contains('chart-legend__item--active')).toBe(true);
    expect(offer.classList.contains('chart-legend__item--muted')).toBe(true);

    container.querySelector('.donut-chart')
      .dispatchEvent(new window.MouseEvent('mouseleave', { bubbles: true }));

    expect(applied.classList.contains('chart-legend__item--active')).toBe(false);
    expect(offer.classList.contains('chart-legend__item--muted')).toBe(false);
  });

  it('renders certifications with structured entry hierarchy', async () => {
    const container = document.createElement('main');

    api.getProfile.mockResolvedValue({
      firstName: 'Alex',
      lastName: 'Rivera',
      certifications: [{
        name: 'AWS Developer',
        issuingBody: 'Amazon',
        issuanceDate: '02/2023',
        expiryDate: '02/2026',
        certificateId: 'CERT-123',
      }],
    });
    api.getAll.mockResolvedValue([]);

    await Profile.mount(container, { navigate: vi.fn() });

    const section = getSubsection(container, 'CERTIFICATIONS');
    const list = section.querySelector('.profile-entry-list');
    const entry = list.querySelector('.profile-entry');
    const meta = [...entry.querySelectorAll('.profile-entry__meta')].map((el) => el.textContent);

    expect(list).not.toBeNull();
    expect(entry.querySelector('.profile-entry__title')?.textContent).toBe('AWS Developer');
    expect(meta).toContain('Amazon');
    expect(meta).toContain('02/2023 – 02/2026');
    expect(entry.querySelector('.profile-entry__meta--secondary')?.textContent).toBe('ID: CERT-123');
  });

  it('renders certifications with partial data without breaking', async () => {
    const container = document.createElement('main');

    api.getProfile.mockResolvedValue({
      firstName: 'Alex',
      lastName: 'Rivera',
      certifications: [{
        name: 'AWS Developer',
        issuingBody: 'Amazon',
      }],
    });
    api.getAll.mockResolvedValue([]);

    await Profile.mount(container, { navigate: vi.fn() });

    const section = getSubsection(container, 'CERTIFICATIONS');
    const entry = section.querySelector('.profile-entry');
    const meta = [...entry.querySelectorAll('.profile-entry__meta')].map((el) => el.textContent);

    expect(entry.querySelector('.profile-entry__title')?.textContent).toBe('AWS Developer');
    expect(meta).toEqual(['Amazon']);
    expect(meta.every((text) => text.trim().length > 0)).toBe(true);
    expect(entry.querySelector('.profile-entry__meta--secondary')).toBeNull();
  });

  it('renders awards with structured entry hierarchy', async () => {
    const container = document.createElement('main');

    api.getProfile.mockResolvedValue({
      firstName: 'Alex',
      lastName: 'Rivera',
      awards: [{
        awardName: 'Top Performer',
        issuingBody: 'Acme',
        date: '03/2024',
        details: 'Recognized for dashboard delivery.',
      }],
    });
    api.getAll.mockResolvedValue([]);

    await Profile.mount(container, { navigate: vi.fn() });

    const section = getSubsection(container, 'AWARDS');
    const list = section.querySelector('.profile-entry-list');
    const entry = list.querySelector('.profile-entry');

    expect(list).not.toBeNull();
    expect(entry.querySelector('.profile-entry__title')?.textContent).toBe('Top Performer');
    expect(entry.querySelector('.profile-entry__meta')?.textContent).toBe('Acme | 03/2024');
    expect(entry.querySelector('.profile-entry__desc')?.textContent).toBe('Recognized for dashboard delivery.');
  });

  it('renders awards with no details and no date without breaking', async () => {
    const container = document.createElement('main');

    api.getProfile.mockResolvedValue({
      firstName: 'Alex',
      lastName: 'Rivera',
      awards: [{
        awardName: 'Top Performer',
        issuingBody: 'Acme',
      }],
    });
    api.getAll.mockResolvedValue([]);

    await Profile.mount(container, { navigate: vi.fn() });

    const section = getSubsection(container, 'AWARDS');
    const entry = section.querySelector('.profile-entry');
    const meta = [...entry.querySelectorAll('.profile-entry__meta')].map((el) => el.textContent);

    expect(entry.querySelector('.profile-entry__title')?.textContent).toBe('Top Performer');
    expect(meta).toEqual(['Acme']);
    expect(meta.every((text) => text.trim().length > 0)).toBe(true);
    expect(entry.querySelector('.profile-entry__desc')).toBeNull();
  });

  it('clears rendered content on unmount', async () => {
    const container = document.createElement('main');

    api.getProfile.mockResolvedValue(null);
    api.getAll.mockResolvedValue([]);

    await Profile.mount(container, { navigate: vi.fn() });
    Profile.unmount();

    expect(container.childElementCount).toBe(0);
  });
});
