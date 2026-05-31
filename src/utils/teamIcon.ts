/** Bundled logo paths for teams with assets in public/team-logos/ */
export const BUNDLED_TEAM_ICONS: Record<string, string> = {
  'team-sunig-ntu': '/team-logos/team-sunig-ntu.png',
};

const IMAGE_ICON_PATTERN =
  /^(https?:\/\/|\/|data:image\/|blob:)/i;

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
export const TEAM_ICON_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

export async function readTeamIconFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a PNG, JPG, WebP, or SVG image.');
  }
  if (file.size > TEAM_ICON_MAX_BYTES) {
    throw new Error('Image must be 512 KB or smaller.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}
