import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, getPaginationModel } from '../../src/utils/pagination.js';

describe('getPaginationModel', () => {
  const tenPageTotal = PAGE_SIZE * 10;

  it.each([
    [1, [1, 2, 3, 'ellipsis', 10]],
    [2, [1, 2, 3, 'ellipsis', 10]],
    [3, [1, 2, 3, 4, 'ellipsis', 10]],
    [4, [1, 'ellipsis', 3, 4, 5, 'ellipsis', 10]],
    [5, [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]],
    [9, [1, 'ellipsis', 8, 9, 10]],
    [10, [1, 'ellipsis', 8, 9, 10]],
  ])('renders the expected window for page %i of 10', (currentPage, pagesToRender) => {
    expect(getPaginationModel(currentPage, tenPageTotal)).toMatchObject({
      pagesToRender,
      totalPages: 10,
      hasPagination: true,
    });
  });

  it('hides pagination when total entries equals one page', () => {
    expect(getPaginationModel(1, PAGE_SIZE)).toMatchObject({
      pagesToRender: [],
      totalPages: 1,
      hasPagination: false,
    });
  });

  it.each([
    [1, [1, 2]],
    [2, [1, 2]],
  ])('renders both pages for 11 entries on page %i', (currentPage, pagesToRender) => {
    expect(getPaginationModel(currentPage, PAGE_SIZE + 1)).toMatchObject({
      pagesToRender,
      totalPages: 2,
      hasPagination: true,
    });
  });

  it('renders three pages without ellipsis when total pages is 3', () => {
    expect(getPaginationModel(2, PAGE_SIZE * 3)).toMatchObject({
      pagesToRender: [1, 2, 3],
      totalPages: 3,
      hasPagination: true,
    });
  });

  it.each([
    [0, [1, 2, 3, 'ellipsis', 10]],
    [11, [1, 'ellipsis', 8, 9, 10]],
  ])('clamps current page %i without rendering non-existent pages', (currentPage, pagesToRender) => {
    expect(getPaginationModel(currentPage, tenPageTotal)).toMatchObject({
      pagesToRender,
      totalPages: 10,
      hasPagination: true,
    });
  });
});
