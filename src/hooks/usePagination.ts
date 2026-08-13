import { useState } from "react";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export function usePagination<T>(items: T[], initialPageSize: number = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  function setPageSize(size: number) {
    setPageSizeState(size);
    setPage(1);
  }

  return { page: safePage, setPage, pageSize, setPageSize, totalItems, totalPages, pageItems };
}
