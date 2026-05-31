import {
  generateTeamAbbreviation,
  getTeamAvatarLabelClass,
  isValidTeamAbbreviation,
  normalizeTeamAbbreviation,
  TEAM_ABBREV_MAX,
} from './teamAbbreviation';
import {
  isTeamIconImage,
  readTeamIconFile,
  TEAM_ICON_ACCEPT,
  TEAM_ICON_MAX_BYTES,
} from './teamIcon';

/** Bundled logo paths for tournaments with assets in public/tournament-logos/ */
export const BUNDLED_TOURNAMENT_ICONS: Record<string, string> = {
  'tournament-sunig-2025': '/tournament-logos/tournament-sunig-2025.png',
  /** IVP 2026 — id from import / Supabase */
  'tournament-1768327829049': '/tournament-logos/tournament-ivp-2026.png',
};

export {
  isTeamIconImage as isTournamentIconImage,
  readTeamIconFile,
  TEAM_ICON_ACCEPT,
  TEAM_ICON_MAX_BYTES,
};

export function resolveTournamentIconSrc(
  icon?: string | null,
  tournamentId?: string
): string | undefined {
  if (isTeamIconImage(icon)) {
    return icon!.trim();
  }
  if (tournamentId && BUNDLED_TOURNAMENT_ICONS[tournamentId]) {
    return BUNDLED_TOURNAMENT_ICONS[tournamentId];
  }
  return undefined;
}

export interface TournamentAvatarLabelSource {
  name: string;
  icon?: string;
}

/** 2–5 letter badge label when no image logo is available. */
export function getTournamentAvatarLabel(
  tournament: TournamentAvatarLabelSource
): string {
  if (tournament.icon && !isTeamIconImage(tournament.icon)) {
    const normalized = normalizeTeamAbbreviation(tournament.icon);
    if (isValidTeamAbbreviation(normalized)) {
      return normalized;
    }
    if (tournament.icon.length <= TEAM_ABBREV_MAX) {
      return tournament.icon.toUpperCase();
    }
  }

  return generateTeamAbbreviation(tournament.name);
}

/** Reuse team badge font scaling for 4–5 char tournament abbreviations. */
export { getTeamAvatarLabelClass as getTournamentAvatarLabelClass };
