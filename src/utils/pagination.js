export const PAGE_SIZE = 10;

export function getPaginationModel(currentPage, totalEntries, pageSize = PAGE_SIZE) {
  const totalPages = Math.ceil(totalEntries / pageSize);
  const hasPagination = totalEntries > pageSize;

  if (!hasPagination) {
    return {
      pagesToRender: [],
      totalPages,
      hasPagination,
    };
  }

  const clampedPage = Math.max(1, Math.min(currentPage, totalPages));
  const winStart = Math.max(1, Math.min(clampedPage - 1, totalPages - 2));
  const winEnd = winStart + 2;
  const pagesToRender = [];

  if (winStart > 1) {
    pagesToRender.push(1);
  }

  if (winStart > 2) {
    pagesToRender.push('ellipsis');
  }

  for (let page = winStart; page <= Math.min(winEnd, totalPages); page += 1) {
    pagesToRender.push(page);
  }

  if (winEnd < totalPages - 1) {
    pagesToRender.push('ellipsis');
  }

  if (winEnd < totalPages) {
    pagesToRender.push(totalPages);
  }

  return {
    pagesToRender,
    totalPages,
    hasPagination,
  };
}
