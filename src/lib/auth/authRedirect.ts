/** OAuth redirect back to the current origin (localhost or Vercel). */
export function getAuthRedirectTo(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/`;
}
