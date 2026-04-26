// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from '../../src/components/Pagination.js';

describe('Pagination', () => {
  it('renders nothing when pagination is not needed', () => {
    expect(Pagination.render(1, 10, vi.fn())).toBeNull();
  });

  it('renders a wrapper when pagination is needed', () => {
    const pagination = Pagination.render(1, 11, vi.fn());

    expect(pagination?.tagName).toBe('DIV');
    expect(pagination?.className).toBe('pagination');
  });

  it('marks the active page for assistive technology', () => {
    const pagination = Pagination.render(2, 25, vi.fn());
    const activeButton = pagination.querySelector('.pagination__btn--active');

    expect(activeButton).not.toBeNull();
    expect(activeButton.getAttribute('aria-current')).toBe('page');
    expect(activeButton.getAttribute('aria-label')).toBe('Current page, page 2');
  });

  it('renders ellipsis as a non-interactive hidden span', () => {
    const onPageChange = vi.fn();
    const pagination = Pagination.render(5, 100, onPageChange);
    const ellipsis = pagination.querySelector('.pagination__ellipsis');

    expect(ellipsis).not.toBeNull();
    expect(ellipsis.tagName).toBe('SPAN');
    expect(ellipsis.getAttribute('aria-hidden')).toBe('true');

    ellipsis.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('calls onPageChange with the selected page number', () => {
    const onPageChange = vi.fn();
    const pagination = Pagination.render(1, 25, onPageChange);
    const pageTwo = [...pagination.querySelectorAll('.pagination__btn')].find(
      (button) => button.textContent === '2',
    );

    pageTwo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(onPageChange).toHaveBeenCalledOnce();
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
