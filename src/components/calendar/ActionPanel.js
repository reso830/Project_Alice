const BODY_ID = 'cal-action-panel-body';

let _host = null;
let _props = {};
let _collapsed = true;
let _isStacked = false;

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
  return String(id).padStart(3, '0');
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

function isStackedViewport() {
  return window.innerWidth < 1200;
}

function entryLabel(count) {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}

function actionCounts(today, suggestions, upcoming) {
  return {
    today: today.length,
    suggestions: suggestions.length,
    upcoming: list(upcoming?.tomorrow).length + list(upcoming?.restOfWeek).length,
  };
}

function allCountsEmpty(counts) {
  return counts.today === 0 && counts.suggestions === 0 && counts.upcoming === 0;
}

function setExpanded(root, summary, expanded, options = {}) {
  _collapsed = !expanded;
  root.classList.toggle('cal-action-panel--expanded', expanded);
  summary?.classList.toggle('is-collapsed', !expanded);
  summary?.setAttribute('aria-expanded', String(expanded));

  if (options.render) {
    renderIntoHost();
  }
}

function toggleExpanded(root, summary) {
  setExpanded(root, summary, _collapsed, { render: true });
}

function handleToggleKeydown(event, root, summary) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  toggleExpanded(root, summary);
}

function createChevron() {
  const chev = createText('ap-chev', '\u25be');
  chev.setAttribute('aria-hidden', 'true');
  return chev;
}

function createGreetingNodes(props) {
  const heading = createText('cal-greeting-h', props.greeting ?? '', 'h2');
  heading.id = 'action-panel-heading';
  return [heading, createText('cal-greeting-sub', props.dateLabel ?? '', 'p')];
}

function createGreetingBlock(props) {
  const block = document.createElement('div');
  block.className = 'ap-greeting-block';
  block.append(...createGreetingNodes(props));
  return block;
}

function createGreetingButton(root, bodyId, props) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = _collapsed ? 'ap-greeting-btn is-collapsed' : 'ap-greeting-btn';
  button.setAttribute('aria-expanded', String(!_collapsed));
  button.setAttribute('aria-controls', bodyId);
  button.append(createGreetingBlock(props), createChevron());
  button.addEventListener('click', () => toggleExpanded(root, button));
  button.addEventListener('keydown', (event) => handleToggleKeydown(event, root, button));

  return button;
}

function createActionChip(root, label, count, modifier) {
  const chip = document.createElement('button');
  const dot = createText('dot', '');
  const labelNode = createText('lbl', label);
  const countNode = createText('n', String(count));

  chip.type = 'button';
  chip.className = `ap-chip ${modifier}`;
  chip.setAttribute('aria-label', `Expand panel \u2014 ${label}, ${entryLabel(count)}`);
  dot.setAttribute('aria-hidden', 'true');
  labelNode.setAttribute('aria-hidden', 'true');
  countNode.setAttribute('aria-hidden', 'true');
  chip.append(dot, labelNode, countNode);
  chip.addEventListener('click', () => setExpanded(root, root.querySelector('.ap-greeting-btn'), true, { render: true }));
  chip.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    setExpanded(root, root.querySelector('.ap-greeting-btn'), true, { render: true });
  });

  return chip;
}

function createCollapsedPreview(root, counts) {
  if (allCountsEmpty(counts)) {
    return createText('ap-caughtup', "You're all caught up!", 'p');
  }

  const chips = document.createElement('div');
  chips.className = 'ap-chips';

  if (counts.today > 0) {
    chips.append(createActionChip(root, 'Today', counts.today, 'today'));
  }

  if (counts.suggestions > 0) {
    chips.append(createActionChip(root, 'Suggested', counts.suggestions, 'suggest'));
  }

  if (counts.upcoming > 0) {
    chips.append(createActionChip(root, 'Upcoming', counts.upcoming, 'upcoming'));
  }

  return chips;
}

function createCollapseRow(root) {
  const row = document.createElement('div');
  const chip = document.createElement('button');

  row.className = 'ap-collapse-row';
  chip.type = 'button';
  chip.className = 'ap-collapse-chip';
  chip.textContent = '\u2303 Collapse';
  chip.addEventListener('click', () => setExpanded(root, root.querySelector('.ap-greeting-btn'), false, { render: true }));
  chip.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    setExpanded(root, root.querySelector('.ap-greeting-btn'), false, { render: true });
  });
  row.append(chip);
  return row;
}

function createGreeting(props) {
  const header = document.createElement('header');
  header.className = 'cal-greeting';
  header.append(...createGreetingNodes(props));
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
      'cal-act-icon cal-act-icon--danger',
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

  group.className = 'upc-group';
  header.className = 'upc-group-h';
  header.append(createText('cal-section__lbl', label));
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

function appendSections(body, props, today, suggestions, upcoming) {
  body.append(
    createSection('Today', today.length, 'today', createFlatRows(today, props)),
    createSection('Suggested Actions', suggestions.length, 'suggestions', createFlatRows(suggestions, props, {
      suggestion: true,
    })),
    createUpcomingSection(props, upcoming),
  );
}

function createPanelRoot() {
  const root = document.createElement('div');
  root.className = _isStacked && !_collapsed
    ? 'cal-action-panel action-panel cal-action-panel--expanded'
    : 'cal-action-panel action-panel';
  root.setAttribute('aria-labelledby', 'action-panel-heading');
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !root.classList.contains('cal-action-panel--expanded')) {
      return;
    }

    const button = root.querySelector('.ap-greeting-btn');
    setExpanded(root, button, false, { render: true });
    document.querySelector('.ap-greeting-btn')?.focus();
  });
  return root;
}

function renderNonStacked(root, props, today, suggestions, upcoming) {
  root.append(createGreeting(props));
  appendSections(root, props, today, suggestions, upcoming);
}

function renderStacked(root, props, today, suggestions, upcoming, counts) {
  const body = document.createElement('div');
  body.className = 'cal-action-panel__body';
  body.id = BODY_ID;

  root.append(createGreetingButton(root, BODY_ID, props));

  if (_collapsed) {
    root.append(createCollapsedPreview(root, counts));
    body.hidden = true;
  } else {
    appendSections(body, props, today, suggestions, upcoming);
    body.append(createCollapseRow(root));
  }

  root.append(body);
}

function renderIntoHost() {
  if (!_host) {
    return;
  }

  _host.replaceChildren();

  const today = list(_props.today);
  const suggestions = list(_props.suggestions);
  const upcoming = _props.upcoming ?? {};
  const counts = actionCounts(today, suggestions, upcoming);
  const root = createPanelRoot();

  if (_isStacked) {
    renderStacked(root, _props, today, suggestions, upcoming, counts);
  } else {
    renderNonStacked(root, _props, today, suggestions, upcoming);
  }

  _host.append(root);
}

function handleResize() {
  const nextStacked = isStackedViewport();
  if (nextStacked === _isStacked) {
    return;
  }

  _isStacked = nextStacked;
  if (_isStacked) {
    _collapsed = true;
  }
  renderIntoHost();
}

function render(container, props = {}) {
  destroy();

  _host = container;
  _props = { ...props };
  _collapsed = true;
  _isStacked = isStackedViewport();
  window.addEventListener('resize', handleResize);
  renderIntoHost();
}

function destroy() {
  window.removeEventListener('resize', handleResize);
  if (_host) {
    _host.replaceChildren();
  }
  _host = null;
  _props = {};
  _collapsed = true;
  _isStacked = false;
}

export const ActionPanel = { render, destroy };
