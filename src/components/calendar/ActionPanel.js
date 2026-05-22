let _host = null;

const EMPTY_STATES = {
  today: {
    glyph: '\u25cb',
    headline: 'Quiet day',
    sub: 'Nothing on today. Enjoy the breather.',
  },
  suggestions: {
    glyph: '\u2299',
    headline: "You're caught up",
    sub: "No suggestions right now. We'll surface new ones as activity ages.",
  },
  upcoming: {
    glyph: '\u2014',
    headline: 'Nothing scheduled',
    sub: 'No upcoming timeline events tomorrow through end of week.',
  },
};

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

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayOfWeekIso(date) {
  return (date.getDay() + 6) % 7;
}

function shortDateLabel(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('weekday')} ${part('month')} ${part('day')}`;
}

function upcomingLabel(kind, todayISO) {
  const todayDate = parseISODate(todayISO);
  if (!todayDate) {
    return kind === 'tomorrow' ? 'Tomorrow' : 'Rest of week';
  }

  if (kind === 'tomorrow') {
    return `Tomorrow \u00b7 ${shortDateLabel(addDays(todayDate, 1))}`;
  }

  return `Rest of week \u00b7 thru ${shortDateLabel(addDays(todayDate, 6 - dayOfWeekIso(todayDate)))}`;
}

function createText(className, text, tagName = 'span') {
  const node = document.createElement(tagName);
  node.className = className;
  node.textContent = text;
  return node;
}

function createGreeting(props) {
  const header = document.createElement('header');
  header.className = 'cal-greeting';
  header.append(
    createText('cal-greeting-h', props.greeting ?? '', 'h2'),
    createText('cal-greeting-sub', props.dateLabel ?? '', 'p'),
  );
  return header;
}

function createSectionHeader(label, count, hint = '') {
  const header = document.createElement('div');
  const left = document.createElement('div');
  const labelNode = createText('cal-section__lbl', label);

  header.className = 'cal-section-h';
  left.className = 'cal-section-h__left';
  left.append(labelNode);

  if (count > 0) {
    const countNode = createText('cal-section__count', String(count));
    countNode.setAttribute('aria-label', `${count} item${count === 1 ? '' : 's'} in ${label}`);
    left.append(countNode);
  }

  header.append(left);

  if (hint) {
    header.append(createText('cal-section__hint', hint));
  }

  return header;
}

function createEmptyState(kind) {
  const copy = EMPTY_STATES[kind];
  const empty = document.createElement('div');
  empty.className = 'cal-empty';
  empty.append(
    createText('cal-empty__glyph', copy.glyph),
    createText('cal-empty__h', copy.headline),
    createText('cal-empty__sub', copy.sub),
  );
  return empty;
}

function createIconButton(className, label, text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function createTextButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cal-act-btn';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function createMeta(company, role) {
  const meta = document.createElement('div');
  const companyText = company ?? '';
  const roleText = role ?? '';

  meta.className = 'cal-row__meta';

  if (companyText && roleText) {
    meta.append(
      document.createTextNode(companyText),
      createText('cal-row__sep', '\u00b7'),
      document.createTextNode(roleText),
    );
  } else {
    meta.textContent = companyText || roleText;
  }

  return meta;
}

function createRowBody(title, metaNode) {
  const body = document.createElement('div');
  body.className = 'cal-row__body';
  body.append(createText('cal-row__title', title ?? ''), metaNode);
  return body;
}

function createActivityRow(row, props, options = {}) {
  const wrapper = document.createElement('div');
  const idPill = createText('cal-id-pill', padId(row.id));
  const actions = document.createElement('div');

  wrapper.className = 'cal-row';
  actions.className = 'cal-actions';

  if (options.suggestion) {
    if (row.primary === 'mark_ghosted') {
      actions.append(createTextButton('Mark Ghosted', () => props.onMarkGhosted?.(row.id)));
    } else {
      actions.append(createIconButton(
        'cal-act-icon',
        `Open application ${padId(row.id)}`,
        '\u2197',
        () => props.onOpenApp?.(row.id),
      ));
    }

    actions.append(createIconButton(
      'cal-act-icon danger cal-act-icon--danger',
      `Dismiss suggestion ${padId(row.id)}`,
      '\u00d7',
      () => props.onDismiss?.(row.id, row.kind),
    ));
    wrapper.append(idPill, createRowBody(row.title, createText('cal-row__meta', row.meta ?? '')), actions);
    return wrapper;
  }

  actions.append(createIconButton(
    'cal-act-icon',
    `Open application ${padId(row.id)}`,
    '\u2197',
    () => props.onOpenApp?.(row.id),
  ));
  wrapper.append(idPill, createRowBody(row.title, createMeta(row.company, row.role)), actions);
  return wrapper;
}

function createSection(label, count, kind, children) {
  const section = document.createElement('section');
  section.className = 'cal-section';
  section.append(createSectionHeader(label, count));

  if (count === 0) {
    section.append(createEmptyState(kind));
  } else {
    const rowList = document.createElement('div');
    rowList.className = 'cal-row-list';
    rowList.append(...children);
    section.append(rowList);
  }

  return section;
}

function createFlatRows(rows, props, options) {
  return rows.map((row) => createActivityRow(row, props, options));
}

function createUpcomingGroup(label, rows, props) {
  const group = document.createElement('div');
  const header = document.createElement('div');
  const dash = document.createElement('span');

  group.className = 'upc-group';
  header.className = 'upc-group-h';
  dash.className = 'cal-dash';
  dash.setAttribute('aria-hidden', 'true');
  header.append(createText('cal-section__lbl', label), dash);
  group.append(header);
  group.append(...createFlatRows(rows, props));

  return group;
}

function createUpcomingSection(props, upcoming) {
  const tomorrow = list(upcoming?.tomorrow);
  const restOfWeek = list(upcoming?.restOfWeek);
  const count = tomorrow.length + restOfWeek.length;
  const children = [];

  if (tomorrow.length > 0) {
    children.push(createUpcomingGroup(upcomingLabel('tomorrow', props.todayISO), tomorrow, props));
  }

  if (restOfWeek.length > 0) {
    children.push(createUpcomingGroup(upcomingLabel('restOfWeek', props.todayISO), restOfWeek, props));
  }

  return createSection('Upcoming', count, 'upcoming', children);
}

function render(container, props = {}) {
  destroy();

  _host = container;
  _host.replaceChildren();

  const today = list(props.today);
  const suggestions = list(props.suggestions);
  const upcoming = props.upcoming ?? {};
  const root = document.createElement('div');

  root.className = 'cal-action-panel action-panel';
  root.append(
    createGreeting(props),
    createSection('Today', today.length, 'today', createFlatRows(today, props)),
    createSection('Suggested Actions', suggestions.length, 'suggestions', createFlatRows(suggestions, props, {
      suggestion: true,
    })),
    createUpcomingSection(props, upcoming),
  );

  _host.append(root);
}

function destroy() {
  if (_host) {
    _host.replaceChildren();
  }
  _host = null;
}

export const ActionPanel = { render, destroy };
