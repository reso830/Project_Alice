import { getPaginationModel } from '../utils/pagination.js';

function createPageButton(page, currentPage, onPageChange) {
  const button = document.createElement('button');
  const isActive = page === currentPage;

  button.className = isActive ? 'pagination__btn pagination__btn--active' : 'pagination__btn';
  button.type = 'button';
  button.textContent = String(page);
  button.setAttribute('aria-label', isActive ? `Current page, page ${page}` : `Go to page ${page}`);

  if (isActive) {
    button.setAttribute('aria-current', 'page');
  }

  button.addEventListener('click', () => onPageChange(page));

  return button;
}

function createEllipsis() {
  const ellipsis = document.createElement('span');

  ellipsis.className = 'pagination__ellipsis';
  ellipsis.setAttribute('aria-hidden', 'true');
  ellipsis.textContent = '\u00b7\u00b7\u00b7';

  return ellipsis;
}

export function render(currentPage, totalEntries, onPageChange) {
  const model = getPaginationModel(currentPage, totalEntries);

  if (!model.hasPagination) {
    return null;
  }

  const wrapper = document.createElement('div');
  const rule = document.createElement('hr');
  const nav = document.createElement('nav');

  wrapper.className = 'pagination';
  rule.className = 'pagination__rule';
  nav.className = 'pagination__nav';
  nav.setAttribute('aria-label', 'Pagination');

  for (const item of model.pagesToRender) {
    nav.append(item === 'ellipsis' ? createEllipsis() : createPageButton(item, currentPage, onPageChange));
  }

  wrapper.append(rule, nav);

  return wrapper;
}

export const Pagination = { render };
