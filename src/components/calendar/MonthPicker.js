import { mountAnchoredDropdown } from './anchoredDropdown.js';

const MONTH_LABELS = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

let _mounted = null;

function currentYearLocal() {
  return new Date().getFullYear();
}

function currentMonthLocal() {
  return new Date().getMonth();
}

function createHeader(viewYear) {
  const header = document.createElement('div');
  header.className = 'cal-picker-h';

  const year = document.createElement('span');
  year.className = 'cal-picker__yr';
  year.textContent = String(viewYear);

  header.append(year);
  return header;
}

function createMonthButton(monthIndex, props) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cal-picker-item';
  button.textContent = MONTH_LABELS[monthIndex];

  if (props.viewYear === currentYearLocal() && monthIndex === currentMonthLocal()) {
    button.classList.add('cal-picker-item--current');
  }

  if (monthIndex === props.viewMonth) {
    button.classList.add('cal-picker-item--selected');
  }

  button.addEventListener('click', () => {
    props.onSelect?.(monthIndex);
    props.onClose?.();
  });

  return button;
}

function createPicker(props) {
  const picker = document.createElement('div');
  picker.className = 'cal-picker';

  const grid = document.createElement('div');
  grid.className = 'cal-picker-grid';
  MONTH_LABELS.forEach((_, index) => {
    grid.append(createMonthButton(index, props));
  });

  picker.append(createHeader(props.viewYear), grid);
  return picker;
}

function open(props) {
  close();

  _mounted = mountAnchoredDropdown({
    anchorEl: props.anchor,
    contentEl: createPicker(props),
    align: 'start',
    asBottomSheet: true,
    scrim: false,
    ariaLabel: 'Month picker',
    localAnchor: true,
    onClose: props.onClose,
  });
}

function close() {
  _mounted?.unmount();
  _mounted = null;
}

export const MonthPicker = { open, close };
