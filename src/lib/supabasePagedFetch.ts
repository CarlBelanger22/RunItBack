/** PostgREST / Supabase default max-rows per request. */
export const SUPABASE_PAGE_SIZE = 1000;

export type PagedFetchPageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Walk `.range(from, to)` until a short page. Needed once a table exceeds
 * PostgREST's default 1000-row cap (silent truncation otherwise).
 */
export async function fetchAllPaged<T>(
  fetchPage: (
    from: number,
    to: number
  ) => Promise<PagedFetchPageResult<T>>,
  pageSize: number = SUPABASE_PAGE_SIZE
): Promise<PagedFetchPageResult<T>> {
  if (pageSize < 1) {
    return { data: [], error: { message: 'pageSize must be >= 1' } };
  }

  const all: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) {
      return { data: all, error };
    }
    const page = data ?? [];
    all.push(...page);
    if (page.length < pageSize) {
      return { data: all, error: null };
    }
    from += pageSize;
  }
}

/** DEV/smoke helper: warn when loaded rows disagree with an exact count. */
export function warnIfUnderfetched(
  label: string,
  loaded: number,
  expected: number | null | undefined
): void {
  if (expected == null) return;
  if (loaded === expected) return;
  console.error(`[Supabase] ${label} underfetch`, {
    expected,
    got: loaded,
    missing: expected - loaded,
  });
}
