const SORT_FIELDS = [
  ['id', 'Job ID'],
  ['status', 'Status'],
  ['compat', 'Compatibility'],
  ['salary', 'Salary'],
  ['companyName', 'Company'],
];

const SORT_DIRECTIONS = [
  ['asc', 'Ascending ↑'],
  ['desc', 'Descending ↓'],
];

function createSectionLabel(text) {
  const label = document.createElement('div');

  label.className = 'sort-panel__section-label';
  label.textContent = text;

  return label;
}

function createDivider() {
  const divider = document.createElement('div');

  divider.className = 'sort-panel__divider';

  return divider;
}

function createOptionRow({ label, selected, onClick, className = '' }) {
  const row = document.createElement('button');

  row.className = `sort-panel__option${selected ? ' sort-panel__option--selected' : ''}${className}`;
  row.type = 'button';
  row.textContent = `${selected ? '✓ ' : ''}${label}`;
  row.addEventListener('click', onClick);

  return row;
}

export function render(options = {}) {
  const panel = document.createElement('div');
  const sortState = options.sortState ?? { field: 'id', direction: 'asc' };

  panel.className = 'sort-panel';

  panel.append(createSectionLabel('SORT BY'));

  for (const [field, label] of SORT_FIELDS) {
    panel.append(createOptionRow({
      label,
      selected: sortState.field === field,
      onClick: () => options.onChange?.({ ...sortState, field }),
    }));
  }

  panel.append(createDivider(), createSectionLabel('ORDER'));

  for (const [direction, label] of SORT_DIRECTIONS) {
    panel.append(createOptionRow({
      label,
      selected: sortState.direction === direction,
      onClick: () => options.onChange?.({ ...sortState, direction }),
    }));
  }

  panel.append(
    createDivider(),
    createOptionRow({
      label: 'Restore default',
      selected: false,
      className: ' sort-panel__option--restore',
      onClick: () => options.onRestoreDefault?.(),
    }),
  );

  return panel;
}

export const SortPanel = { render };
