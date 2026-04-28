import { getAll, getProfile } from '../services/api.js';
import { computeAppCounts, computeStats } from '../models/profile.js';
import { STATUS_COLORS, STATUS_LABELS } from '../models/profile.js';
import { calculateSegments, DonutChart } from '../components/DonutChart.js';
import { StackedBar } from '../components/StackedBar.js';

let _container = null;
let _dismissTimer = null;
let _tooltip = null;

function createElement(tag, className, text) {
  const el = document.createElement(tag);

  if (className) {
    el.className = className;
  }

  if (text !== undefined) {
    el.textContent = text;
  }

  return el;
}

function createButton(label, className, onClick) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);

  return button;
}

function renderWelcome(page, profile) {
  const header = createElement('header', 'profile-hero');
  const heading = createElement('h1');

  if (profile) {
    heading.textContent = `Welcome back, ${profile.firstName}.`;
    header.append(heading, createElement('p', 'profile-subline', "Here's where things stand today."));
  } else {
    heading.textContent = 'Welcome back.';
    header.append(heading);
  }

  page.append(header);
}

function createSection(label) {
  const section = createElement('section', 'section-card');
  const header = createElement('div', 'section-card__header');
  const labelEl = createElement('div', 'section-label', label);
  const actions = createElement('div', 'section-card__actions');

  header.append(labelEl, actions);
  section.append(header);

  return { section, actions };
}

function renderStatChip(label, value, modifier) {
  const chip = createElement('div', `stat-chip stat-chip--${modifier}`);

  chip.append(
    createElement('div', 'stat-chip__value', String(value)),
    createElement('div', 'stat-chip__label', label),
  );

  return chip;
}

function getStatusEntries(counts) {
  return Object.keys(STATUS_LABELS)
    .filter((status) => (counts[status] ?? 0) > 0)
    .map((status) => ({
      status,
      count: counts[status],
      label: STATUS_LABELS[status],
      color: STATUS_COLORS[status],
    }));
}

function createStatChipRow(applications) {
  const row = createElement('div', 'stat-chip-row');
  const counts = computeAppCounts(applications);
  const stats = computeStats(counts);

  row.append(
    renderStatChip('Total', stats.total, 'total'),
    renderStatChip('Active', stats.active, 'active'),
    renderStatChip('Pending', stats.pending, 'pending'),
    renderStatChip('Offer', stats.offer, 'offer'),
  );

  return row;
}

function renderApplicationsSection(page, navigate) {
  const { section, actions } = createSection('APPLICATIONS');
  const body = createElement('div', 'applications-body');
  const message = createElement('p', 'apps-empty-message');

  actions.append(createButton('Go to Tracker', 'profile-btn profile-btn--primary', () => navigate('tracker')));
  body.append(createElement('div', 'profile-loading', 'Loading applications...'));
  section.append(body, message);
  page.append(section);

  return { body, message };
}

function getTooltip() {
  if (!_tooltip) {
    _tooltip = createElement('div', 'chart-tooltip');
    document.body.append(_tooltip);
  }

  return _tooltip;
}

function hideTooltip() {
  if (_tooltip) {
    _tooltip.hidden = true;
  }
}

function formatInteractionLabel(status, count, pct) {
  return `${STATUS_LABELS[status] ?? status} \u00b7 ${count} (${pct}%)`;
}

function renderLegend(entries, { onHover, onLeave, onClick } = {}) {
  const legend = createElement('div', 'chart-legend');

  for (const entry of entries) {
    const item = document.createElement('button');
    const swatch = createElement('span', 'chart-legend__swatch');
    const label = createElement('span', 'chart-legend__label', entry.label);

    item.type = 'button';
    item.className = 'chart-legend__item';
    swatch.style.background = entry.color;
    item.append(swatch, label);
    item.addEventListener('mouseover', () => onHover?.(entry.status));
    item.addEventListener('mouseleave', () => onLeave?.());
    item.addEventListener('click', () => onClick?.(entry.status, entry.count));
    legend.append(item);
  }

  return legend;
}

function renderApplicationsVisuals(body, applications) {
  const counts = computeAppCounts(applications);
  const entries = getStatusEntries(counts);
  const segments = calculateSegments(counts);
  const desktop = createElement('div', 'apps-desktop-vis');
  const desktopStats = createElement('div', 'apps-desktop-vis__stats');
  const desktopChart = createElement('div', 'apps-desktop-vis__chart');
  const mobile = createElement('div', 'apps-mobile-vis');
  const mobileLabel = createElement('div', 'bar-tap-label');
  let donutChart;

  function handleDonutHover(status, _el, pct, event) {
    if (!status) {
      donutChart.update(null);
      hideTooltip();
      return;
    }

    donutChart.update(status);
    const tooltip = getTooltip();

    tooltip.textContent = formatInteractionLabel(status, counts[status] ?? 0, pct);
    tooltip.style.left = `${event.clientX + 12}px`;
    tooltip.style.top = `${event.clientY - 28}px`;
    tooltip.hidden = false;
  }

  function handleTap(status, count, pct) {
    mobileLabel.textContent = formatInteractionLabel(status, count, pct);

    if (_dismissTimer) {
      clearTimeout(_dismissTimer);
    }

    _dismissTimer = setTimeout(() => {
      mobileLabel.textContent = '';
      _dismissTimer = null;
    }, 2000);
  }

  donutChart = DonutChart.render({
    counts,
    colors: STATUS_COLORS,
    labels: STATUS_LABELS,
    onHover: handleDonutHover,
  });

  desktopStats.append(createStatChipRow(applications));
  desktopChart.append(
    donutChart.el,
    renderLegend(entries, {
      onHover: (status) => donutChart.update(status),
      onLeave: () => donutChart.update(null),
    }),
  );
  desktop.append(desktopStats, desktopChart);

  mobile.append(
    createStatChipRow(applications),
    StackedBar.render({
      counts,
      colors: STATUS_COLORS,
      labels: STATUS_LABELS,
      onTap: handleTap,
    }),
    mobileLabel,
    renderLegend(entries, {
      onClick: (status, count) => {
        const segment = segments.find((item) => item.status === status);

        handleTap(status, count, segment?.pct ?? 0);
      },
    }),
  );

  body.replaceChildren(desktop, mobile);
}

function renderEmptyProfile(section, navigate) {
  const empty = createElement('div', 'profile-empty');
  const icon = createElement('div', 'profile-empty__icon');
  const iconHead = createElement('span', 'profile-empty__icon-head');
  const iconBody = createElement('span', 'profile-empty__icon-body');

  icon.setAttribute('aria-hidden', 'true');
  icon.append(iconHead, iconBody);
  empty.append(
    icon,
    createElement('p', 'profile-empty__title', 'No profile set up yet.'),
    createElement('p', 'profile-empty__copy', 'Add your background to strengthen your applications.'),
    createButton('Set Up Profile', 'profile-btn profile-btn--primary', () => navigate('profile-edit')),
  );
  section.append(empty);
}

function renderProfileSection(page, profile, navigate) {
  const { section, actions } = createSection('PROFILE');

  if (profile) {
    actions.append(createButton('Edit Profile', 'profile-btn profile-btn--outline', () => navigate('profile-edit')));
  } else {
    renderEmptyProfile(section, navigate);
  }

  page.append(section);
}

export async function mount(container, { navigate } = {}) {
  const safeNavigate = typeof navigate === 'function' ? navigate : () => {};
  const page = createElement('div', 'profile-page');

  _container = container;
  _container.replaceChildren(page);

  const profilePromise = getProfile().catch(() => null);
  const applicationsPromise = getAll();
  const profile = await profilePromise;

  if (_container !== container) {
    return;
  }

  page.replaceChildren();
  renderWelcome(page, profile);
  const applicationsSection = renderApplicationsSection(page, safeNavigate);

  try {
    const applications = await applicationsPromise;
    const safeApplications = Array.isArray(applications) ? applications : [];

    renderApplicationsVisuals(applicationsSection.body, safeApplications);
    applicationsSection.message.textContent = safeApplications.length === 0
      ? 'No applications yet.'
      : '';
  } catch {
    renderApplicationsVisuals(applicationsSection.body, []);
    applicationsSection.message.textContent = 'Application data is unavailable right now.';
  }

  if (_container !== container) {
    return;
  }

  renderProfileSection(page, profile, safeNavigate);
}

export function unmount() {
  if (_dismissTimer) {
    clearTimeout(_dismissTimer);
    _dismissTimer = null;
  }

  if (_container) {
    _container.replaceChildren();
  }

  _tooltip?.remove();
  _tooltip = null;
  _container = null;
}

export const Profile = { mount, unmount };
