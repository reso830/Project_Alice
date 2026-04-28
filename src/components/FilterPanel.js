function getOptionLabel(value, getLabel) {
  return typeof getLabel === 'function' ? getLabel(value) : value;
}

function getOptionDot(value, getDot) {
  return typeof getDot === 'function' ? getDot(value) : null;
}

function toggleSelection(selected, value) {
  if (selected.includes(value)) {
    return selected.filter((current) => current !== value);
  }

  return [...selected, value];
}

function createOptionRow(value, selected, options) {
  const isSelected = selected.includes(value);
  const row = document.createElement('div');
  const checkbox = document.createElement('span');
  const dotColor = getOptionDot(value, options.getDot);
  const label = document.createElement('span');

  row.className = 'filter-panel__option';
  row.tabIndex = 0;
  row.dataset.value = value;
  row.setAttribute('role', 'checkbox');
  row.setAttribute('aria-checked', String(isSelected));

  checkbox.className = 'filter-panel__checkbox';
  checkbox.setAttribute('aria-hidden', 'true');

  if (isSelected) {
    checkbox.classList.add('filter-panel__checkbox--checked');
  }

  if (dotColor) {
    const dot = document.createElement('span');
    dot.className = 'filter-panel__dot';
    dot.style.backgroundColor = dotColor;
    row.append(dot);
  }

  label.className = 'filter-panel__option-label';
  label.textContent = getOptionLabel(value, options.getLabel);

  function commitToggle() {
    options.onChange?.(toggleSelection(selected, value));
  }

  row.addEventListener('click', commitToggle);
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitToggle();
    }
  });

  row.prepend(checkbox);
  row.append(label);

  return row;
}

export function render(options = {}) {
  const panel = document.createElement('div');
  const header = document.createElement('div');
  const title = document.createElement('span');
  const clearButton = document.createElement('button');
  const separator = document.createElement('div');
  const list = document.createElement('div');
  const selected = Array.isArray(options.selected) ? options.selected : [];

  panel.className = 'filter-panel';

  header.className = 'filter-panel__header';
  title.className = 'filter-panel__title';
  title.textContent = options.title ?? 'Filter';

  clearButton.className = 'filter-panel__clear';
  clearButton.type = 'button';
  clearButton.textContent = 'x';
  clearButton.setAttribute('aria-label', `Clear ${title.textContent.toLowerCase()} filter`);
  clearButton.addEventListener('click', () => options.onClear?.());

  separator.className = 'filter-panel__separator';
  list.className = 'filter-panel__list';

  for (const value of options.options ?? []) {
    list.append(createOptionRow(value, selected, options));
  }

  header.append(title, clearButton);
  panel.append(header, separator, list);

  return panel;
}

export const FilterPanel = { render };
