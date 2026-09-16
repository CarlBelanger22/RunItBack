/** Bundled logo paths for teams with assets in public/team-logos/ */
export const BUNDLED_TEAM_ICONS: Record<string, string> = {
  'team-sunig-ntu': '/team-logos/team-sunig-ntu.png',
};

const IMAGE_ICON_PATTERN =
  /^(https?:\/\/|\/|data:image\/|blob:)/i;

/** Raster-only — SVG can carry script XSS when served/inlined. */
export const TEAM_ICON_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export function isTeamIconImage(icon?: string | null): boolean {
  if (!icon?.trim()) return false;
  return IMAGE_ICON_PATTERN.test(icon.trim());
}

export function resolveTeamIconSrc(
  icon?: string | null,
  teamId?: string
): string | undefined {
  if (isTeamIconImage(icon)) {
    return icon!.trim();
  }
  if (teamId && BUNDLED_TEAM_ICONS[teamId]) {
    return BUNDLED_TEAM_ICONS[teamId];
  }
  return undefined;
}

export const TEAM_ICON_MAX_BYTES = 512 * 1024;
export const TEAM_ICON_ACCEPT = TEAM_ICON_ALLOWED_MIME_TYPES.join(',');

const SVG_REJECT_MESSAGE =
  'SVG images are not allowed. Please use PNG, JPG, or WebP.';

/** Reject SVG data URLs and .svg file URLs (paste / remote). */
export function assertTeamIconSourceAllowed(src: string): void {
  const lower = src.trim().toLowerCase();
  if (
    lower.startsWith('data:image/svg') ||
    lower.includes('image/svg+xml') ||
    /\.svg(\?|#|$)/i.test(lower)
  ) {
    throw new Error(SVG_REJECT_MESSAGE);
  }
}

function assertTeamIconFileAllowed(file: File): void {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    throw new Error(SVG_REJECT_MESSAGE);
  }
  const allowed =
    type === 'image/png' ||
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/webp' ||
    (type === '' && /\.(png|jpe?g|webp)$/i.test(file.name));
  if (!allowed) {
    throw new Error('Please choose a PNG, JPG, or WebP image.');
  }
  if (file.size > TEAM_ICON_MAX_BYTES) {
    throw new Error('Image must be 512 KB or smaller.');
  }
}

export async function readTeamIconFile(file: File): Promise<string> {
  assertTeamIconFileAllowed(file);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        try {
          assertTeamIconSourceAllowed(reader.result);
          resolve(reader.result);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error('Could not read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}
