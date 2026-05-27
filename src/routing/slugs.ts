/** Separator between URL slug and stable entity id (slug--id) */
export const SLUG_ID_SEP = '--';

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'item';
}

export function buildSlugId(name: string, id: string): string {
  return `${slugify(name)}${SLUG_ID_SEP}${id}`;
}

export function parseSlugId(param: string): { slug: string; id: string } | null {
  const idx = param.lastIndexOf(SLUG_ID_SEP);
  if (idx <= 0) return null;
  const slug = param.slice(0, idx);
  const id = param.slice(idx + SLUG_ID_SEP.length);
  if (!slug || !id) return null;
  return { slug, id };
}
