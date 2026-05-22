import {
  STATUS_CONFIG,
  STATUS_DISPLAY_PRIORITY,
} from '../../models/application.js';
import { mountAnchoredDropdown } from './anchoredDropdown.js';

let _mounted = null;

function list(value) {
  return Array.isArray(value) ? value : [];
}

function padId(id) {
  return `#${String(id).padStart(3, '0')}`;
}

function parseISODate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function prettyDate(value) {
  const date = parseISODate(value);
  if (!date) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function createText(className, text, tagName = 'span') {
  const node = document.createElement(tagName);
  node.className = className;
  node.textContent = text;
  return node;
}

function statusLabel(status) {
  return STATUS_CONFIG[status]?.label ?? status ?? 'Activity';
}

function titleText(props) {
  const prefix = prettyDate(props.date);
  const label = props.mode === 'status'
    ? statusLabel(props.status)
    : 'All activity';
  return `${prefix} \u00b7 ${label} `;
}

function createHeader(props, count) {
  const header = document.createElement('div');
  const title = createText('day-pop__ttl', titleText(props), 'h3');
  const countNode = createText('day-pop__count', `(${count})`);
  const closeButton = document.createElement('button');

  header.className = 'day-pop-h';
  title.append(countNode);
  closeButton.type = 'button';
  closeButton.className = 'day-pop__close';
  closeButton.setAttribute('aria-label', 'Close day popover');
  closeButton.textContent = '\u00d7';
  closeButton.addEventListener('click', () => props.onClose?.());

  header.append(title, closeButton);
  return header;
}

function createMeta(activity) {
  const meta = document.createElement('div');
  const company = activity.company ?? '';
  const role = activity.role ?? activity.jobTitle ?? '';

  meta.className = 'cal-row__meta';

  if (company && role) {
    meta.append(
      document.createTextNode(company),
      createText('cal-row__sep', '\u00b7'),
      document.createTextNode(role),
    );
  } else {
    meta.textContent = company || role;
  }

  return meta;
}

function createBody(activity) {
  const body = document.createElement('div');
  body.className = 'cal-row__body';
  body.append(
    createText('cal-row__title', activity.title ?? activity.jobTitle ?? 'Activity'),
    createMeta(activity),
  );
  return body;
}

function createStatusBadge(status) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.wishlisted;
  const badge = createText('cal-status-badge', config.label);
  badge.style.backgroundColor = config.badgeBg;
  badge.style.color = config.badgeText;
  return badge;
}

function createRow(activity, props) {
  const row = document.createElement('button');
  const lead = props.mode === 'status'
    ? createText('cal-id-pill', padId(activity.id))
    : createStatusBadge(activity.status);
  const arrow = createText('day-row__arrow', '\u2192');

  row.type = 'button';
  row.className = 'day-row';
  row.dataset.status = activity.status ?? '';
  row.addEventListener('click', () => {
    props.onOpenApp?.(activity.id);
    props.onClose?.();
  });

  row.append(lead, createBody(activity), arrow);
  return row;
}

function priorityIndex(status) {
  const index = STATUS_DISPLAY_PRIORITY.indexOf(status);
  return index === -1 ? STATUS_DISPLAY_PRIORITY.length : index;
}

function orderedActivities(props) {
  const activities = list(props.activities);
  if (props.mode !== 'all') {
    return activities;
  }

  return [...activities].sort((a, b) => {
    const byStatus = priorityIndex(a.status) - priorityIndex(b.status);
    if (byStatus !== 0) {
      return byStatus;
    }
    return Number(a.id ?? 0) - Number(b.id ?? 0);
  });
}

function createBodyList(props, activities) {
  const body = document.createElement('div');
  body.className = 'day-pop-body';

  if (activities.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'day-pop-empty';
    empty.textContent = 'No activity for this day';
    body.append(empty);
    return body;
  }

  activities.forEach((activity) => {
    body.append(createRow(activity, props));
  });
  return body;
}

function createFooter() {
  const footer = document.createElement('div');
  footer.className = 'day-pop-foot';
  footer.append(
    createText('day-pop-foot__hint', 'Row click \u2192 opens application'),
    createText('day-pop-foot__link', 'View in Tracker \u2192'),
  );
  return footer;
}

function createPopover(props) {
  const activities = orderedActivities(props);
  const popover = document.createElement('div');
  popover.className = 'day-pop';
  popover.append(
    createHeader(props, activities.length),
    createBodyList(props, activities),
    createFooter(),
  );
  return popover;
}

function open(props) {
  close();

  _mounted = mountAnchoredDropdown({
    anchorEl: props.anchor,
    contentEl: createPopover(props),
    align: 'start',
    asBottomSheet: true,
    scrim: true,
    ariaLabel: 'Day activity',
    onClose: props.onClose,
  });
}

function close() {
  _mounted?.unmount();
  _mounted = null;
}

export const DayPopover = { open, close };
