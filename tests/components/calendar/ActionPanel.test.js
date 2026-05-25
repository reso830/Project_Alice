// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionPanel } from '../../../src/components/calendar/ActionPanel.js';

function row(id, overrides = {}) {
  return {
    id,
    title: 'Interview scheduled',
    company: 'Acme',
    role: 'Engineer',
    ...overrides,
  };
}

function suggestion(id, overrides = {}) {
  return {
    id,
    kind: 'followup',
    title: 'Follow up with recruiter?',
    meta: '7d since application',
    primary: 'open',
    ...overrides,
  };
}

function renderPanel(props = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  ActionPanel.render(host, {
    today: [],
    suggestions: [],
    upcoming: { tomorrow: [], restOfWeek: [] },
    greeting: 'Good morning,',
    dateLabel: 'Thu · May 21, 2026',
    onOpenApp: vi.fn(),
    onDismiss: vi.fn(),
    onMarkGhosted: vi.fn(),
    ...props,
  });
  return host;
}

function setViewport(width) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

function sectionLabels() {
  return [...document.querySelectorAll('.cal-section > .cal-section-h .cal-section__lbl')]
    .map((node) => node.textContent);
}

afterEach(() => {
  ActionPanel.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('ActionPanel', () => {
  beforeEach(() => {
    setViewport(1200);
  });

  it('does not mount collapse UI in wide desktop layout', () => {
    renderPanel({
      today: [row(1), row(2)],
      suggestions: [suggestion(3), suggestion(4), suggestion(5)],
      upcoming: { tomorrow: [row(6)], restOfWeek: [] },
    });

    expect(document.querySelector('.ap-greeting-btn')).toBeNull();
    expect(document.querySelector('.ap-chips')).toBeNull();
    expect(document.querySelector('.ap-collapse-chip')).toBeNull();
    expect(sectionLabels()).toEqual(['Today', 'Suggested Actions', 'Upcoming']);
  });

  it('renders collapsed greeting toggle and non-empty count chips in stacked layout', () => {
    setViewport(1024);
    renderPanel({
      today: [row(1), row(2)],
      suggestions: [suggestion(3), suggestion(4), suggestion(5)],
      upcoming: { tomorrow: [row(6)], restOfWeek: [] },
    });

    const button = document.querySelector('.ap-greeting-btn');
    const labels = [...document.querySelectorAll('.ap-chip .lbl')].map((node) => node.textContent);
    const counts = [...document.querySelectorAll('.ap-chip .n')].map((node) => node.textContent);

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.classList).toContain('is-collapsed');
    expect(document.querySelector('.ap-greeting-block .cal-greeting-h').textContent).toBe('Good morning,');
    expect(labels).toEqual(['Today', 'Suggested', 'Upcoming']);
    expect(counts).toEqual(['2', '3', '1']);
    expect(document.querySelector('.ap-chip.today').getAttribute('aria-label'))
      .toBe('Expand panel \u2014 Today, 2 entries');
    expect(document.querySelector('.cal-section')).toBeNull();
  });

  it('omits zero-count chips and renders caught-up copy when all counts are zero', () => {
    setViewport(1024);
    renderPanel({
      today: [row(1)],
      suggestions: [],
      upcoming: { tomorrow: [], restOfWeek: [] },
    });

    expect([...document.querySelectorAll('.ap-chip .lbl')].map((node) => node.textContent))
      .toEqual(['Today']);

    ActionPanel.render(document.body.firstElementChild, {
      today: [],
      suggestions: [],
      upcoming: { tomorrow: [], restOfWeek: [] },
      greeting: 'Hi',
      dateLabel: 'Today',
    });

    expect(document.querySelector('.ap-chips')).toBeNull();
    expect(document.querySelector('.ap-caughtup').textContent).toBe("You're all caught up!");
  });

  it('expands from greeting and chips, then collapses from bottom chip and Escape', () => {
    setViewport(1024);
    renderPanel();

    let panel = document.querySelector('.cal-action-panel');
    let button = document.querySelector('.ap-greeting-btn');

    button.click();
    panel = document.querySelector('.cal-action-panel');
    button = document.querySelector('.ap-greeting-btn');
    expect(panel.classList).toContain('cal-action-panel--expanded');
    expect(button.classList).not.toContain('is-collapsed');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(sectionLabels()).toEqual(['Today', 'Suggested Actions', 'Upcoming']);
    expect(document.querySelector('.ap-collapse-chip')).not.toBeNull();
    expect(document.querySelector('.ap-caughtup')).toBeNull();

    document.querySelector('.ap-collapse-chip').click();
    panel = document.querySelector('.cal-action-panel');
    button = document.querySelector('.ap-greeting-btn');
    expect(panel.classList).not.toContain('cal-action-panel--expanded');
    expect(button.classList).toContain('is-collapsed');

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    panel = document.querySelector('.cal-action-panel');
    expect(panel.classList).toContain('cal-action-panel--expanded');

    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    document.querySelector('.ap-collapse-chip').dispatchEvent(space);
    panel = document.querySelector('.cal-action-panel');
    expect(space.defaultPrevented).toBe(true);
    expect(panel.classList).not.toContain('cal-action-panel--expanded');
  });

  it('chip activation expands and Escape returns focus to greeting button', () => {
    setViewport(1024);
    renderPanel({ today: [row(1)] });

    document.querySelector('.ap-chip').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(document.querySelector('.cal-action-panel').classList).toContain('cal-action-panel--expanded');

    document.querySelector('.cal-greeting-h')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.querySelector('.cal-action-panel').classList).not.toContain('cal-action-panel--expanded');
    expect(document.querySelector('.ap-greeting-btn').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(document.querySelector('.ap-greeting-btn'));
  });

  it('resets to collapsed stacked state when resizing below 1200px', () => {
    renderPanel({ today: [row(1)] });

    expect(document.querySelector('.ap-greeting-btn')).toBeNull();

    setViewport(1024);

    expect(document.querySelector('.ap-greeting-btn')).not.toBeNull();
    expect(document.querySelector('.cal-action-panel').classList)
      .not.toContain('cal-action-panel--expanded');
  });

  it('renders greeting, date label, and sections in order', () => {
    renderPanel({
      greeting: 'Welcome back,',
      dateLabel: 'Fri · May 22, 2026',
    });

    expect(document.querySelector('.cal-action-panel')).not.toBeNull();
    expect(document.querySelector('.cal-greeting-h').textContent).toBe('Welcome back,');
    expect(document.querySelector('.cal-greeting-sub').textContent).toBe('Fri · May 22, 2026');
    expect(sectionLabels()).toEqual(['Today', 'Suggested Actions', 'Upcoming']);
  });

  it('renders exact empty state copy for all three sections', () => {
    renderPanel();

    expect(document.body.textContent).toContain('Quiet day');
    expect(document.body.textContent).toContain('Nothing on today. Enjoy the breather.');
    expect(document.body.textContent).toContain("You're caught up");
    expect(document.body.textContent).toContain("No suggestions right now. We'll surface new ones as activity ages.");
    expect(document.body.textContent).toContain('Nothing scheduled');
    expect(document.body.textContent).toContain('No upcoming timeline events tomorrow through end of week.');
  });

  it('hides count pills for empty sections and shows them for populated sections', () => {
    renderPanel({
      today: [row(1)],
      suggestions: [suggestion(2), suggestion(3)],
      upcoming: { tomorrow: [row(4)], restOfWeek: [] },
    });

    expect([...document.querySelectorAll('.cal-section__count')].map((node) => node.textContent))
      .toEqual(['1', '2', '1']);
    expect([...document.querySelectorAll('.cal-section__count')].map((node) => node.getAttribute('aria-label')))
      .toEqual(['1 item in Today', '2 items in Suggested Actions', '1 item in Upcoming']);

    ActionPanel.render(document.body.firstElementChild, {
      today: [],
      suggestions: [],
      upcoming: { tomorrow: [], restOfWeek: [] },
      greeting: 'Hi',
      dateLabel: 'Today',
    });

    expect(document.querySelector('.cal-section__count')).toBeNull();
  });

  it('destroy clears the current container and render is idempotent', () => {
    const host = renderPanel();
    ActionPanel.render(host, {
      today: [],
      suggestions: [],
      upcoming: { tomorrow: [], restOfWeek: [] },
      greeting: 'Again',
      dateLabel: 'Today',
    });

    expect(host.querySelectorAll('.cal-action-panel')).toHaveLength(1);

    ActionPanel.destroy();

    expect(host.children).toHaveLength(0);
  });

  it('today row open button calls onOpenApp and row body is not clickable', () => {
    const onOpenApp = vi.fn();
    renderPanel({ today: [row(7)], onOpenApp });

    document.querySelector('.cal-row__body').click();
    expect(onOpenApp).not.toHaveBeenCalled();

    document.querySelector('.cal-act-icon').click();
    expect(onOpenApp).toHaveBeenCalledWith(7);
  });

  it('renders padded IDs and company-role meta for activity rows', () => {
    renderPanel({ today: [row(24, { title: 'Offer call', company: 'Beta', role: 'Designer' })] });

    expect(document.querySelector('.cal-id-pill').textContent).toBe('024');
    expect(document.querySelector('.cal-row__title').textContent).toBe('Offer call');
    expect(document.querySelector('.cal-row__meta').textContent).toBe('Beta·Designer');
    expect(document.querySelector('.cal-row__sep').textContent).toBe('·');
  });

  it('suggestion open and dismiss buttons call their handlers', () => {
    const onOpenApp = vi.fn();
    const onDismiss = vi.fn();
    renderPanel({
      suggestions: [suggestion(12, { kind: 'feedback' })],
      onOpenApp,
      onDismiss,
    });

    const buttons = document.querySelectorAll('.cal-row .cal-act-icon');
    buttons[0].click();
    buttons[1].click();

    expect(onOpenApp).toHaveBeenCalledWith(12);
    expect(onDismiss).toHaveBeenCalledWith(12, 'feedback');
  });

  it('ghost suggestion renders Mark Ghosted and dismiss actions', () => {
    const onMarkGhosted = vi.fn();
    const onDismiss = vi.fn();
    renderPanel({
      suggestions: [suggestion(6, {
        kind: 'ghost',
        primary: 'mark_ghosted',
        title: 'No updates for 14 days. Mark as Ghosted?',
      })],
      onMarkGhosted,
      onDismiss,
    });

    document.querySelector('.cal-act-btn').click();
    document.querySelector('.cal-act-icon.danger').click();

    expect(onMarkGhosted).toHaveBeenCalledWith(6);
    expect(onDismiss).toHaveBeenCalledWith(6, 'ghost');
  });

  it('renders only the non-empty tomorrow upcoming group', () => {
    renderPanel({
      todayISO: '2026-05-21',
      upcoming: { tomorrow: [row(2)], restOfWeek: [] },
    });

    const groups = document.querySelectorAll('.upc-group');
    expect(groups).toHaveLength(1);
    expect(groups[0].querySelector('.cal-section__lbl').textContent).toBe('Tomorrow · Fri May 22');
  });

  it('renders both upcoming groups in order with combined count and open action', () => {
    const onOpenApp = vi.fn();
    renderPanel({
      todayISO: '2026-05-21',
      upcoming: { tomorrow: [row(2)], restOfWeek: [row(5), row(8)] },
      onOpenApp,
    });

    const labels = [...document.querySelectorAll('.upc-group-h .cal-section__lbl')]
      .map((node) => node.textContent);
    expect(labels).toEqual(['Tomorrow · Fri May 22', 'Rest of week · thru Sun May 24']);
    expect(document.querySelectorAll('.cal-section__count')[0].textContent).toBe('3');

    document.querySelector('.upc-group .cal-act-icon').click();
    expect(onOpenApp).toHaveBeenCalledWith(2);
  });

  it('renders the upcoming empty state when both sub-groups are empty', () => {
    renderPanel({ upcoming: { tomorrow: [], restOfWeek: [] } });

    expect(document.querySelectorAll('.upc-group')).toHaveLength(0);
    expect(document.body.textContent).toContain('Nothing scheduled');
  });
});
