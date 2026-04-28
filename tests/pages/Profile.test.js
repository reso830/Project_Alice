// @vitest-environment jsdom
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

describe('Profile page', () => {
  it('renders the no-profile state and wires navigation callbacks', async () => {
    const container = document.createElement('main');
    const navigate = vi.fn();

    api.getProfile.mockResolvedValue(null);
    api.getAll.mockResolvedValue([createApplication()]);

    await Profile.mount(container, { navigate });

    expect(container.querySelector('h1')?.textContent).toBe('Welcome back.');
    expect(container.textContent).toContain('No profile set up yet.');

    getButton(container, 'Go to Tracker').click();
    getButton(container, 'Set Up Profile').click();

    expect(navigate).toHaveBeenCalledWith('tracker');
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
      skills: ['JavaScript'],
      languages: [],
      certifications: [],
      awards: [],
      links: [
        { platform: 'Portfolio', label: 'alex.dev', url: 'https://alex.dev' },
        { platform: 'Unsafe', label: 'bad link', url: 'javascript:alert(1)' },
      ],
    });
    api.getAll.mockResolvedValue([createApplication({ status: 'offer' })]);

    await Profile.mount(container, { navigate });

    expect(container.querySelector('h1')?.textContent).toBe('Welcome back, Alex.');
    expect(container.querySelector('.profile-basic__name')?.textContent).toBe('Alex Rivera');
    expect(container.textContent).toContain('Frontend engineer.');
    expect(container.textContent).toContain('JavaScript');
    expect(container.querySelectorAll('.link-chip')[0].getAttribute('href')).toBe('https://alex.dev/');
    expect(container.querySelectorAll('.link-chip')[1].getAttribute('href')).toBe('#');

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

  it('clears rendered content on unmount', async () => {
    const container = document.createElement('main');

    api.getProfile.mockResolvedValue(null);
    api.getAll.mockResolvedValue([]);

    await Profile.mount(container, { navigate: vi.fn() });
    Profile.unmount();

    expect(container.childElementCount).toBe(0);
  });
});
