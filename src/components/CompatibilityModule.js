import * as api from '../services/api.js';
import * as aiSettingsDefault from '../data/aiSettings.js';
import { generateNotes } from '../services/compatNotesService.js';
import aiSparkle from '../assets/AI_sparkle.png';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let _activeState = null;
let _applicationKey = null;
let _open = false;
let _localState = null;
let _inFlight = false;
let _modalDirty = false;

export const COMPAT_TIERS = Object.freeze({
  Low: Object.freeze({
    key: 'Low',
    label: 'Low',
    verdict: 'Low match',
    arc: '#EF4444',
    ink: '#DC2626',
    bg: 'rgba(239,68,68,0.12)',
  }),
  Medium: Object.freeze({
    key: 'Medium',
    label: 'Medium',
    verdict: 'Medium match',
    arc: '#EAB308',
    ink: '#A16207',
    bg: 'rgba(234,179,8,0.16)',
  }),
  High: Object.freeze({
    key: 'High',
    label: 'High',
    verdict: 'High match',
    arc: '#15803D',
    ink: '#15803D',
    bg: 'rgba(21,128,61,0.12)',
  }),
  Great: Object.freeze({
    key: 'Great',
    label: 'Great',
    verdict: 'Great match',
    arc: '#2563EB',
    ink: '#2563EB',
    bg: 'rgba(37,99,235,0.12)',
  }),
});

function clampScore(score) {
  const number = Number(score);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(number)));
}

export function getTier(score) {
  const safeScore = clampScore(score);
  if (safeScore >= 85) return COMPAT_TIERS.Great;
  if (safeScore >= 65) return COMPAT_TIERS.High;
  if (safeScore >= 40) return COMPAT_TIERS.Medium;
  return COMPAT_TIERS.Low;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, onClick) {
  const node = el('button', className, text);
  node.type = 'button';
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

function applicationKey(application) {
  return application?.id == null ? 'create' : `id:${application.id}`;
}

export function resetCompatibilityModuleState() {
  _activeState = null;
  _applicationKey = null;
  _open = false;
  _localState = null;
  _inFlight = false;
  _modalDirty = false;
}

export function setDirty(isDirty) {
  const nextDirty = Boolean(isDirty);
  if (_modalDirty === nextDirty) {
    return;
  }

  _modalDirty = nextDirty;
  if (_activeState) {
    _activeState.isModalDirty = _modalDirty;
    renderInto(_activeState);
  }
}

function svgEl(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

export function renderScoreRing(score, size = 64) {
  const safeScore = clampScore(score);
  const tier = getTier(safeScore);
  const stroke = size <= 30 ? 4 : 8;
  const center = size / 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = safeScore === 0 ? 0 : (circumference * safeScore) / 100;
  const svg = svgEl('svg', {
    class: 'ring-wrap',
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    role: 'img',
    'aria-label': `${safeScore} ${tier.verdict}`,
  });
  const track = svgEl('circle', {
    class: 'ring-track',
    cx: center,
    cy: center,
    r: radius,
    fill: 'none',
    stroke: '#EDE8DF',
    'stroke-width': stroke,
  });
  const arc = svgEl('circle', {
    class: 'ring-arc',
    cx: center,
    cy: center,
    r: radius,
    fill: 'none',
    stroke: tier.arc,
    'stroke-width': stroke,
    'stroke-linecap': 'round',
    'stroke-dasharray': `${arcLength} ${circumference}`,
    transform: `rotate(-90 ${center} ${center})`,
  });
  const number = svgEl('text', {
    class: 'ring-num',
    x: center,
    y: center,
    'dominant-baseline': 'central',
    'text-anchor': 'middle',
    'font-size': Math.round(size * 0.32),
  });
  number.textContent = String(safeScore);
  svg.append(track, arc, number);
  return svg;
}

export function isProfileSufficient(profile) {
  return Boolean(
    (Array.isArray(profile?.skills) && profile.skills.length > 0)
      || (Array.isArray(profile?.experience) && profile.experience.length > 0)
      || (typeof profile?.summary === 'string' && profile.summary.trim().length > 0),
  );
}

export function deriveNotesState(application, localState) {
  if (localState === 'generating' || localState === 'error') {
    return localState;
  }

  const notes = application?.compatAnalysis ?? null;
  if (!notes) {
    return 'none';
  }

  const generatedAt = typeof notes.generatedAt === 'string' ? notes.generatedAt : '';
  const compatScoredAt = typeof application?.compatScoredAt === 'string'
    ? application.compatScoredAt
    : '';

  if (generatedAt && compatScoredAt && generatedAt < compatScoredAt) {
    return 'stale';
  }

  return 'fresh';
}

function hasAiConfigured(aiSettings) {
  return Boolean(
    aiSettings?.hasKey?.()
      && aiSettings?.isEnabled?.()
      && (typeof aiSettings?.getFeature !== 'function' || aiSettings.getFeature('compat')),
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function renderBoldText(container, text) {
  const source = typeof text === 'string' ? text : '';
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf('**', cursor);
    if (start === -1) {
      container.append(document.createTextNode(source.slice(cursor)));
      return;
    }

    if (start > cursor) {
      container.append(document.createTextNode(source.slice(cursor, start)));
    }

    const end = source.indexOf('**', start + 2);
    if (end === -1) {
      container.append(document.createTextNode(source.slice(start)));
      return;
    }

    const boldText = source.slice(start + 2, end);
    if (boldText.length === 0) {
      container.append(document.createTextNode('****'));
    } else {
      const strong = document.createElement('strong');
      strong.textContent = boldText;
      container.append(strong);
    }
    cursor = end + 2;
  }
}

function createAiTag(dimmed = false) {
  const tag = el('span', 'ai-tag');
  const icon = document.createElement('img');
  const label = el('span', null, 'AI');

  icon.className = 'ai-tag__icon';
  icon.src = aiSparkle;
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  tag.append(icon, label);

  if (dimmed) {
    tag.style.opacity = '0.5';
  }
  return tag;
}

function createEnableAiLink(actions) {
  const link = el('a', 'cx-enable-ai', 'Enable AI →');
  link.href = '#profile';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    actions.openSettings();
  });
  return link;
}

function createLockIcon() {
  const frame = el('span', 'cx-stale-ic cx-stale-ic--lock');
  const svg = svgEl('svg', {
    viewBox: '0 0 16 16',
    width: '14',
    height: '14',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const body = svgEl('rect', {
    x: '4',
    y: '7',
    width: '8',
    height: '6',
    rx: '1.5',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.4',
  });
  const shackle = svgEl('path', {
    d: 'M5.5 7V5.8a2.5 2.5 0 0 1 5 0V7',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.4',
    'stroke-linecap': 'round',
  });
  svg.append(body, shackle);
  frame.append(svg);
  return frame;
}

function createSparkleIcon(className = 'cx-empty-ic') {
  const frame = el('span', className);
  const icon = document.createElement('img');
  icon.className = 'cx-empty-ic-img';
  icon.src = aiSparkle;
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  frame.append(icon);
  return frame;
}

function createVerdictPill(tier) {
  const pill = el('span', 'verdict-pill');
  pill.style.color = tier.ink;
  pill.style.background = tier.bg;
  const dot = el('span', 'vd');
  dot.style.background = tier.arc;
  const label = el('span', null, tier.verdict);
  pill.append(dot, label);
  return pill;
}

function renderHeader(state, actions) {
  const header = el('div', 'cx-header');
  const title = el('span', 'cx-title');
  title.append(el('span', 'cx-title-ic', '⊙'), el('span', null, 'Compatibility'));
  const right = el('div', 'sec-head-r');

  if (state.availability === 'scored') {
    const label = state.open ? 'Collapse' : 'Expand';
    const toggle = button('sec-toggle', '', actions.toggleOpen);
    const chevron = el('span', 'sec-chev', '›');
    toggle.setAttribute('aria-expanded', String(state.open));
    toggle.setAttribute('aria-label', state.open ? 'Collapse compatibility analysis' : 'Expand compatibility analysis');
    if (state.open) {
      chevron.style.transform = 'rotate(90deg)';
    }
    chevron.setAttribute('aria-hidden', 'true');
    toggle.append(chevron, document.createTextNode(label));
    right.append(toggle);
  }

  header.append(title, right);
  return header;
}

function renderCollapsed(state) {
  const { application, notesState } = state;
  const score = clampScore(application?.compat);
  const tier = getTier(score);
  const row = el('div', 'cx-collapsed-content');
  const verdict = el('span', 'cx-verdict-text', tier.label);
  verdict.style.color = tier.ink;
  const dash = el('span', 'cx-dash', '—');
  row.append(renderScoreRing(score, 30), verdict, dash);

  if (notesState === 'fresh') {
    row.append(el('span', 'cx-summary', application.compatAnalysis?.summary ?? ''));
  } else if (notesState === 'stale') {
    row.append(el('span', 'cx-update-dot', '● Update available'));
  } else if (notesState === 'generating') {
    row.append(el('span', 'cx-summary cx-summary--generating', 'Writing analysis…'));
  } else if (notesState === 'error') {
    row.append(el('span', 'cx-summary cx-summary--error', "Couldn't write analysis"));
  } else {
    row.append(el('span', 'cx-summary cx-summary--none', 'Notes not generated'));
  }

  return row;
}

function ringSizeFor(root) {
  return root.classList.contains('compact') ? 58 : 64;
}

function renderScoreRow(state) {
  const score = clampScore(state.application?.compat);
  const tier = getTier(score);
  const row = el('div', 'cx-score-row');
  const meta = el('div', 'cx-score-meta');
  const headline = el('div', 'cx-headline', state.application?.compatAnalysis?.summary ?? '');

  if (state.notesState === 'stale') {
    headline.classList.add('stale');
  }

  meta.append(createVerdictPill(tier));
  if (state.application?.compatAnalysis?.summary) {
    meta.append(headline);
  }

  row.append(renderScoreRing(score, ringSizeFor(state.root)), meta);
  return row;
}

function renderNoneState(state, actions) {
  const box = el('div', 'cx-gen-inline');
  const copy = el(
    'span',
    'cx-gen-txt',
    'No written analysis yet. Generate notes to explain this score and surface gaps.',
  );
  box.append(copy);

  if (!hasAiConfigured(state.aiSettings)) {
    copy.textContent = 'No written analysis yet. Turn on AI to generate notes for this score.';
    box.append(createEnableAiLink(actions));
    return box;
  }

  const generate = button('cx-gen-btn', '✦ Generate notes', actions.generate);
  if (!state.application?.id) {
    generate.disabled = true;
    generate.title = 'Save the application first';
  } else if (state.isModalDirty) {
    generate.disabled = true;
    generate.title = 'Save your changes first';
  }
  box.append(generate);
  return box;
}

function renderGeneratingState() {
  const box = el('div', 'cx-skel');
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  box.setAttribute('aria-busy', 'true');
  const header = el('div', 'cx-skel-h');
  const spinner = el('span', 'cx-skel-spin');
  spinner.setAttribute('aria-hidden', 'true');
  header.append(spinner, document.createTextNode('Writing analysis…'));
  box.append(header);

  for (const width of ['96%', '88%', '70%']) {
    const line = el('span', 'cx-skel-line');
    line.style.width = width;
    box.append(line);
  }

  return box;
}

function renderNotesHead() {
  const head = el('div', 'cx-notes-head');
  head.append(el('span', 'cx-notes-h', 'Analysis'), createAiTag());
  return head;
}

function renderFreshLikeState(state, actions) {
  const fragment = document.createDocumentFragment();
  const notes = state.application?.compatAnalysis ?? {};
  const isStale = state.notesState === 'stale';
  const canGenerate = hasAiConfigured(state.aiSettings);

  if (isStale) {
    const stale = el('div', canGenerate ? 'cx-stale-bar' : 'cx-stale-bar cx-stale-bar--readonly');
    if (canGenerate) {
      const refreshBtn = button('cx-stale-btn', '↻ Refresh notes', actions.generate);
      if (state.isModalDirty) {
        refreshBtn.disabled = true;
        refreshBtn.title = 'Save your changes first';
      }
      stale.append(
        el('span', 'cx-stale-ic', '⚠'),
        el(
          'span',
          'cx-stale-txt',
          'Your profile or job data changed after these notes were written. The score above is current — refresh the notes to match.',
        ),
        refreshBtn,
      );
    } else {
      stale.append(
        createLockIcon(),
        el(
          'span',
          'cx-stale-txt',
          "These notes are out of date and can't be refreshed while AI is off. The score above is current.",
        ),
        createEnableAiLink(actions),
      );
    }
    fragment.append(stale);
  }

  fragment.append(renderNotesHead());
  const prose = el('div', [
    'cx-notes',
    'clamp',
    isStale ? 'stale' : '',
    canGenerate ? '' : 'cx-notes--readonly',
  ].filter(Boolean).join(' '));
  renderBoldText(prose, notes.body ?? '');
  const foot = el('div', 'cx-foot');
  const showMore = button('cx-showmore', 'Show more ▾', () => {
    prose.classList.toggle('clamp');
    const clamped = prose.classList.contains('clamp');
    showMore.textContent = clamped ? 'Show more ▾' : 'Show less ▴';
    showMore.setAttribute('aria-expanded', String(!clamped));
  });
  showMore.setAttribute('aria-expanded', 'false');
  const right = el('div', 'cx-foot-r');
  const generated = formatDate(notes.generatedAt);
  right.append(
    el('span', 'cx-meta', generated ? `✦ Generated ${generated}` : '✦ Generated'),
  );
  if (canGenerate) {
    right.append(el('span', 'cx-sep', '·'));
    const regenBtn = button('cx-regen', isStale ? '↻ Refresh' : '↻ Regenerate', actions.generate);
    if (state.isModalDirty) {
      regenBtn.disabled = true;
      regenBtn.title = 'Save your changes first';
    }
    right.append(regenBtn);
  } else if (!isStale) {
    right.append(createEnableAiLink(actions));
  }
  foot.append(showMore, right);
  fragment.append(prose, foot);
  return fragment;
}

function renderErrorState(actions) {
  const box = el('div', 'cx-stale-bar cx-error-bar');
  box.setAttribute('role', 'alert');
  box.append(
    el('span', 'cx-stale-ic', '⚠'),
    el('span', 'cx-stale-txt', "Couldn't write the analysis. The score above is unaffected."),
    button('cx-stale-btn cx-retry-btn', '↻ Try again', actions.generate),
  );
  return box;
}

function renderNotesRegion(state, actions) {
  const region = el('div', 'cx-notes-region');
  if (state.notesState === 'none') {
    region.append(renderNoneState(state, actions));
  } else if (state.notesState === 'generating') {
    region.append(renderGeneratingState());
  } else if (state.notesState === 'fresh' || state.notesState === 'stale') {
    region.append(renderFreshLikeState(state, actions));
  } else if (state.notesState === 'error') {
    region.append(renderErrorState(actions));
  }
  return region;
}

function renderPanel(state, actions) {
  const panel = el('div', 'cx-panel');
  panel.append(renderScoreRow(state), el('div', 'cx-rule'), renderNotesRegion(state, actions));
  return panel;
}

function renderEmptyState(actions) {
  const box = el('div', 'cx-empty');
  const copy = el('div', 'cx-empty-copy');
  copy.append(
    el('div', 'cx-empty-title', 'Compatibility unavailable'),
    el('div', 'cx-empty-sub', 'Add your profile so Alice can score how well you match this role.'),
  );
  const action = el('a', 'cx-empty-act', 'Complete profile →');
  action.href = '#profile';
  action.addEventListener('click', (event) => {
    event.preventDefault();
    actions.openProfile();
  });
  box.append(el('span', 'cx-empty-ic', '♙'), copy, action);
  return box;
}

function renderUnsavedState() {
  const box = el('div', 'cx-empty cx-unsaved');
  const copy = el('div', 'cx-empty-copy');
  copy.append(
    el('div', 'cx-empty-title', 'Scored after you save'),
    el('div', 'cx-empty-sub', 'Create this application and Alice scores it against your profile.'),
  );
  box.append(createSparkleIcon(), copy);
  return box;
}

function createState(options = {}) {
  const application = { ...(options.application ?? {}) };
  const key = applicationKey(application);
  if (_applicationKey !== key) {
    _applicationKey = key;
    _open = false;
    _localState = null;
    _inFlight = false;
    _modalDirty = false;
  }

  return {
    application,
    profile: options.profile,
    aiSettings: options.aiSettings ?? aiSettingsDefault,
    onNotesGenerated: typeof options.onNotesGenerated === 'function'
      ? options.onNotesGenerated
      : () => {},
    onOpenSettings: typeof options.onOpenSettings === 'function'
      ? options.onOpenSettings
      : () => {},
    onOpenProfile: typeof options.onOpenProfile === 'function'
      ? options.onOpenProfile
      : () => {},
    root: el('section', 'compatibility-module'),
    key,
    open: _open,
    localState: _localState,
    inFlight: _inFlight,
    isModalDirty: _modalDirty,
  };
}

function renderInto(state) {
  const availability = !state.application?.id
    ? 'unsaved'
    : isProfileSufficient(state.profile) ? 'scored' : 'no-profile';
  const notesState = deriveNotesState(state.application, state.localState);
  const viewState = { ...state, availability, notesState };
  const actions = {
    toggleOpen: () => {
      _open = !state.open;
      state.open = _open;
      renderInto(state);
    },
    generate: () => generateForState(state),
    openSettings: () => state.onOpenSettings(),
    openProfile: () => state.onOpenProfile(),
  };

  state.root.replaceChildren();
  state.root.append(renderHeader(viewState, actions));

  if (availability === 'unsaved') {
    state.root.append(renderUnsavedState());
  } else if (availability === 'no-profile') {
    state.root.append(renderEmptyState(actions));
  } else if (state.open) {
    state.root.append(renderPanel(viewState, actions));
  } else {
    state.root.append(renderCollapsed(viewState));
  }
}

async function generateForState(state) {
  if (_inFlight || !state.application?.id || !hasAiConfigured(state.aiSettings) || state.isModalDirty) {
    return;
  }

  _inFlight = true;
  _localState = 'generating';
  state.inFlight = _inFlight;
  state.localState = _localState;
  renderInto(state);

  try {
    const generated = await generateNotes(state.application, state.profile, state.aiSettings);
    const savedNotes = await api.saveCompatNotes(state.application.id, generated);
    const compatAnalysis = savedNotes?.data ?? savedNotes;
    state.application = {
      ...state.application,
      compatAnalysis,
    };
    if (_activeState && _activeState.key === state.key) {
      _activeState.application = {
        ..._activeState.application,
        compatAnalysis,
      };
    }
    _localState = null;
    (_activeState?.onNotesGenerated ?? state.onNotesGenerated)(compatAnalysis);
  } catch {
    _localState = 'error';
  } finally {
    _inFlight = false;
    const target = _activeState?.key === state.key ? _activeState : state;
    target.localState = _localState;
    target.inFlight = _inFlight;
    renderInto(target);
  }
}

export function render(options = {}) {
  const state = createState(options);
  _activeState = state;
  state.root.__compatibilityState = state;
  renderInto(state);
  return state.root;
}

export const CompatibilityModule = { render, setDirty };
