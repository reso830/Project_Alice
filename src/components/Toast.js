let _activeToast = null;
let _timer = null;

function dismiss() {
  if (!_activeToast) {
    return;
  }

  const toast = _activeToast;
  _activeToast = null;
  toast.classList.add('toast--out');

  setTimeout(() => {
    toast.remove();
  }, 180);
}

export function show(message, type) {
  if (_activeToast) {
    clearTimeout(_timer);
    _activeToast.remove();
    _activeToast = null;
  }

  const toast = document.createElement('div');
  const dot = document.createElement('span');
  const text = document.createElement('span');

  toast.className = 'toast';
  dot.className = 'toast-dot';
  dot.style.backgroundColor = type === 'success' ? '#22C55E' : '#EF4444';
  text.textContent = message;

  toast.append(dot, text);
  document.body.append(toast);
  _activeToast = toast;
  _timer = setTimeout(dismiss, 2400);
}

export const Toast = { show };
