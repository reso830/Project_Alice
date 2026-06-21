function measureOverflow(valueEl) {
  return valueEl.scrollHeight - valueEl.clientHeight > 2;
}

function updateClampState(valueEl, button, expanded) {
  valueEl.classList.toggle('clamped', !expanded);
  button.textContent = expanded ? 'Show less' : 'Show more';
  button.setAttribute('aria-expanded', String(expanded));
}

export function createClampText(value, { lines = 2, mlines = lines, className = '' } = {}) {
  const wrapper = document.createElement('div');
  const text = document.createElement('div');
  let toggle = null;
  let expanded = false;

  wrapper.className = 'clamp-wrap';
  text.className = ['mfield-val', 'clamp-text', 'clamped', className].filter(Boolean).join(' ');
  text.textContent = value ?? '';
  text.style.setProperty('--lines', String(lines));
  text.style.setProperty('--mlines', String(mlines));

  function ensureToggle() {
    if (toggle) {
      return;
    }

    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'clamp-toggle';
    updateClampState(text, toggle, expanded);
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      updateClampState(text, toggle, expanded);
    });
    wrapper.append(toggle);
  }

  wrapper.append(text);

  queueMicrotask(() => {
    if (measureOverflow(text)) {
      ensureToggle();
    }
  });

  return wrapper;
}
