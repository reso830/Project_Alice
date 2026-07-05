import { deleteAccount, getAll, getProfile } from '../services/api.js';
import {
  computeAppCounts,
  computeStats,
  getSkillLabel,
  normaliseProfile,
  SKILL_FLAVOR,
  SKILL_LEVELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../models/profile.js';
import { calculateSegments, DonutChart } from '../components/DonutChart.js';
import { StackedBar } from '../components/StackedBar.js';
import { DeleteAccountModal } from '../components/DeleteAccountModal.js';
import { Toast } from '../components/Toast.js';
import * as aiSettings from '../data/aiSettings.js';
import * as authStore from '../data/authStore.js';
import {
  cancel as cancelUpdate,
  check as checkUpdate,
  download as downloadUpdate,
  restart as restartUpdate,
  subscribeUpdateController,
} from '../data/updateController.js';
import { getUpdateStatus, subscribeUpdateStatus } from '../data/updateStatusStore.js';
import { validateKey } from '../services/aiService.js';
import { APP_VERSION } from './welcome/shared/appMeta.js';
import { renderInlineError } from '../utils/asyncUI.js';
import { createSvgIcon } from '../utils/icons.js';
import profileEmpty from '../assets/graphics/profile-empty.svg';
import { buildProfileAppsSkeleton, buildProfileSkeleton } from '../utils/skeletons.js';
import { getSafeExternalHref } from '../utils/url.js';

let _container = null;
let _dismissTimer = null;
let _tooltip = null;
const _cleanupHandlers = [];
const _skillRevealTimers = new Set();

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
  const icon = document.createElement('img');
  const actions = createElement('div', 'profile-empty__actions');

  icon.className = 'profile-empty__icon';
  icon.src = profileEmpty;
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
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

function renderSubSection(label, contentEl, actionsEl = null, labelAdornment = null) {
  const section = createElement('div', 'profile-subsection');
  const labelRow = createElement('div', 'profile-subsection__label');
  const labelText = createElement('span', 'profile-subsection__label-text', label);
  const labelLead = createElement('span', 'profile-subsection__label-lead');
  const labelActions = createElement('span', 'profile-subsection__label-actions');
  const chevron = createElement('span', 'subsection-chevron', '›');
  const content = createElement('div', 'profile-subsection__content');

  chevron.setAttribute('aria-hidden', 'true');
  // Keep the label and its inline adornment grouped on the left (the label row
  // is space-between, so the adornment must sit inside the lead group — not as
  // a third flex child — or it floats into the middle).
  labelLead.append(labelText);
  if (labelAdornment) {
    labelAdornment.addEventListener('click', (event) => event.stopPropagation());
    labelLead.append(labelAdornment);
  }
  if (actionsEl) {
    actionsEl.addEventListener('click', (event) => event.stopPropagation());
    labelActions.append(actionsEl);
  }
  labelActions.append(chevron);
  labelRow.append(labelLead, labelActions);
  labelRow.addEventListener('click', () => {
    section.classList.toggle('is-collapsed');
  });
  content.append(contentEl);
  section.append(labelRow, content);

  return section;
}

function cleanupTransientState() {
  if (_dismissTimer) {
    clearTimeout(_dismissTimer);
    _dismissTimer = null;
  }

  for (const cleanup of _cleanupHandlers.splice(0)) {
    cleanup();
  }

  for (const timer of _skillRevealTimers) {
    clearTimeout(timer);
  }
  _skillRevealTimers.clear();

  _tooltip?.remove();
  _tooltip = null;
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

function renderSkillScalePopover() {
  const popover = createElement('div', 'skill-scale-popover');

  popover.hidden = true;
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Skill proficiency scale');

  for (const { level, label } of SKILL_LEVELS) {
    const item = createElement('div', 'skill-scale-popover__item');
    const swatch = createElement('span', `skill-scale-popover__swatch skill-level-${level}`);
    const text = createElement('span', 'skill-scale-popover__text');

    swatch.setAttribute('aria-hidden', 'true');
    text.append(
      createElement('strong', 'skill-scale-popover__label', label),
      createElement('span', 'skill-scale-popover__flavor', SKILL_FLAVOR[level]),
    );
    item.append(swatch, text);
    popover.append(item);
  }

  return popover;
}

function renderSkillRow(skill) {
  const label = getSkillLabel(skill.level);
  const row = document.createElement('button');
  const name = createElement('span', 'skill-meter-row__name', skill.name);
  const value = createElement('span', 'skill-meter-row__value');
  const meter = createElement('span', 'skill-meter');
  const levelText = createElement('span', 'skill-meter-row__level', `${skill.level} · ${label}`);

  row.type = 'button';
  // skill-level-{n} on the row sets --skill-level-color for BOTH the meter fill
  // and the revealed level word (so the word is in the level's colour).
  row.className = `skill-meter-row skill-level-${skill.level}`;
  row.setAttribute('aria-label', `${skill.name}: ${label}, level ${skill.level} of 5`);
  name.title = skill.name;

  for (let segment = 1; segment <= 5; segment += 1) {
    const part = createElement('span', 'skill-meter__segment');

    if (segment <= skill.level) {
      part.classList.add('is-filled');
    }

    part.setAttribute('aria-hidden', 'true');
    meter.append(part);
  }

  row.addEventListener('mouseenter', () => row.classList.add('is-revealed'));
  row.addEventListener('mouseleave', () => row.classList.remove('is-revealed'));
  row.addEventListener('click', () => {
    row.classList.add('is-revealed');

    const timer = setTimeout(() => {
      row.classList.remove('is-revealed');
      _skillRevealTimers.delete(timer);
    }, 2500);

    _skillRevealTimers.add(timer);
  });

  value.append(meter, levelText);
  row.append(name, value);

  return row;
}

function sortSkills(skills, mode, direction) {
  const withIndex = skills.map((skill, index) => ({ skill, index }));

  if (mode === 'level') {
    withIndex.sort((a, b) => {
      const levelDelta = direction === 'desc'
        ? b.skill.level - a.skill.level
        : a.skill.level - b.skill.level;

      return levelDelta || a.index - b.index;
    });
  }

  return withIndex.map((entry) => entry.skill);
}

function renderSkills(profile, container) {
  const skills = normaliseProfile({ skills: profile.skills }).skills
    .filter((skill) => skill.name && skill.level !== null);

  if (skills.length === 0) {
    return;
  }

  let sortMode = 'custom';
  let sortDirection = 'desc';
  let expanded = false;
  const wrapper = createElement('div', 'skills-display');
  const controls = createElement('div', 'skills-display__controls');
  const scaleWrap = createElement('div', 'skill-scale');
  const scaleButton = createButton('?', 'skill-scale-trigger', (event) => {
    event.stopPropagation();
    popover.hidden = !popover.hidden;
  });
  const popover = renderSkillScalePopover();
  const customButton = createButton('Custom', 'skill-sort-btn is-active', () => {
    sortMode = 'custom';
    customButton.classList.add('is-active');
    levelButton.classList.remove('is-active');
    renderList();
  });
  const levelButton = createButton('By level ▾', 'skill-sort-btn', () => {
    if (sortMode === 'level') {
      sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      sortMode = 'level';
      sortDirection = 'desc';
    }

    customButton.classList.remove('is-active');
    levelButton.classList.add('is-active');
    levelButton.textContent = sortDirection === 'desc' ? 'By level ▾' : 'By level ▴';
    renderList();
  });
  const list = createElement('div', 'skill-meter-list');
  const toggle = createButton('', 'skill-list-toggle', () => {
    expanded = !expanded;
    renderList();
  });

  function closePopover() {
    popover.hidden = true;
  }

  function renderList() {
    const visibleSkills = sortSkills(skills, sortMode, sortDirection);
    const shouldCollapse = visibleSkills.length > 10;
    const renderedSkills = shouldCollapse && !expanded
      ? visibleSkills.slice(0, 10)
      : visibleSkills;

    list.replaceChildren(...renderedSkills.map(renderSkillRow));
    toggle.hidden = !shouldCollapse;
    toggle.textContent = expanded ? 'Show less' : `Show all ${visibleSkills.length} skills ▾`;
  }

  const onDocumentClick = (event) => {
    if (!scaleWrap.contains(event.target)) {
      closePopover();
    }
  };
  const onDocumentKeydown = (event) => {
    if (event.key === 'Escape') {
      closePopover();
    }
  };

  scaleButton.setAttribute('aria-label', 'Show skill proficiency scale');
  customButton.dataset.sort = 'custom';
  levelButton.dataset.sort = 'level';
  scaleWrap.append(scaleButton, popover);
  // Sort controls live INSIDE the section body so they collapse with the
  // content on mobile (and don't crowd the collapse chevron). The "?" sits
  // beside the SKILLS label as an inline adornment. A "Sort" lead label anchors
  // the row so the buttons don't float against empty space.
  const sortLabel = createElement('span', 'skills-display__controls-label', 'Sort');
  controls.append(sortLabel, customButton, levelButton);
  wrapper.append(controls, list, toggle);
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);
  _cleanupHandlers.push(() => {
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onDocumentKeydown);
  });
  renderList();

  container.append(renderSubSection('SKILLS', wrapper, null, scaleWrap));
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
  renderSkills(profile, content);
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

const ACCOUNT_COPY = {
  hosted: 'Permanently delete your account and all associated data.',
  local: 'Permanently clear all locally stored applications and profile data.',
  demo: 'Account deletion applies to a real hosted account and isn’t available in the demo.',
};

function resolveAccountMode() {
  const { status } = authStore.getAuthState();

  if (status === 'authenticated') {
    return 'hosted';
  }

  if (status === authStore.DEMO_STATUS) {
    return 'demo';
  }

  return 'local';
}

// Builds the mode-specific `onConfirm` handler the modal invokes. The handler
// owns the network call + side effects; it re-throws INVALID_PASSWORD so the
// modal keeps itself open, and re-throws other errors (after toasting) so the
// modal closes.
function buildAccountConfirm(mode, navigate, container, health) {
  if (mode === 'hosted') {
    return async (password) => {
      try {
        await deleteAccount({ password });
      } catch (error) {
        if (error?.code === 'INVALID_PASSWORD') {
          throw error;
        }
        Toast.show('Could not delete your account. Please try again.', 'error');
        throw error;
      }

      // Stage the success confirmation so it survives the sign-out reroute
      // (the reroute clears document.body, removing any toast shown now).
      // FR-013 / US1 — shown on the Welcome page by main.js.
      authStore.setAuthNotice('Account deleted.', 'success');
      await authStore.signOut();
    };
  }

  return async () => {
    try {
      await deleteAccount({ confirm: 'DELETE' });
    } catch (error) {
      Toast.show('Could not clear your data. Please try again.', 'error');
      throw error;
    }

    Toast.show('All data cleared.', 'success');
    if (container) {
      // Re-mount in place so the Tracker/Profile empty states render without a
      // full reload (navigate('profile') is a no-op when already on Profile).
      await mount(container, { navigate, health });
    }
  };
}

function createSetGroup(label, body) {
  const group = createElement('div', 'set-group');
  const labelEl = createElement('div', 'set-group__label', label);

  group.append(labelEl, body);

  return group;
}

function renderAccountGroup({ navigate, container, health } = {}) {
  const mode = resolveAccountMode();
  const body = createElement('div', 'account-section');

  if (mode === 'demo') {
    body.classList.add('account-section--demo');
    body.append(
      createElement('p', 'account-section__title', "Account management isn't available in the demo."),
      createElement('p', 'account-section__desc', ACCOUNT_COPY.demo),
    );

    return createSetGroup('ACCOUNT', body);
  }

  const description = createElement('p', 'account-section__desc', ACCOUNT_COPY[mode]);
  const label = mode === 'local' ? 'Clear all data' : 'Delete account';
  const button = createButton(label, 'profile-btn profile-btn--danger account-section__btn', () => {
    DeleteAccountModal.open({ mode, onConfirm: buildAccountConfirm(mode, navigate, container, health) });
  });

  body.append(description, button);

  return createSetGroup('ACCOUNT', body);
}

const CONNECTION_LABELS = {
  none: 'Not connected',
  connected: 'Connected',
  testing: 'Testing...',
  error: 'Key invalid',
};

const UPDATE_MODE_COPY = {
  notify: {
    title: 'Notify only',
    description: 'Show a badge when a new version is ready.',
  },
  ask: {
    title: 'Ask before installing',
    description: 'Confirm each update before it downloads.',
  },
};

const EYE_ICON_PATH = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z';
const FEATURE_COPY = {
  cv: {
    title: 'Resume parsing',
    description: 'Extract structured fields from uploaded resumes.',
  },
  jd: {
    title: 'Job-description parsing',
    description: 'Pull role, skills, and salary from pasted listings.',
  },
  compat: {
    title: 'Compatibility analysis',
    description: 'Score how well each role matches your profile.',
  },
};

function maskKey(key) {
  if (!key) {
    return '';
  }

  return `sk-or-v1-************${key.slice(-4)}`;
}

function createSwitch({ pressed, disabled = false, label, onClick }) {
  const button = createButton('', `sw${pressed ? ' is-on' : ''}`, onClick);

  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(Boolean(pressed)));
  if (disabled) {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
  }

  button.append(createElement('span', 'sw__knob'));

  return button;
}

function createIconOnlyButton(label, className, iconPath, onClick) {
  const button = createButton('', className, onClick);

  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(createSvgIcon(iconPath));

  return button;
}

async function updateJson(path, options = {}) {
  const response = await globalThis.fetch(`/api/update/${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error?.message || 'Update request failed.');
  }

  return body;
}

function statusPill(label, tone = 'ok') {
  const pill = createElement('span', `update-settings__pill update-settings__pill--${tone}`);
  pill.append(createElement('span', 'update-settings__pill-dot'), document.createTextNode(label));
  return pill;
}

function versionChip(version) {
  return createElement('span', 'update-settings__version-chip', version);
}

function updateHeadline({ label, heading, chip, muted, pill } = {}) {
  const headline = createElement('div', 'update-settings__headline');
  if (label) {
    headline.append(createElement('span', 'update-settings__label', label));
  }
  if (heading) {
    headline.append(createElement('span', 'update-settings__heading', heading));
  }
  if (chip) {
    headline.append(versionChip(chip));
  }
  if (muted) {
    headline.append(createElement('span', 'update-settings__inline-muted', muted));
  }
  if (pill) {
    headline.append(pill);
  }
  return headline;
}

function createUpdateProgress(value, { indeterminate = false } = {}) {
  const progressValue = Math.max(0, Math.min(100, Number(value) || 0));
  const progress = createElement('div', `update-settings__progress${indeterminate ? ' update-settings__progress--indeterminate' : ''}`);
  const bar = document.createElement('span');

  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', indeterminate ? 'Installing update' : 'Update download progress');
  if (!indeterminate) {
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '100');
    progress.setAttribute('aria-valuenow', String(progressValue));
    bar.style.width = `${progressValue}%`;
  }
  progress.append(bar);

  return progress;
}

function displayVersion(version) {
  const value = String(version || APP_VERSION);
  return value.toLowerCase().startsWith('v') ? value : `v${value}`;
}

function renderUpdateSettingsGroup({ health } = {}) {
  if (!health?.updateSupported) {
    return null;
  }

  const body = createElement('div', 'update-settings');
  const state = {
    settings: { autoCheckUpdates: true, updateMode: 'ask' },
    expanded: false,
    status: 'loading',
    release: null,
    error: null,
    downloadStartedAt: 0,
  };
  let unsubscribeStatus = null;
  let unsubscribeController = null;
  let settingsSaveId = 0;

  _cleanupHandlers.push(() => {
    unsubscribeStatus?.();
    unsubscribeController?.();
    unsubscribeStatus = null;
    unsubscribeController = null;
  });

  function applyStatus(status) {
    if (Object.hasOwn(status, 'autoCheckUpdates') || Object.hasOwn(status, 'updateMode')) {
      state.settings = {
        autoCheckUpdates: status.autoCheckUpdates ?? state.settings.autoCheckUpdates,
        updateMode: status.updateMode ?? state.settings.updateMode,
      };
    }
    state.status = status.status === 'failed' ? 'failed' : status.status;
    state.error = status.error ?? null;
    state.release = {
      ...(state.release ?? {}),
      currentVersion: status.currentVersion ?? state.release?.currentVersion,
      latestVersion: status.latestVersion ?? state.release?.latestVersion,
      releaseNotesUrl: status.releaseNotesUrl ?? state.release?.releaseNotesUrl,
      progress: status.progress ?? state.release?.progress,
      bytesTotal: status.bytesTotal ?? state.release?.bytesTotal,
      bytesDownloaded: status.bytesDownloaded ?? state.release?.bytesDownloaded,
      restartDelayed: status.restartDelayed ?? state.release?.restartDelayed,
      updateAvailable: status.status === 'available',
    };
    if (state.status === 'downloading' && !state.downloadStartedAt) {
      state.downloadStartedAt = Date.now();
    } else if (state.status !== 'downloading') {
      state.downloadStartedAt = 0;
    }
  }

  function saveSettings(nextSettings) {
    const previousSettings = state.settings;
    const saveId = settingsSaveId + 1;
    settingsSaveId = saveId;
    state.settings = nextSettings;
    render();
    updateJson('settings', {
      method: 'POST',
      body: JSON.stringify(nextSettings),
    }).then(() => {
      if (saveId !== settingsSaveId) {
        return;
      }
      state.settings = nextSettings;
      globalThis.dispatchEvent?.(new globalThis.CustomEvent('alice-update-settings-changed', {
        detail: nextSettings,
      }));
      render();
    }).catch((error) => {
      if (saveId !== settingsSaveId) {
        return;
      }
      state.settings = previousSettings;
      state.error = error.message;
      Toast.show('Could not save update settings.', 'error');
      render();
    });
  }

  async function checkNow() {
    await checkUpdate({ refreshStatus: false });
    if (getUpdateStatus().status === 'idle') {
      Toast.show("You're on the latest version.", 'success');
    }
    render();
  }

  async function installNow() {
    state.downloadStartedAt = Date.now();
    await downloadUpdate();
    render();
  }

  async function restartNow() {
    await restartUpdate();
    render();
  }

  function whatsNewLink() {
    if (!state.release?.releaseNotesUrl) {
      return null;
    }
    const link = createElement('a', 'update-settings__link', "What's new ↗");
    link.href = getSafeExternalHref(state.release.releaseNotesUrl);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  async function cancelDownload() {
    await cancelUpdate();
    render();
  }

  function etaSuffix() {
    const total = state.release?.bytesTotal;
    const done = state.release?.bytesDownloaded;
    if (!total || !done || !state.downloadStartedAt) {
      return '';
    }
    const elapsed = (Date.now() - state.downloadStartedAt) / 1000;
    const rate = elapsed > 0 ? done / elapsed : 0;
    if (rate <= 0) {
      return '';
    }
    const seconds = Math.ceil(Math.max(0, total - done) / rate);
    return Number.isFinite(seconds) ? ` · ~${seconds}s` : '';
  }

  function renderStatusBlock() {
    const block = createElement('div', 'update-settings__status-block');
    const top = createElement('div', 'update-settings__status');
    const copy = createElement('div', 'update-settings__status-copy');
    const actions = createElement('div', 'update-settings__actions');
    const version = state.release?.latestVersion ? displayVersion(state.release.latestVersion) : null;

    if (state.status === 'loading') {
      copy.append(updateHeadline({ label: 'Current version', chip: displayVersion(APP_VERSION) }));
      copy.append(createElement('p', 'update-settings__subline', 'Loading update preferences…'));
      top.append(copy);
      block.append(top);
      return block;
    }

    if (state.status === 'check-failed') {
      copy.append(updateHeadline({ heading: 'Check failed', pill: statusPill('Connection Error', 'warn') }));
      copy.append(createElement('p', 'update-settings__subline', state.error || 'Could not reach the update service.'));
      actions.append(createButton('Check now', 'profile-btn profile-btn--outline profile-btn--compact', checkNow));
      top.append(copy, actions);
      block.append(top);
      return block;
    }

    if (state.status === 'failed') {
      copy.append(updateHeadline({ heading: 'Update failed', pill: statusPill('Update Failed', 'danger') }));
      copy.append(createElement('p', 'update-settings__subline', state.error || 'Verification failed: integrity check mismatch.'));
      actions.append(createButton('Retry Download', 'profile-btn profile-btn--primary profile-btn--compact', installNow));
      top.append(copy, actions);
      block.append(top);
      return block;
    }

    if (state.status === 'available') {
      copy.append(updateHeadline({ heading: 'Update available', chip: version || 'new version' }));
      const sub = createElement('p', 'update-settings__subline');
      sub.append(document.createTextNode(`You're on ${displayVersion(state.release?.currentVersion || APP_VERSION)}`));
      const link = whatsNewLink();
      if (link) {
        sub.append(document.createTextNode(' · '));
        sub.append(link);
      }
      copy.append(sub);
      actions.append(createButton('Install', 'profile-btn profile-btn--primary profile-btn--compact', installNow));
      top.append(copy, actions);
      block.append(top);
      return block;
    }

    if (state.status === 'downloading') {
      const pct = Math.max(0, Math.min(100, Math.round(state.release?.progress ?? 0)));
      copy.append(updateHeadline({ heading: 'Downloading', chip: version || displayVersion(APP_VERSION) }));
      actions.append(createElement('span', 'update-settings__meta', `${pct}%${etaSuffix()}`));
      top.append(copy, actions);
      block.append(top, createUpdateProgress(pct));

      const footer = createElement('div', 'update-settings__footer');
      footer.append(
        whatsNewLink() || createElement('span', 'update-settings__footer-note', ''),
        createButton('Cancel', 'update-settings__ghost', cancelDownload),
      );
      block.append(footer);
      return block;
    }

    if (state.status === 'verifying' || state.status === 'extracting') {
      copy.append(updateHeadline({
        heading: state.status === 'verifying' ? 'Verifying' : 'Extracting',
        chip: version || displayVersion(APP_VERSION),
        muted: state.status === 'verifying' ? 'checking the update package…' : 'preparing files…',
      }));
      top.append(copy);
      block.append(top, createUpdateProgress(100, { indeterminate: true }));

      const footer = createElement('div', 'update-settings__footer');
      footer.append(
        whatsNewLink() || createElement('span', 'update-settings__footer-note', ''),
      );
      block.append(footer);
      return block;
    }

    if (state.status === 'ready-to-restart') {
      copy.append(updateHeadline({ heading: 'Installing', chip: version || displayVersion(APP_VERSION), muted: 'applying changes…' }));
      top.append(copy);
      block.append(top, createUpdateProgress(100, { indeterminate: true }));

      const footer = createElement('div', 'update-settings__footer');
      footer.append(
        createElement('span', 'update-settings__footer-note', 'Restart to apply the update.'),
        createButton('Restart to finish', 'profile-btn profile-btn--primary profile-btn--compact', restartNow),
      );
      block.append(footer);
      return block;
    }

    if (state.status === 'installing') {
      copy.append(updateHeadline({
        heading: 'Restarting Alice',
        chip: version || displayVersion(APP_VERSION),
        muted: state.release?.restartDelayed
          ? 'Alice is taking longer than expected to come back online.'
          : 'waiting for Alice to come back online…',
      }));
      top.append(copy);
      block.append(top, createUpdateProgress(100, { indeterminate: true }));

      const footer = createElement('div', 'update-settings__footer');
      footer.append(createElement('span', 'update-settings__footer-note', 'Keep this tab open while Alice restarts.'));
      block.append(footer);
      return block;
    }

    copy.append(updateHeadline({ label: 'Current version', chip: displayVersion(APP_VERSION), pill: statusPill('Up to date', 'ok') }));
    actions.append(createButton('Check now', 'profile-btn profile-btn--outline profile-btn--compact', checkNow));
    top.append(copy, actions);
    block.append(top);
    return block;
  }

  function renderModePicker() {
    const disabled = !state.settings.autoCheckUpdates;
    const expanded = state.expanded && !disabled;
    const wrap = createElement('div', `update-mode${expanded ? ' is-expanded' : ''}${disabled ? ' is-disabled' : ''}`);
    const current = UPDATE_MODE_COPY[state.settings.updateMode] ?? UPDATE_MODE_COPY.ask;
    const modeEntries = Object.entries(UPDATE_MODE_COPY);
    const focusMode = (currentIndex, direction) => {
      const nextIndex = (currentIndex + direction + modeEntries.length) % modeEntries.length;
      const [nextMode] = modeEntries[nextIndex];
      const nextCard = body.querySelector(`[data-update-mode="${nextMode}"]`);

      nextCard?.focus();
    };
    const toggle = createButton('', 'update-mode__summary', () => {
      state.expanded = !state.expanded;
      render();
    });
    toggle.disabled = disabled;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-controls', 'update-mode-options');
    const chevron = createElement('span', 'update-mode__chevron');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.append(createSvgIcon('M6 9l6 6 6-6'));
    toggle.append(
      createElement('span', 'update-mode__label', 'UPDATE MODE'),
      createElement('span', 'update-mode__value', current.title),
      chevron,
    );
    wrap.append(toggle);

    if (expanded) {
      const cards = createElement('div', 'update-mode__cards');
      cards.id = 'update-mode-options';
      cards.setAttribute('role', 'radiogroup');
      cards.setAttribute('aria-label', 'Update mode');
      modeEntries.forEach(([mode, copy], index) => {
        const selected = state.settings.updateMode === mode;
        const card = createButton('', `update-mode-card${state.settings.updateMode === mode ? ' is-selected' : ''}`, () => {
          saveSettings({ ...state.settings, updateMode: mode });
        });
        card.dataset.updateMode = mode;
        card.setAttribute('role', 'radio');
        card.setAttribute('aria-checked', String(selected));
        card.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault();
            focusMode(index, 1);
          } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault();
            focusMode(index, -1);
          }
        });
        card.append(
          createElement('span', 'update-mode-card__title', copy.title),
          createElement('span', 'update-mode-card__desc', copy.description),
        );
        cards.append(card);
      });
      wrap.append(cards);
    }

    return wrap;
  }

  function render() {
    const autoRow = createElement('div', 'master-row update-settings__auto-row');
    const copy = createElement('div', 'master-row__copy');
    const toggle = createSwitch({
      pressed: state.settings.autoCheckUpdates,
      label: 'Check for updates automatically',
      onClick: () => {
        saveSettings({
          ...state.settings,
          autoCheckUpdates: !state.settings.autoCheckUpdates,
        });
      },
    });

    copy.append(
      createElement('div', 'master-row__title', 'Check for updates automatically'),
      createElement('p', 'master-row__desc', 'Alice looks for new versions in the background.'),
    );
    autoRow.append(copy, toggle);
    body.replaceChildren(renderStatusBlock(), createElement('div', 'update-settings__rule'), autoRow, renderModePicker());
  }

  unsubscribeStatus = subscribeUpdateStatus((status) => {
    if (!status?.status) {
      return;
    }
    applyStatus(status);
    render();
  }, { emit: true });
  unsubscribeController = subscribeUpdateController();

  render();
  return createSetGroup('UPDATES', body);
}

function renderAiSettingsGroup() {
  const body = createElement('div', 'ai-settings');
  let enabled = aiSettings.isEnabled();
  let editingKey = !aiSettings.hasKey();
  let revealed = false;
  let testState = null;

  function currentStatus() {
    return aiSettings.getConnectionStatus(testState);
  }

  function render() {
    body.replaceChildren();

    const master = createElement('div', 'master-row');
    const masterCopy = createElement('div', 'master-row__copy');
    const masterSwitch = createSwitch({
      pressed: enabled,
      label: 'Toggle AI features',
      onClick: () => {
        enabled = !enabled;
        aiSettings.setEnabled(enabled);
        render();
      },
    });
    const aiBody = createElement('div', `ai-body${enabled ? '' : ' is-disabled'}`);
    const panel = createElement('div', 'conn-panel');
    const panelHeader = createElement('div', 'conn-panel__header');
    const status = currentStatus();
    const statusPill = createElement('span', `conn-status conn-status--${status}`, CONNECTION_LABELS[status]);
    const keyArea = createElement('div', 'conn-panel__key');
    const modelField = createElement('label', 'edit-field conn-panel__model');
    const modelLabel = createElement('span', 'edit-field__label', 'Model');
    const modelInput = document.createElement('input');
    const modelHint = createElement('span', 'edit-field__hint conn-panel__model-hint', 'Any OpenRouter model slug.');
    const helper = createElement(
      'p',
      'conn-panel__helper',
      'Stored only in this browser; never sent to our servers. Using your own OpenRouter key is your responsibility.',
    );
    const featureList = createElement('div', 'feat-list');

    masterCopy.append(
      createElement('div', 'master-row__title', 'AI features'),
      createElement('p', 'master-row__desc', 'Power resume and job-description parsing and compatibility scoring with your own OpenRouter key.'),
    );
    master.append(masterCopy, masterSwitch);
    aiBody.setAttribute('aria-disabled', String(!enabled));
    if (!enabled) {
      aiBody.inert = true;
      aiBody.setAttribute('inert', '');
    }

    panelHeader.append(createElement('div', 'conn-panel__title', 'Connection'), statusPill);

    if (editingKey) {
      const keyField = createElement('label', 'edit-field conn-panel__field');
      const keyLabel = createElement('span', 'edit-field__label', 'OpenRouter API key');
      const keyInput = document.createElement('input');
      const keyActions = createElement('div', 'conn-panel__actions');
      const show = createIconOnlyButton('Show key', 'profile-btn profile-btn--outline profile-btn--compact conn-panel__icon-btn', EYE_ICON_PATH, () => {
        keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
        const label = keyInput.type === 'password' ? 'Show key' : 'Hide key';

        show.setAttribute('aria-label', label);
        show.title = label;
      });
      const save = createButton('Save key', 'profile-btn profile-btn--primary profile-btn--compact', () => {
        const key = keyInput.value.trim();

        if (!key) {
          return;
        }

        aiSettings.setKey(key);
        Toast.show('AI key saved.', 'success');
        editingKey = false;
        testState = null;
        render();
      });
      keyInput.id = 'ai-openrouter-key';
      keyInput.type = 'password';
      keyInput.autocomplete = 'off';
      keyInput.className = 'edit-field__control';
      keyInput.placeholder = 'Paste OpenRouter key';
      keyField.setAttribute('for', 'ai-openrouter-key');
      keyField.append(keyLabel, keyInput);
      keyActions.append(show, save);
      keyArea.append(keyField, keyActions);
    } else {
      const savedWrap = createElement('div', 'conn-panel__saved-wrap');
      const savedLabel = createElement('div', 'edit-field__label conn-panel__saved-label', 'OpenRouter API key');
      const saved = createElement('div', 'conn-panel__saved-key');
      const keyText = createElement('code', 'conn-panel__key-text', revealed ? aiSettings.getKey() : maskKey(aiSettings.getKey()));
      const actions = createElement('div', 'conn-panel__actions');
      const show = createIconOnlyButton(revealed ? 'Hide key' : 'Show key', 'profile-btn profile-btn--outline profile-btn--compact conn-panel__icon-btn', EYE_ICON_PATH, () => {
        revealed = !revealed;
        render();
      });
      const test = createButton('Test', 'profile-btn profile-btn--outline profile-btn--compact', async () => {
        testState = 'testing';
        render();

        const result = await validateKey(aiSettings.getKey());

        testState = result.ok ? null : 'error';
        render();
      });
      const replace = createButton('Replace', 'profile-btn profile-btn--outline profile-btn--compact', () => {
        editingKey = true;
        revealed = false;
        render();
      });
      const deleteKey = createButton('Delete', 'profile-btn profile-btn--outline profile-btn--compact profile-btn--muted-danger conn-panel__delete-btn', () => {
        aiSettings.clearKey();
        Toast.show('AI key deleted.', 'success');
        editingKey = true;
        revealed = false;
        testState = null;
        render();
      });

      saved.append(keyText);
      savedWrap.append(savedLabel, saved);
      actions.append(show, test, replace, deleteKey);
      keyArea.append(savedWrap, actions);
    }

    modelInput.id = 'ai-model-slug';
    modelInput.className = 'edit-field__control';
    modelInput.value = aiSettings.getModel();
    modelInput.autocomplete = 'off';
    modelInput.placeholder = 'provider/model-slug';
    modelInput.addEventListener('change', () => aiSettings.setModel(modelInput.value));
    modelField.setAttribute('for', 'ai-model-slug');
    modelField.append(modelLabel, modelInput, modelHint);
    panel.append(panelHeader, keyArea, modelField, helper);

    featureList.append(createElement('div', 'feat-list__label', 'ENABLED FEATURES'));
    for (const key of ['cv', 'jd', 'compat']) {
      const item = createElement('div', 'feat-item');
      const copy = createElement('div', 'feat-item__copy');
      const toggle = createSwitch({
        pressed: aiSettings.getFeature(key),
        label: `Toggle ${FEATURE_COPY[key].title}`,
        onClick: () => {
          const nextValue = !aiSettings.getFeature(key);
          aiSettings.setFeature(key, nextValue);
          render();
        },
      });

      toggle.dataset.aiFeature = key;
      copy.append(
        createElement('div', 'feat-item__title', FEATURE_COPY[key].title),
        createElement('p', 'feat-item__desc', FEATURE_COPY[key].description),
      );
      item.append(copy, toggle);
      featureList.append(item);
    }

    aiBody.append(panel, featureList);
    body.append(master, aiBody);
  }

  render();

  return createSetGroup('ARTIFICIAL INTELLIGENCE', body);
}

function renderDemoAiSettingsGroup() {
  const body = createElement('div', 'ai-demo-note');

  body.append(
    createElement('p', 'ai-demo-note__title', "AI and Smart features aren't available in the demo."),
    createElement('p', 'ai-demo-note__copy', 'They are available when using Alice with a real local or hosted profile.'),
  );

  return createSetGroup('ARTIFICIAL INTELLIGENCE', body);
}

function renderSettingsSection(page, { navigate, container, health } = {}) {
  const { section } = createSection('SETTINGS');
  const isDemo = authStore.getAuthState().status === authStore.DEMO_STATUS;

  section.classList.add('settings-section');
  section.append(isDemo ? renderDemoAiSettingsGroup() : renderAiSettingsGroup());
  const updatesGroup = renderUpdateSettingsGroup({ health });
  if (updatesGroup) {
    section.append(updatesGroup);
  }
  section.append(renderAccountGroup({ navigate, container, health }));
  page.append(section);

  return section;
}

function focusSettingsSection(section) {
  if (!section) {
    return;
  }

  section.tabIndex = -1;
  section.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  section.focus({ preventScroll: true });
}

export async function mount(container, { navigate, focusSettings = false, health = null } = {}) {
  cleanupTransientState();

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
  const settingsSection = renderSettingsSection(page, { navigate: safeNavigate, container, health });

  if (focusSettings) {
    focusSettingsSection(settingsSection);
  }
}

export function unmount() {
  cleanupTransientState();

  if (_container) {
    _container.replaceChildren();
  }

  _container = null;
}

export const Profile = { mount, unmount };
