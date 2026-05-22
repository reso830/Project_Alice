import { YEAR_MAX, YEAR_MIN } from '../../utils/calendar.js';
import { mountAnchoredDropdown } from './anchoredDropdown.js';

let _mounted = null;

function clamp(value, min, max) {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function currentYearLocal() {
  return new Date().getFullYear();
}

function initialStart(viewYear) {
  return clamp(viewYear - 5, YEAR_MIN, YEAR_MAX - 11);
}

function createNavButton(label, text, disabled, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cal-picker-nav';
  button.setAttribute('aria-label', label);
  button.textContent = text;
  button.disabled = disabled;
  button.addEventListener('click', () => {
    if (!button.disabled) {
      onClick();
    }
  });
  return button;
}

function renderPicker(picker, props, start) {
  picker.replaceChildren();

  const header = document.createElement('div');
  header.className = 'cal-picker-h';

  const label = document.createElement('span');
  label.className = 'cal-picker__lbl';
  label.textContent = 'Jump to year';

  const nav = document.createElement('div');
  nav.className = 'cal-picker__yr-nav';

  const prev = createNavButton('Previous year range', '<', start <= YEAR_MIN, () => {
    renderPicker(picker, props, clamp(start - 12, YEAR_MIN, YEAR_MAX - 11));
  });
  const range = document.createElement('span');
  range.textContent = `${start} - ${start + 11}`;
  const next = createNavButton('Next year range', '>', start + 12 > YEAR_MAX, () => {
    renderPicker(picker, props, clamp(start + 12, YEAR_MIN, YEAR_MAX - 11));
  });

  nav.append(prev, range, next);
  header.append(label, nav);

  const grid = document.createElement('div');
  grid.className = 'cal-picker-grid';

  for (let offset = 0; offset < 12; offset += 1) {
    const year = start + offset;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cal-picker-item';
    button.textContent = String(year);

    if (year === currentYearLocal()) {
      button.classList.add('cal-picker-item--current');
    }

    if (year === props.viewYear) {
      button.classList.add('cal-picker-item--selected');
    }

    if (year < YEAR_MIN || year > YEAR_MAX) {
      button.classList.add('cal-picker-item--disabled');
      button.disabled = true;
    } else {
      button.addEventListener('click', () => {
        props.onSelect?.(year);
        props.onClose?.();
      });
    }

    grid.append(button);
  }

  picker.append(header, grid);
}

function createPicker(props) {
  const picker = document.createElement('div');
  picker.className = 'cal-picker';
  renderPicker(picker, props, initialStart(props.viewYear));
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
    ariaLabel: 'Year picker',
    onClose: props.onClose,
  });
}

function close() {
  _mounted?.unmount();
  _mounted = null;
}

export const YearPicker = { open, close };
