export const TEAM_ASSETS_BUCKET = 'team-assets';

export type TeamAssetKind = 'teams' | 'tournaments';

const DATA_IMAGE_PREFIX = 'data:image/';

export function teamAssetStoragePath(kind: TeamAssetKind, entityId: string): string {
  return `${kind}/${entityId}.png`;
}

export function isIconDataUrl(icon?: string | null): boolean {
  return Boolean(icon?.trim().startsWith(DATA_IMAGE_PREFIX));
}

/** Remote HTTP(S) or bundled site path — not an inline data URL. */
export function isPersistedIconReference(icon?: string | null): boolean {
  if (!icon?.trim()) return false;
  const trimmed = icon.trim();
  if (trimmed.startsWith(DATA_IMAGE_PREFIX)) return false;
  return /^(https?:\/\/|\/)/.test(trimmed);
}

/**
 * LE-107 — Append/replace `?v=` so re-uploads at the same storage path
 * force browsers to fetch the new image (same public URL otherwise caches for a year).
 */
export function withIconCacheBust(
  publicUrl: string,
  version: number | string = Date.now()
): string {
  const trimmed = publicUrl.trim();
  if (!trimmed) return trimmed;
  try {
    // Absolute http(s) URLs
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      url.searchParams.set('v', String(version));
      return url.toString();
    }
  } catch {
    // fall through
  }
  // Relative /path or malformed — strip existing v= then append
  const withoutHash = trimmed.split('#')[0] ?? trimmed;
  const [base, query = ''] = withoutHash.split('?');
  const params = new URLSearchParams(query);
  params.set('v', String(version));
  const q = params.toString();
  return q ? `${base}?${q}` : `${base}?v=${version}`;
}

export function parseIconDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) {
    throw new Error('Invalid image data URL.');
  }

  const base64 = match[2].replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return { mime: match[1], bytes };
}

export function iconDataUrlToBlob(dataUrl: string): Blob {
  const { mime, bytes } = parseIconDataUrl(dataUrl);
  const copy = new Uint8Array(bytes);
  return new Blob([copy], { type: mime || 'image/png' });
}

export function normalizeIconForDb(icon?: string): string | null {
  if (icon === undefined) return null;
  const trimmed = icon.trim();
  if (!trimmed) return null;
  if (isIconDataUrl(trimmed)) {
    throw new Error('Inline image data URLs must be uploaded to Storage before saving.');
  }
  return trimmed;
}
