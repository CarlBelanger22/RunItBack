/**
 * Build Supabase OAuth `redirectTo` for the page the user signed in from.
 * Same-origin only; pathname + search; no hash (auth tokens may use the hash).
 */
export function buildAuthRedirectTo(
  origin: string,
  pathname: string,
  search = ''
): string {
  const base = origin.replace(/\/$/, '');
  const path =
    !pathname || pathname === ''
      ? '/'
      : pathname.startsWith('/')
        ? pathname
        : `/${pathname}`;
  const query = search && search !== '?' ? search : '';
  if (path === '/' && !query) return `${base}/`;
  return `${base}${path}${query}`;
}

/** OAuth redirect back to the current page (localhost or production). */
export function getAuthRedirectTo(): string {
  if (typeof window === 'undefined') return '';
  return buildAuthRedirectTo(
    window.location.origin,
    window.location.pathname,
    window.location.search
  );
}
