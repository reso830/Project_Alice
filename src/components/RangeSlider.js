function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPercent(value, min, max) {
  if (max === min) {
    return 0;
  }

  return ((value - min) / (max - min)) * 100;
}

function getPointerClientX(event) {
  return event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX ?? event.clientX;
}

function snapValue(value, step) {
  return Math.round(value / step) * step;
}

function formatWithFallback(value, formatValue) {
  return typeof formatValue === 'function' ? formatValue(value) : String(value);
}

function enforceSpacing(valueMin, valueMax, options, activeThumb) {
  const min = options.min;
  const max = options.max;
  const step = options.step;
  let nextMin = clamp(valueMin, min, max);
  let nextMax = clamp(valueMax, min, max);

  if (nextMin >= nextMax) {
    if (activeThumb === 'min') {
      nextMin = clamp(nextMax - step, min, max);
    } else {
      nextMax = clamp(nextMin + step, min, max);
    }
  }

  return { min: nextMin, max: nextMax };
}

export function render(options) {
  const container = document.createElement('div');
  const values = document.createElement('div');
  const minValue = document.createElement('span');
  const maxValue = document.createElement('span');
  const track = document.createElement('div');
  const fill = document.createElement('div');
  const minThumb = document.createElement('div');
  const maxThumb = document.createElement('div');
  const bounds = document.createElement('div');
  const minBound = document.createElement('span');
  const maxBound = document.createElement('span');
  let localMin = options.valueMin;
  let localMax = options.valueMax;
  let activeThumb = null;

  container.className = 'range-slider';
  values.className = 'range-values';
  minValue.className = 'range-value range-value--min';
  maxValue.className = 'range-value range-value--max';
  track.className = 'range-track';
  fill.className = 'range-fill';
  minThumb.className = 'range-thumb range-thumb--min';
  maxThumb.className = 'range-thumb range-thumb--max';
  bounds.className = 'range-bounds';
  minBound.textContent = formatWithFallback(options.min, options.formatValue);
  maxBound.textContent = formatWithFallback(options.max, options.formatValue);

  function updateAria() {
    minThumb.setAttribute('aria-valuenow', String(localMin));
    maxThumb.setAttribute('aria-valuenow', String(localMax));
  }

  function updatePositions() {
    const minPercent = getPercent(localMin, options.min, options.max);
    const maxPercent = getPercent(localMax, options.min, options.max);

    minThumb.style.left = `${minPercent}%`;
    maxThumb.style.left = `${maxPercent}%`;
    minValue.style.left = `${minPercent}%`;
    maxValue.style.left = `${maxPercent}%`;
    minValue.textContent = formatWithFallback(localMin, options.formatValue);
    maxValue.textContent = formatWithFallback(localMax, options.formatValue);
    fill.style.left = `${minPercent}%`;
    fill.style.width = `${maxPercent - minPercent}%`;
    updateAria();
  }

  function setActiveThumb(nextThumb) {
    activeThumb = nextThumb;
    minThumb.style.zIndex = nextThumb === 'min' ? '4' : '2';
    maxThumb.style.zIndex = nextThumb === 'max' ? '4' : '2';
    minThumb.classList.toggle('range-thumb--active', nextThumb === 'min');
    maxThumb.classList.toggle('range-thumb--active', nextThumb === 'max');
  }

  function clearActiveThumb() {
    activeThumb = null;
    minThumb.style.zIndex = '2';
    maxThumb.style.zIndex = '2';
    minThumb.classList.remove('range-thumb--active');
    maxThumb.classList.remove('range-thumb--active');
  }

  function getValueFromPointer(event) {
    const rect = track.getBoundingClientRect();
    const ratio = rect.width === 0 ? 0 : (getPointerClientX(event) - rect.left) / rect.width;

    return clamp(options.min + ratio * (options.max - options.min), options.min, options.max);
  }

  function moveActiveThumb(event) {
    if (!activeThumb) {
      return;
    }

    const pointerValue = getValueFromPointer(event);

    if (activeThumb === 'min') {
      localMin = clamp(pointerValue, options.min, localMax - options.step);
    } else {
      localMax = clamp(pointerValue, localMin + options.step, options.max);
    }

    updatePositions();
  }

  function detachDragListeners() {
    document.removeEventListener('mousemove', moveActiveThumb);
    document.removeEventListener('touchmove', moveActiveThumb);
    document.removeEventListener('mouseup', commitDrag);
    document.removeEventListener('touchend', commitDrag);
  }

  function commitDrag() {
    if (!activeThumb) {
      return;
    }

    const snapped = enforceSpacing(
      snapValue(localMin, options.step),
      snapValue(localMax, options.step),
      options,
      activeThumb,
    );

    localMin = snapped.min;
    localMax = snapped.max;
    updatePositions();
    options.onCommit?.(localMin, localMax);
    detachDragListeners();
    clearActiveThumb();
  }

  function startDrag(event, thumb) {
    event.preventDefault();
    setActiveThumb(thumb);
    document.addEventListener('mousemove', moveActiveThumb);
    document.addEventListener('touchmove', moveActiveThumb);
    document.addEventListener('mouseup', commitDrag);
    document.addEventListener('touchend', commitDrag);
  }

  function handleKeydown(event, thumb) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }

    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? options.step : -options.step;
    const next = thumb === 'min'
      ? enforceSpacing(localMin + delta, localMax, options, 'min')
      : enforceSpacing(localMin, localMax + delta, options, 'max');

    localMin = next.min;
    localMax = next.max;
    updatePositions();
    options.onCommit?.(localMin, localMax);
  }

  for (const [thumb, label, value] of [
    [minThumb, options.ariaLabelMin, localMin],
    [maxThumb, options.ariaLabelMax, localMax],
  ]) {
    thumb.tabIndex = 0;
    thumb.setAttribute('role', 'slider');
    thumb.setAttribute('aria-valuemin', String(options.min));
    thumb.setAttribute('aria-valuemax', String(options.max));
    thumb.setAttribute('aria-valuenow', String(value));
    thumb.setAttribute('aria-label', label);
    thumb.style.zIndex = '2';
  }

  minThumb.addEventListener('mousedown', (event) => startDrag(event, 'min'));
  maxThumb.addEventListener('mousedown', (event) => startDrag(event, 'max'));
  minThumb.addEventListener('touchstart', (event) => startDrag(event, 'min'));
  maxThumb.addEventListener('touchstart', (event) => startDrag(event, 'max'));
  minThumb.addEventListener('keydown', (event) => handleKeydown(event, 'min'));
  maxThumb.addEventListener('keydown', (event) => handleKeydown(event, 'max'));

  values.append(minValue, maxValue);
  track.append(fill, minThumb, maxThumb);
  bounds.append(minBound, maxBound);
  container.append(values, track, bounds);
  updatePositions();

  return container;
}

export const RangeSlider = { render };
