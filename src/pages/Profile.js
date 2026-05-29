import { getAll, getProfile } from '../services/api.js';
import { computeAppCounts, computeStats, STATUS_COLORS, STATUS_LABELS } from '../models/profile.js';
import { calculateSegments, DonutChart } from '../components/DonutChart.js';
import { StackedBar } from '../components/StackedBar.js';
import { renderInlineError } from '../utils/asyncUI.js';
import { buildProfileAppsSkeleton, buildProfileSkeleton } from '../utils/skeletons.js';
import { getSafeExternalHref } from '../utils/url.js';

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

function createArchivedApplicationsLink(count, navigate) {
  const link = document.createElement('a');

  link.className = 'profile-archived-link';
  // SPA convention: the app lives at `/` (single index.html); the view is
  // encoded in the query string. Using an absolute SPA root URL keeps the
  // href routable for middle-click / copy-paste / refresh on hosted Vercel
  // builds (no Tracker.html file exists; vercel.json rewrites only /api/*).
  link.href = '/?view=archived';
  link.textContent = `Archived applications \u00b7 ${count} \u2192`;
  link.setAttribute('aria-label', `View archived applications, ${count} ${count === 1 ? 'item' : 'items'}`);
  link.addEventListener('click', (event) => {
    if (typeof navigate !== 'function') {
      return;
    }

    event.preventDefault();
    window.history.pushState({}, '', '/?view=archived');
    navigate('tracker', { view: 'archived' });
  });

  return link;
}

function renderApplicationsSection(page, navigate) {
  const { section, actions } = createSection('APPLICATIONS');
  const body = createElement('div', 'applications-body');
  const message = createElement('p', 'apps-empty-message');

  actions.append(createButton('Go to Tracker', 'profile-btn profile-btn--primary', () => navigate('tracker')));
  body.append(buildProfileAppsSkeleton());
  section.append(body, message);
  page.append(section);

  return { body, message };
}

async function renderApplicationsData(applicationsSection, navigate, applicationsPromise = getAll(), archivedApplicationsPromise = getAll({ view: 'archived' }).catch(() => [])) {
  try {
    const [applications, archivedApplications] = await Promise.all([
      applicationsPromise,
      archivedApplicationsPromise,
    ]);
    const safeApplications = Array.isArray(applications) ? applications : [];
    const safeArchivedApplications = Array.isArray(archivedApplications) ? archivedApplications : [];

    renderApplicationsVisuals(
      applicationsSection.body,
      safeApplications,
      safeArchivedApplications.length,
      navigate,
    );
    applicationsSection.message.textContent = safeApplications.length === 0
      ? 'No applications yet.'
      : '';
  } catch {
    applicationsSection.message.textContent = '';
    renderInlineError({
      target: applicationsSection.body,
      message: "Couldn't load your applications.",
      onRetry: () => {
        applicationsSection.body.replaceChildren(buildProfileAppsSkeleton());
        renderApplicationsData(applicationsSection, navigate);
      },
    });
  }
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
    const value = createElement('span', 'chart-legend__value', String(entry.count));

    item.type = 'button';
    item.className = 'chart-legend__item';
    item.dataset.status = entry.status;
    swatch.style.background = entry.color;
    item.append(swatch, label, value);
    item.addEventListener('mouseover', () => onHover?.(entry.status));
    item.addEventListener('mouseleave', () => onLeave?.());
    item.addEventListener('click', () => onClick?.(entry.status, entry.count));
    legend.append(item);
  }

  return legend;
}

function updateLegendHover(legend, status) {
  for (const item of legend?.querySelectorAll('.chart-legend__item') ?? []) {
    item.classList.toggle('chart-legend__item--active', Boolean(status) && item.dataset.status === status);
    item.classList.toggle('chart-legend__item--muted', Boolean(status) && item.dataset.status !== status);
  }
}

function renderApplicationsVisuals(body, applications, archivedCount, navigate) {
  const counts = computeAppCounts(applications);
  const entries = getStatusEntries(counts);
  const segments = calculateSegments(counts);
  const desktop = createElement('div', 'apps-desktop-vis');
  const desktopStats = createElement('div', 'apps-desktop-vis__stats');
  const desktopChart = createElement('div', 'apps-desktop-vis__chart');
  const mobile = createElement('div', 'apps-mobile-vis');
  const mobileLabel = createElement('div', 'bar-tap-label');
  let donutChart;
  let desktopLegend;

  function handleDonutHover(status, _el, pct, event) {
    if (!status) {
      donutChart.update(null);
      updateLegendHover(desktopLegend, null);
      hideTooltip();
      return;
    }

    donutChart.update(status);
    updateLegendHover(desktopLegend, status);
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
  desktopLegend = renderLegend(entries, {
    onHover: (status) => {
      donutChart.update(status);
      updateLegendHover(desktopLegend, status);
    },
    onLeave: () => {
      donutChart.update(null);
      updateLegendHover(desktopLegend, null);
    },
  });
  desktopChart.append(
    donutChart.el,
    desktopLegend,
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

  body.replaceChildren(
    desktop,
    mobile,
    createArchivedApplicationsLink(archivedCount, navigate),
  );
}

function renderEmptyProfile(section, navigate) {
  const empty = createElement('div', 'profile-empty');
  const icon = createElement('div', 'profile-empty__icon');
  const iconHead = createElement('span', 'profile-empty__icon-head');
  const iconBody = createElement('span', 'profile-empty__icon-body');
  const actions = createElement('div', 'profile-empty__actions');

  icon.setAttribute('aria-hidden', 'true');
  icon.append(iconHead, iconBody);
  actions.append(
    createButton('Set Up Profile', 'profile-btn profile-btn--primary', () => navigate('profile-edit', { highlightImport: true })),
  );
  empty.append(
    icon,
    createElement('p', 'profile-empty__title', 'No profile set up yet.'),
    createElement('p', 'profile-empty__copy', 'Add your background to strengthen your applications.'),
    actions,
  );
  section.append(empty);
}

function getInitials(profile) {
  return `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase();
}

function appendMeta(parent, label, value) {
  if (!value) {
    return;
  }

  const item = createElement('div', 'profile-basic__meta');
  const labelEl = createElement('span', 'profile-basic__meta-label', label);
  const valueEl = createElement('span', 'profile-basic__meta-value', value);

  item.append(labelEl, valueEl);
  parent.append(item);
}

function getLinkLabel(link) {
  if (link.friendlyName) {
    return link.friendlyName;
  }

  try {
    return new URL(link.url).hostname;
  } catch {
    return link.url;
  }
}

function renderBasicInfo(profile) {
  const basic = createElement('div', 'profile-basic');
  const avatar = createElement('div', 'profile-avatar', getInitials(profile));
  const details = createElement('div', 'profile-basic__details');
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');

  details.append(createElement('div', 'profile-basic__name', fullName));
  appendMeta(details, '📍', profile.city);
  appendMeta(details, '📞', profile.phone);
  appendMeta(details, '✉', profile.email);
  basic.append(avatar, details);

  return basic;
}

function renderSubSection(label, contentEl) {
  const section = createElement('div', 'profile-subsection');
  const labelRow = createElement('div', 'profile-subsection__label', label);
  const chevron = createElement('span', 'subsection-chevron', '›');
  const content = createElement('div', 'profile-subsection__content');

  chevron.setAttribute('aria-hidden', 'true');
  labelRow.append(chevron);
  labelRow.addEventListener('click', () => {
    section.classList.toggle('is-collapsed');
  });
  content.append(contentEl);
  section.append(labelRow, content);

  return section;
}

function renderSummary(profile, container) {
  if (!profile.summary) {
    return;
  }

  container.append(renderSubSection('SUMMARY', createElement('p', 'profile-summary', profile.summary)));
}

function renderExperience(profile, container) {
  if (!Array.isArray(profile.experience) || profile.experience.length === 0) {
    return;
  }

  const list = createElement('div', 'profile-entry-list');

  for (const entry of profile.experience) {
    const item = createElement('div', 'profile-entry');
    const endDate = entry.currentWork ? 'Present' : entry.dateEnded;

    item.append(
      createElement('div', 'profile-entry__title', entry.role),
      createElement('div', 'profile-entry__meta', [
        entry.company,
        [entry.dateStarted, endDate].filter(Boolean).join(' - '),
      ].filter(Boolean).join(' | ')),
      createElement('p', 'profile-entry__desc', entry.responsibilities),
    );
    list.append(item);
  }

  container.append(renderSubSection('PROFESSIONAL EXPERIENCE', list));
}

function renderEducation(profile, container) {
  if (!Array.isArray(profile.education) || profile.education.length === 0) {
    return;
  }

  const list = createElement('div', 'profile-entry-list');

  for (const entry of profile.education) {
    const item = createElement('div', 'profile-entry');

    item.append(
      createElement('div', 'profile-entry__title', entry.degreeMajor),
      createElement('div', 'profile-entry__meta', [entry.university, entry.yearCompleted].filter(Boolean).join(' | ')),
    );
    list.append(item);
  }

  container.append(renderSubSection('EDUCATION', list));
}

function renderPills(label, values, container) {
  if (!Array.isArray(values) || values.length === 0) {
    return;
  }

  const pills = createElement('div', 'pill-row');

  for (const value of values) {
    pills.append(createElement('span', 'pill-tag', value));
  }

  container.append(renderSubSection(label, pills));
}

function renderCertifications(profile, container) {
  if (!Array.isArray(profile.certifications) || profile.certifications.length === 0) {
    return;
  }

  const list = createElement('div', 'profile-entry-list');

  for (const entry of profile.certifications) {
    const item = createElement('div', 'profile-entry');
    const dateText = [entry.issuanceDate, entry.expiryDate].filter(Boolean).join(' – ');

    item.append(createElement('div', 'profile-entry__title', entry.name));

    if (entry.issuingBody) {
      item.append(createElement('div', 'profile-entry__meta', entry.issuingBody));
    }

    if (dateText) {
      item.append(createElement('div', 'profile-entry__meta', dateText));
    }

    if (entry.certificateId) {
      item.append(createElement('div', 'profile-entry__meta profile-entry__meta--secondary', `ID: ${entry.certificateId}`));
    }

    list.append(item);
  }

  container.append(renderSubSection('CERTIFICATIONS', list));
}

function renderAwards(profile, container) {
  if (!Array.isArray(profile.awards) || profile.awards.length === 0) {
    return;
  }

  const list = createElement('div', 'profile-entry-list');

  for (const entry of profile.awards) {
    const item = createElement('div', 'profile-entry');
    const metaText = [entry.issuingBody, entry.date].filter(Boolean).join(' | ');

    item.append(createElement('div', 'profile-entry__title', entry.awardName));

    if (metaText) {
      item.append(createElement('div', 'profile-entry__meta', metaText));
    }

    if (entry.details) {
      item.append(createElement('p', 'profile-entry__desc', entry.details));
    }

    list.append(item);
  }

  container.append(renderSubSection('AWARDS', list));
}

function renderLanguages(profile, container) {
  if (!Array.isArray(profile.languages) || profile.languages.length === 0) {
    return;
  }

  const pills = createElement('div', 'pill-row');

  for (const entry of profile.languages) {
    pills.append(createElement('span', 'pill-tag', [entry.language, entry.proficiency].filter(Boolean).join(' | ')));
  }

  container.append(renderSubSection('LANGUAGES', pills));
}

function renderLinks(profile, container) {
  if (!Array.isArray(profile.links) || profile.links.length === 0) {
    return;
  }

  const links = createElement('div', 'link-chip-row');

  for (const link of profile.links) {
    const chip = document.createElement('a');

    chip.className = 'link-chip';
    chip.href = getSafeExternalHref(link.url);
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
    chip.append(
      createElement('span', 'link-chip__url', getLinkLabel(link)),
    );
    links.append(chip);
  }

  container.append(renderSubSection('LINKS', links));
}

function renderPopulatedProfile(section, profile) {
  const content = createElement('div', 'profile-content');

  content.append(renderBasicInfo(profile));
  renderSummary(profile, content);
  renderExperience(profile, content);
  renderEducation(profile, content);
  renderPills('SKILLS', profile.skills, content);
  renderCertifications(profile, content);
  renderAwards(profile, content);
  renderLanguages(profile, content);
  renderLinks(profile, content);
  section.append(content);
}

function renderProfileSection(page, profile, navigate) {
  const { section, actions } = createSection('PROFILE');

  if (profile) {
    actions.append(createButton('Edit Profile', 'profile-btn profile-btn--outline', () => navigate('profile-edit')));
    renderPopulatedProfile(section, profile);
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
  page.replaceChildren(buildProfileSkeleton());

  const profilePromise = getProfile().catch(() => null);
  const applicationsPromise = getAll();
  const archivedApplicationsPromise = getAll({ view: 'archived' }).catch(() => []);
  const profile = await profilePromise;

  if (_container !== container) {
    return;
  }

  page.replaceChildren();
  renderWelcome(page, profile);
  const applicationsSection = renderApplicationsSection(page, safeNavigate);

  await renderApplicationsData(applicationsSection, safeNavigate, applicationsPromise, archivedApplicationsPromise);

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
