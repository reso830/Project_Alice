const MOBILE_BREAKPOINT = 640;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 6;
const BACKDROP_Z_INDEX = 'calc(var(--z-dropdown) - 1)';
const DROPDOWN_Z_INDEX = 'var(--z-dropdown)';

function isBottomSheetMode(asBottomSheet) {
  return asBottomSheet && window.innerWidth < MOBILE_BREAKPOINT;
}

function measure(element) {
  const rect = element.getBoundingClientRect();
  return {
    width: rect.width || element.offsetWidth,
    height: rect.height || element.offsetHeight,
  };
}

function clamp(value, min, max) {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function positionDropdown(anchorEl, wrapper, align) {
  const anchorRect = anchorEl.getBoundingClientRect();
  const dropdown = measure(wrapper);
  let top = anchorRect.bottom + ANCHOR_GAP;
  let left = align === 'end'
    ? anchorRect.right - dropdown.width
    : anchorRect.left;

  left = clamp(left, VIEWPORT_MARGIN, window.innerWidth - dropdown.width - VIEWPORT_MARGIN);

  if (top + dropdown.height > window.innerHeight - VIEWPORT_MARGIN) {
    top = anchorRect.top - dropdown.height - ANCHOR_GAP;
  }

  wrapper.style.position = 'absolute';
  wrapper.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`;
  wrapper.style.left = `${left}px`;
}

function applyBottomSheetStyles(wrapper) {
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0px';
  wrapper.style.right = '0px';
  wrapper.style.bottom = '0px';
  wrapper.style.borderRadius = '14px 14px 0 0';
  wrapper.style.maxHeight = '80vh';
  wrapper.style.animation = 'bsIn .22s cubic-bezier(.2,.7,.3,1.05)';
}

function createBackdrop(scrim, bottomSheet) {
  const backdrop = document.createElement('div');
  backdrop.className = 'cal-dropdown-backdrop';
  backdrop.style.position = 'fixed';
  backdrop.style.inset = '0';
  backdrop.style.background = scrim && bottomSheet ? 'rgba(8,8,24,.42)' : 'transparent';
  backdrop.style.zIndex = BACKDROP_Z_INDEX;
  return backdrop;
}

function createHandle() {
  const handle = document.createElement('div');
  handle.className = 'bs-handle';
  return handle;
}

export function mountAnchoredDropdown({
  anchorEl,
  contentEl,
  align = 'start',
  asBottomSheet = false,
  scrim = false,
  ariaLabel = 'Calendar dialog',
  onClose,
}) {
  const bottomSheet = isBottomSheetMode(asBottomSheet);
  const backdrop = createBackdrop(scrim, bottomSheet);
  const wrapper = document.createElement('div');
  let active = true;

  wrapper.className = bottomSheet ? 'cal-bottom-sheet' : 'cal-dropdown';
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-modal', 'true');
  wrapper.setAttribute('aria-label', ariaLabel);
  wrapper.style.zIndex = DROPDOWN_Z_INDEX;

  if (bottomSheet) {
    wrapper.append(createHandle());
    applyBottomSheetStyles(wrapper);
  }

  wrapper.append(contentEl);
  document.body.append(backdrop, wrapper);

  function cleanupListeners() {
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousedown', handleOutsideMouseDown);
    window.removeEventListener('resize', handleResize);
  }

  function requestClose() {
    if (!active) {
      return;
    }

    active = false;
    cleanupListeners();
    onClose?.();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      requestClose();
    }
  }

  function handleOutsideMouseDown(event) {
    if (!wrapper.contains(event.target)) {
      requestClose();
    }
  }

  function handleResize() {
    if (!bottomSheet) {
      positionDropdown(anchorEl, wrapper, align);
    }
  }

  if (!bottomSheet) {
    positionDropdown(anchorEl, wrapper, align);
  }

  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('mousedown', handleOutsideMouseDown);
  window.addEventListener('resize', handleResize);

  return {
    unmount() {
      active = false;
      cleanupListeners();
      backdrop.remove();
      wrapper.remove();
    },
  };
}
