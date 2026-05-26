// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authStateRef = vi.hoisted(() => ({
  value: { status: 'local-mode', user: null, accessToken: null },
}));

vi.mock('../../src/services/api.js', () => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  getProfile: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../src/data/authStore.js', () => ({
  getAuthState: vi.fn(() => authStateRef.value),
}));

vi.mock('../../src/components/Toast.js', () => ({
  Toast: { show: vi.fn() },
}));

vi.mock('../../src/components/Modal.js', () => ({
  Modal: {
    open: vi.fn(),
    close: vi.fn(),
  },
}));

import * as api from '../../src/services/api.js';
import { Modal } from '../../src/components/Modal.js';
import { Toast } from '../../src/components/Toast.js';
import * as dismissals from '../../src/utils/calendarDismissals.js';
import { Calendar, chooseGreeting, formatGreeting } from '../../src/pages/Calendar.js';
import { formatDateLabel } from '../../src/pages/Calendar.js';

function app(id, overrides = {}) {
  return {
    id,
    companyName: `Company ${id}`,
    jobTitle: `Role ${id}`,
    status: 'applied',
    lastStatusUpdate: '2026-05-14',
    timeline: [
      { id: 1, date: '2026-05-14', status: 'applied', text: 'Applied' },
    ],
    ...overrides,
  };
}

function mountHost() {
  const host = document.createElement('main');
  document.body.append(host);
  return host;
}

function setViewport(width) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

function fixtureApps() {
  return [
    app(1, {
      timeline: [{ id: 1, date: '2026-05-21', status: 'interview', text: 'Today interview' }],
      status: 'interview',
      lastStatusUpdate: '2026-05-21',
    }),
    app(2, {
      timeline: [{ id: 1, date: '2026-05-01', status: 'applied', text: 'Applied' }],
      lastStatusUpdate: '2026-05-01',
    }),
    app(3, {
      timeline: [{ id: 1, date: '2026-05-22', status: 'offer', text: 'Offer call' }],
      status: 'offer',
      lastStatusUpdate: '2026-05-22',
    }),
  ];
}

async function mountWith(apps = fixtureApps()) {
  const host = mountHost();
  api.getAll.mockResolvedValue(apps);
  api.getProfile.mockResolvedValue(null);
  await Calendar.mount(host);
  return host;
}

beforeEach(() => {
  setViewport(1200);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 4, 21, 9));
  authStateRef.value = { status: 'local-mode', user: null, accessToken: null };
  api.getProfile.mockResolvedValue(null);
});

afterEach(() => {
  Calendar.unmount();
  document.body.replaceChildren();
  window.localStorage.clear();
  dismissals._resetForTesting();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('chooseGreeting', () => {
  it('selects from the time-window pool with deterministic random values', () => {
    expect(chooseGreeting(new Date(2026, 4, 21, 8), () => 0)).toBe('Good morning');
    expect(chooseGreeting(new Date(2026, 4, 21, 14), () => 0)).toBe('Good afternoon');
    expect(chooseGreeting(new Date(2026, 4, 21, 23), () => 0)).toBe('Burning the midnight oil?');
    expect(chooseGreeting(new Date(2026, 4, 21, 4), () => 0.999)).toBe('Welcome back');
  });

  it('formats greetings with names and punctuation owned by the formatter', () => {
    expect(formatGreeting('Good morning', 'Alice')).toBe('Good morning, Alice');
    expect(formatGreeting('Good morning', '')).toBe('Good morning');
    expect(formatGreeting('Burning the midnight oil?', 'Alice')).toBe('Burning the midnight oil, Alice?');
  });
});

describe('formatDateLabel', () => {
  it('formats the calendar date label with the en-US short weekday and middle dot separator', () => {
    expect(formatDateLabel(new Date(2026, 4, 21, 9))).toBe('Thu · May 21, 2026');
  });
});

describe('Calendar page', () => {
  it('renders the shell and loading placeholders immediately', async () => {
    const host = mountHost();
    let resolveApps;
    api.getAll.mockReturnValue(new Promise((resolve) => {
      resolveApps = resolve;
    }));

    const mounted = Calendar.mount(host);

    expect(host.querySelector('.calendar-page')).not.toBeNull();
    expect(host.querySelectorAll('.calendar-page__panel, .calendar-page__grid'))
      .toHaveLength(2);
    expect([...host.querySelectorAll('.calendar-page__panel, .calendar-page__grid')]
      .map((slot) => slot.textContent)).toEqual(['Loading…', 'Loading…']);

    resolveApps([]);
    await mounted;
  });

  it('renders loaded applications into the Action Panel and Month Grid', async () => {
    const host = await mountWith();

    expect(api.getAll).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.cal-action-panel')).not.toBeNull();
    expect(host.querySelector('.cal-grid-header')).not.toBeNull();
    expect(host.textContent).toContain('Today interview');
    expect(host.textContent).toContain('No updates for 14 days. Mark as Ghosted?');
    expect(host.querySelector('.cal-month-btn').textContent).toBe('May');
  });

  it('renders empty states and a failure toast when loading fails', async () => {
    const host = mountHost();
    api.getAll.mockRejectedValue(new Error('nope'));

    await Calendar.mount(host);

    expect(Toast.show).toHaveBeenCalledWith('Could not load calendar', 'failure');
    expect(host.textContent).toContain('Quiet day');
    expect(host.querySelector('.cal-status-filter-btn')).not.toBeNull();
  });

  it('updates view state from nav arrows and month picker selection', async () => {
    const host = await mountWith([]);

    host.querySelector('[aria-label="Previous month"]').click();
    expect(host.querySelector('.cal-month-btn').textContent).toBe('April');

    host.querySelector('.cal-month-btn').click();
    [...document.querySelectorAll('.cal-picker-item')]
      .find((button) => button.textContent === 'Jan')
      .click();

    expect(host.querySelector('.cal-month-btn').textContent).toBe('January');
  });

  it('filters the grid without changing the Action Panel', async () => {
    const host = await mountWith();

    host.querySelector('.cal-status-filter-btn').click();
    expect(document.querySelector('.filter-panel').dataset.surface).toBe('quick-status-filter');
    [...document.querySelectorAll('.filter-panel__option')]
      .find((row) => row.dataset.value === 'interview')
      .click();

    expect(host.querySelector('.cal-status-filter-btn__swatch')).not.toBeNull();
    expect(host.querySelector('.cal-cell--filter-hidden')).not.toBeNull();
    expect(host.textContent).toContain('Today interview');
  });

  it('marks a ghost suggestion as ghosted after the API update succeeds', async () => {
    const apps = fixtureApps();
    const host = await mountWith(apps);
    let updateBody;
    api.update.mockImplementation((id, body) => {
      updateBody = body;
      return Promise.resolve({ ...apps[1], ...body });
    });

    host.querySelector('.cal-act-btn').click();
    await Promise.resolve();

    expect(api.update).toHaveBeenCalledWith(2, expect.objectContaining({
      status: 'ghosted',
      lastStatusUpdate: '2026-05-21',
      timeline: expect.any(Array),
    }));
    expect(updateBody.timeline.at(-1)).toMatchObject({
      status: 'ghosted',
      text: 'Marked as ghosted after prolonged inactivity.',
    });
    expect(Toast.show).toHaveBeenCalledWith('Marked #002 as Ghosted', 'success');
    expect(host.textContent).not.toContain('No updates for 14 days. Mark as Ghosted?');
  });

  it('leaves state unchanged when Mark Ghosted fails', async () => {
    const host = await mountWith(fixtureApps());
    api.update.mockRejectedValue(new Error('nope'));

    host.querySelector('.cal-act-btn').click();
    await Promise.resolve();

    expect(Toast.show).toHaveBeenCalledWith('Could not mark as ghosted', 'failure');
    expect(host.textContent).toContain('No updates for 14 days. Mark as Ghosted?');
  });

  it('dismisses suggestions locally with a toast and persists suppression across remount', async () => {
    const setItem = vi.spyOn(window.Storage.prototype, 'setItem');
    const host = await mountWith();

    host.querySelector('.cal-act-icon--danger').click();

    expect(setItem).toHaveBeenCalledWith(
      'alice:calendar:dismissals:local',
      expect.stringContaining('"appId":2'),
    );
    expect(Toast.show).toHaveBeenCalledWith('Suggestion dismissed', 'success');
    expect(host.textContent).not.toContain('No updates for 14 days. Mark as Ghosted?');

    Calendar.unmount();
    api.getAll.mockResolvedValue(fixtureApps());
    await Calendar.mount(host);

    expect(host.textContent).not.toContain('No updates for 14 days. Mark as Ghosted?');
  });

  it('keeps demo dismissals in memory without writing localStorage', async () => {
    authStateRef.value = { status: 'demo', user: null, accessToken: null };
    const setItem = vi.spyOn(window.Storage.prototype, 'setItem');
    const host = await mountWith();

    host.querySelector('.cal-act-icon--danger').click();

    expect(setItem).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('No updates for 14 days. Mark as Ghosted?');

    Calendar.unmount();
    api.getAll.mockResolvedValue(fixtureApps());
    await Calendar.mount(host);
    expect(host.textContent).not.toContain('No updates for 14 days. Mark as Ghosted?');

    dismissals._resetForTesting();
    Calendar.unmount();
    api.getAll.mockResolvedValue(fixtureApps());
    await Calendar.mount(host);
    expect(host.textContent).toContain('No updates for 14 days. Mark as Ghosted?');
  });

  it('opens the application overlay from panel rows and applies modal callbacks', async () => {
    const apps = fixtureApps();
    const host = await mountWith(apps);
    const fresh = { ...apps[0], jobTitle: 'Fresh Role' };
    api.getById.mockResolvedValue(fresh);

    host.querySelector('.cal-section .cal-act-icon').click();
    await Promise.resolve();

    expect(api.getById).toHaveBeenCalledWith(1);
    expect(Modal.open).toHaveBeenCalledWith(fresh, {
      onApplicationUpdate: expect.any(Function),
      onArchiveSuccess: expect.any(Function),
    });

    Modal.open.mock.calls.at(-1)[1].onApplicationUpdate({ ...fresh, companyName: 'Updated Co' });
    expect(host.textContent).toContain('Updated Co');

    Modal.open.mock.calls.at(-1)[1].onArchiveSuccess({ id: 1 });
    expect(host.textContent).not.toContain('Today interview');
  });

  it('mounts the inline day panel and updates it from selected cells', async () => {
    const host = await mountWith();

    expect(host.querySelector('.cal-month-grid')).not.toBeNull();
    expect(host.querySelector('.cal-day-panel')).not.toBeNull();
    expect(host.querySelector('.cal-day-panel').classList).toContain('cal-day-panel--prompt');

    host.querySelector('.cal-cell[data-iso="2026-05-21"]').click();
    expect(host.querySelector('.cal-day-panel').classList).toContain('cal-day-panel--populated');
    expect(host.querySelector('.cal-dp-row__job').textContent).toBe('Today interview');
    expect(host.querySelector('.cal-cell[data-iso="2026-05-21"]').classList).toContain('cal-cell--selected');
    expect(host.querySelector('.cal-cell[data-iso="2026-05-21"]').getAttribute('aria-pressed')).toBe('true');

    host.querySelector('.cal-cell[data-iso="2026-05-20"]').click();
    expect(host.querySelector('.cal-day-panel').classList).toContain('cal-day-panel--empty');
    expect(host.querySelector('.cal-dp-empty').textContent).toContain('No events');
    expect(host.querySelector('.cal-cell[data-iso="2026-05-20"]').classList).toContain('cal-cell--selected');
    expect(host.querySelector('.cal-cell[data-iso="2026-05-21"]').classList).not.toContain('cal-cell--selected');
  });

  it('injects the profile first name into the greeting when available', async () => {
    api.getProfile.mockResolvedValue({ firstName: 'Alice', lastName: 'Rivera' });
    const host = mountHost();
    api.getAll.mockResolvedValue([]);

    await Calendar.mount(host);

    expect(host.querySelector('.cal-greeting-h').textContent).toContain(', Alice');
  });

  it('still renders the calendar if profile loading fails', async () => {
    api.getProfile.mockRejectedValue(new Error('profile unavailable'));
    const host = await mountWith([]);

    expect(host.querySelector('.cal-action-panel')).not.toBeNull();
    expect(host.querySelector('.cal-greeting-h').textContent).not.toMatch(/,\s*$/);
    expect(Toast.show).not.toHaveBeenCalledWith('Could not load calendar', 'failure');
  });

  it('shows a failure toast when application overlay fetch fails', async () => {
    const host = await mountWith();
    api.getById.mockRejectedValue(new Error('nope'));

    host.querySelector('.cal-section .cal-act-icon').click();
    await Promise.resolve();

    expect(Toast.show).toHaveBeenCalledWith('Application details failed to load', 'failure');
    expect(Modal.open).not.toHaveBeenCalled();
  });

  it('suppresses async handler toasts after unmount', async () => {
    const host = await mountWith();
    let rejectUpdate;
    let rejectGetById;
    api.update.mockReturnValue(new Promise((_, reject) => {
      rejectUpdate = reject;
    }));
    api.getById.mockReturnValue(new Promise((_, reject) => {
      rejectGetById = reject;
    }));

    host.querySelector('.cal-act-btn').click();
    host.querySelector('.cal-section .cal-act-icon').click();
    Calendar.unmount();
    rejectUpdate(new Error('gone'));
    rejectGetById(new Error('gone'));
    await Promise.resolve();

    expect(Toast.show).not.toHaveBeenCalledWith('Could not mark as ghosted', 'failure');
    expect(Toast.show).not.toHaveBeenCalledWith('Application details failed to load', 'failure');
  });

  it('drops state writes and the failure toast when unmounted mid-mount', async () => {
    const host = mountHost();
    let resolveApps;
    let rejectApps;
    api.getAll
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveApps = resolve;
      }))
      .mockImplementationOnce(() => new Promise((_, reject) => {
        rejectApps = reject;
      }));
    api.getProfile.mockResolvedValue(null);

    const successPending = Calendar.mount(host);
    Calendar.unmount();
    resolveApps(fixtureApps());
    await successPending;

    expect(host.children).toHaveLength(0);
    expect(host.querySelector('.cal-action-panel')).toBeNull();

    const failurePending = Calendar.mount(host);
    Calendar.unmount();
    rejectApps(new Error('late failure'));
    await failurePending;

    expect(Toast.show).not.toHaveBeenCalledWith('Could not load calendar', 'failure');
  });

  it('unmount clears the container and component singletons', async () => {
    const host = await mountWith();

    host.querySelector('.cal-month-btn').click();
    expect(document.querySelector('.cal-picker')).not.toBeNull();

    Calendar.unmount();

    expect(host.children).toHaveLength(0);
    expect(document.querySelector('.cal-picker')).toBeNull();
    expect(document.querySelector('.cal-day-panel')).toBeNull();
  });
});
