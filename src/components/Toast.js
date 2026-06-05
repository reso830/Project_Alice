let _activeToast = null;
let _timer = null;
const TOAST_DOT_COLORS = {
  success: '#22C55E',
  info: '#F59E0B',
  failure: '#EF4444',
  error: '#EF4444',
};

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
  dot.style.backgroundColor = TOAST_DOT_COLORS[type] ?? TOAST_DOT_COLORS.error;
  text.textContent = message;

  toast.append(dot, text);
  document.body.append(toast);
  _activeToast = toast;
  _timer = setTimeout(dismiss, 2400);
}

export const Toast = { show };
