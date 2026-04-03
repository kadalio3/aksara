export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Mendapatkan metadata navigasi untuk hasil paginasi.
 * 
 * @param total Jumlah total item di database.
 * @param page Halaman yang sedang dibuka (misal 1).
 * @param limit Batasan jumlah item per halaman (misal 20).
 * @returns Object meta pagination.
 */
export const getPaginationMetadata = (total: number, page: number, limit: number) => {
  const total_pages = Math.ceil(total / limit);
  const has_next = page < total_pages;
  const has_prev = page > 1;

  return {
    page,
    limit,
    total,
    total_pages,
    has_next,
    has_prev,
  };
};
