function appendNode(parent, node) {
  if (node == null) {
    return;
  }

  if (Array.isArray(node)) {
    parent.append(...node.filter(Boolean));
    return;
  }

  parent.append(node);
}

function createIcon(icon) {
  const frame = document.createElement('span');
  frame.className = 'panel-ic';
  frame.setAttribute('aria-hidden', 'true');

  if (icon && typeof icon.nodeType === 'number') {
    frame.append(icon);
  } else if (typeof icon === 'string') {
    frame.textContent = icon;
  }

  return frame;
}

function handleToggleKey(event, onToggle) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onToggle?.();
}

export function OPanel({
  icon,
  title,
  tone,
  open = false,
  onToggle,
  preview,
  children,
} = {}) {
  const section = document.createElement('section');
  const header = document.createElement('div');
  const left = document.createElement('div');
  const panelTitle = document.createElement('span');
  const right = document.createElement('div');
  const toggle = document.createElement('span');
  const chevron = document.createElement('span');
  const body = document.createElement('div');

  section.className = [
    'panel',
    'panel--elevated',
    tone === 'ai' ? 'panel-ai' : '',
  ].filter(Boolean).join(' ');

  header.className = 'panel-head clickable';
  header.setAttribute('role', 'button');
  header.tabIndex = 0;
  header.setAttribute('aria-expanded', String(Boolean(open)));
  header.addEventListener('click', () => onToggle?.());
  header.addEventListener('keydown', (event) => handleToggleKey(event, onToggle));

  left.className = 'panel-head-l';
  panelTitle.className = 'panel-title';
  panelTitle.textContent = title ?? '';
  left.append(createIcon(icon), panelTitle);

  right.className = 'panel-head-r';
  toggle.className = 'sec-toggle';
  toggle.tabIndex = -1;
  toggle.setAttribute('aria-hidden', 'true');
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    onToggle?.();
  });

  chevron.className = open ? 'sec-chev open' : 'sec-chev';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';
  toggle.append(chevron, document.createTextNode(open ? 'Collapse' : 'Expand'));
  right.append(toggle);

  header.append(left, right);

  body.className = 'panel-body';
  appendNode(body, open ? children : preview);

  section.append(header, body);
  return section;
}
