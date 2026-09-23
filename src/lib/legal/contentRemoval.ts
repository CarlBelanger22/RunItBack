/** Public content notice-and-removal contact (compliance). */
export const CONTENT_REMOVAL_EMAIL = 'runitbackstats@gmail.com';

/** Calendar hours to review / respond to a valid removal notice. */
export const CONTENT_REMOVAL_SLA_HOURS = 48;

/**
 * Build a mailto URL. Use encodeURIComponent (not URLSearchParams) so mail
 * clients decode spaces as spaces instead of literal "+".
 */
export function buildContentRemovalMailto(args?: {
  subject?: string;
  body?: string;
}): string {
  const subject = args?.subject ?? 'RunItBack content removal request';
  const parts = [`subject=${encodeURIComponent(subject)}`];
  if (args?.body) {
    parts.push(`body=${encodeURIComponent(args.body)}`);
  }
  return `mailto:${CONTENT_REMOVAL_EMAIL}?${parts.join('&')}`;
}
