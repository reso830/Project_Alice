const pages = [
  { id: 'tracker', label: 'Tracker' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'profile', label: 'Profile' },
];

let _root = null;

export function setActive(page) {
  if (!_root) {
    return;
  }

  for (const button of _root.querySelectorAll('.nav-btn')) {
    button.classList.toggle('nav-btn--active', button.dataset.page === page);
  }
}

export function render(activePage) {
  const navbar = document.createElement('header');
  const logo = document.createElement('div');
  const logoMark = document.createElement('div');
  const logoText = document.createElement('span');
  const navActions = document.createElement('nav');

  navbar.className = 'navbar';
  logo.className = 'navbar__logo';
  logoMark.className = 'navbar__logo-mark';
  logoText.className = 'navbar__logo-text';
  logoText.textContent = 'Project Alice';
  navActions.className = 'navbar__actions';
  navActions.setAttribute('aria-label', 'Primary navigation');

  for (const page of pages) {
    const button = document.createElement('button');
    button.className = 'nav-btn';
    button.type = 'button';
    button.dataset.page = page.id;
    button.textContent = page.label;
    navActions.append(button);
  }

  logo.append(logoMark, logoText);
  navbar.append(logo, navActions);
  _root = navbar;
  setActive(activePage);

  return navbar;
}

export const Navbar = { render, setActive };
