import {
  STATUS_CONFIG,
  STATUS_DISPLAY_PRIORITY,
} from '../../models/application.js';

let _host = null;
let _root = null;
let _props = {};

function list(value) {
  return Array.isArray(value) ? value : [];
}

function parseISODate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function formatDay(value) {
  const date = parseISODate(value);
  if (!date) {
    return '';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function createText(className, text, tagName = 'span') {
  const node = document.createElement(tagName);
  node.className = className;
  node.textContent = text;
  return node;
}

function createStatusBadge(status) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;
  const badge = createText('cal-status-badge', config.label);
  badge.style.backgroundColor = config.badgeBg;
  badge.style.color = config.badgeText;
  return badge;
}

function createMeta(activity) {
  const meta = document.createElement('span');
  const company = String(activity.company ?? '').trim();
  const jobTitle = String(activity.jobTitle ?? activity.role ?? '').trim();

  meta.className = 'cal-dp-row__meta';

  if (company) {
    meta.append(createText('cal-dp-row__meta-text', company));
  }

  if (company && jobTitle) {
    meta.append(createText('cal-dp-row__sep', '\u00b7'));
  }

  if (jobTitle) {
    meta.append(createText('cal-dp-row__meta-text', jobTitle));
  }

  return meta;
}

function groupedActivities(activities) {
  const byStatus = new Map();

  for (const activity of activities) {
    if (!byStatus.has(activity.status)) {
      byStatus.set(activity.status, []);
    }
    byStatus.get(activity.status).push(activity);
  }

  return STATUS_DISPLAY_PRIORITY
    .filter((status) => byStatus.has(status))
    .map((status) => ({ status, activities: byStatus.get(status) }));
}

function createHeader(props, count) {
  const header = document.createElement('div');
  const left = document.createElement('div');
  const date = createText('cal-dp-date', formatDay(props.selectedDate), 'h3');
  const countNode = createText('cal-dp-count', count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'No events');

  header.className = 'cal-dp-header';
  left.className = 'cal-dp-header__left';
  left.append(date);

  if (props.selectedDate === props.todayISO) {
    left.append(createText('cal-dp-today-pill', 'Today'));
  }

  header.append(left, countNode);
  return header;
}

function createPrompt() {
  const prompt = document.createElement('div');
  prompt.className = 'cal-dp-prompt';
  prompt.append(
    createText('cal-dp-prompt-glyph', '\u25cc'),
    createText('cal-dp-prompt-h', 'Select a day', 'h3'),
    createText('cal-dp-prompt-sub', 'Pick any date in the month grid to review its activity here.', 'p'),
  );
  return prompt;
}

function createEmpty() {
  const empty = document.createElement('div');
  empty.className = 'cal-dp-empty';
  empty.append(createText('cal-dp-empty-h', 'No events', 'h3'));
  return empty;
}

function createRow(activity, props) {
  const row = document.createElement('div');
  const body = document.createElement('div');

  row.className = 'cal-dp-row cal-dp-row--simple';
  row.setAttribute('role', 'button');
  row.tabIndex = 0;
  body.className = 'cal-dp-row__body';
  body.append(
    createText('cal-dp-row__job', activity.title ?? 'Activity'),
    createMeta(activity),
  );
  row.append(body, createText('cal-dp-row__arrow', '\u2192'));

  function activate(event) {
    if (event?.type === 'keydown') {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
      }
    }
    props.onOpenApp?.(activity.id);
  }

  row.addEventListener('click', activate);
  row.addEventListener('keydown', activate);
  return row;
}

function createGroup(group, props) {
  const wrapper = document.createElement('div');
  const header = document.createElement('div');

  wrapper.className = 'cal-dp-group';
  header.className = 'cal-dp-group-h';
  header.append(
    createStatusBadge(group.status),
    createText('cal-dp-group-count', `(${group.activities.length})`),
  );
  wrapper.append(header, ...group.activities.map((activity) => createRow(activity, props)));
  return wrapper;
}

function renderBody() {
  if (!_root) {
    return;
  }

  const selectedDate = _props.selectedDate ?? null;
  const activities = list(_props.activities);

  _root.className = 'cal-day-panel';
  _root.replaceChildren();

  if (!selectedDate) {
    _root.classList.add('cal-day-panel--prompt');
    _root.append(createPrompt());
    return;
  }

  _root.append(createHeader(_props, activities.length));

  if (activities.length === 0) {
    _root.classList.add('cal-day-panel--empty');
    _root.append(createEmpty());
    return;
  }

  const body = document.createElement('div');
  body.className = 'cal-dp-body';
  body.append(...groupedActivities(activities).map((group) => createGroup(group, _props)));
  _root.classList.add('cal-day-panel--populated');
  _root.append(body);
}

function render(container, props = {}) {
  destroy();

  _host = container;
  _props = { ...props };
  _root = document.createElement('section');
  _root.className = 'cal-day-panel';
  _root.setAttribute('aria-live', 'polite');
  _host.append(_root);
  renderBody();
}

function update(props = {}) {
  _props = { ..._props, ...props };
  renderBody();
}

function destroy() {
  _root?.remove();
  _root = null;
  _host = null;
  _props = {};
}

export const DayPanel = { render, update, destroy };
