import type { Player, Team } from '../App';

/** Stored height is cm as a numeric string; stored weight is kg as a numeric string. */

const CM_PER_INCH = 2.54;
const LBS_TO_KG = 0.453592;

function parsePositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Normalize user input (cm) for storage. */
export function normalizeHeightCmInput(value: string): string {
  const n = parsePositiveNumber(value);
  if (n == null) return '';
  return String(Math.round(n));
}

/** Normalize user input (kg) for storage. */
export function normalizeWeightKgInput(value: string): string {
  const n = parsePositiveNumber(value);
  if (n == null) return '';
  return String(Math.round(n));
}

function parseCmFromMetersText(raw: string): number | null {
  const m = raw.match(/(\d+(?:\.\d+)?)\s*m\b/i);
  if (!m) return null;
  const meters = Number(m[1]);
  if (!Number.isFinite(meters) || meters <= 0) return null;
  return meters * 100;
}

function parseCmFromFeetInchesText(raw: string): number | null {
  const ftIn = raw.match(/(\d+)\s*['′ft]+\s*(\d+)?/i);
  if (!ftIn) return null;
  const feet = Number(ftIn[1]);
  const inches = ftIn[2] ? Number(ftIn[2]) : 0;
  if (!Number.isFinite(feet) || feet < 0 || !Number.isFinite(inches) || inches < 0) return null;
  const totalInches = feet * 12 + inches;
  return totalInches * CM_PER_INCH;
}

/** Best-effort parse legacy height strings into cm. */
export function parseLegacyHeightToCm(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const plain = parsePositiveNumber(trimmed);
  if (plain != null && !trimmed.includes("'") && !trimmed.toLowerCase().includes('m')) {
    return String(Math.round(plain));
  }

  const cmMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*cm\b/i);
  if (cmMatch) {
    const cm = Number(cmMatch[1]);
    if (Number.isFinite(cm) && cm > 0) return String(Math.round(cm));
  }

  const fromM = parseCmFromMetersText(trimmed);
  if (fromM != null) return String(Math.round(fromM));

  const fromFt = parseCmFromFeetInchesText(trimmed);
  if (fromFt != null) return String(Math.round(fromFt));

  return '';
}

/** Best-effort parse legacy weight strings into kg. */
export function parseLegacyWeightToKg(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const kgMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kgMatch) {
    const kg = Number(kgMatch[1]);
    if (Number.isFinite(kg) && kg > 0) return String(Math.round(kg));
  }

  const lbsMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*lbs?\b/i);
  if (lbsMatch) {
    const lbs = Number(lbsMatch[1]);
    if (Number.isFinite(lbs) && lbs > 0) return String(Math.round(lbs * LBS_TO_KG));
  }

  const plain = parsePositiveNumber(trimmed);
  if (plain != null && !trimmed.toLowerCase().includes('lb')) {
    return String(Math.round(plain));
  }

  return '';
}

export function normalizeStoredHeight(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const asCm = parseLegacyHeightToCm(trimmed);
  return asCm || normalizeHeightCmInput(trimmed);
}

export function normalizeStoredWeight(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const asKg = parseLegacyWeightToKg(trimmed);
  return asKg || normalizeWeightKgInput(trimmed);
}

/** Profile display: feet/inches (nearest inch) + cm in parentheses. */
export function formatHeightForDisplay(storedCm: string): string {
  const cm = parsePositiveNumber(storedCm);
  if (cm == null) {
    const legacy = storedCm.trim();
    return legacy;
  }

  const totalInches = Math.round(cm / CM_PER_INCH);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const cmRounded = Math.round(cm);
  return `${feet}'${inches}'' (${cmRounded}cm)`;
}

/** Profile display: kg only, e.g. 88kg */
export function formatWeightForDisplay(storedKg: string): string {
  const kg = parsePositiveNumber(storedKg);
  if (kg == null) {
    const legacy = storedKg.trim();
    return legacy;
  }
  return `${Math.round(kg)}kg`;
}

export function migratePlayerMeasurements(player: Player): Player {
  const height = normalizeStoredHeight(player.height ?? '');
  const weight = normalizeStoredWeight(player.weight ?? '');
  if (height === (player.height ?? '') && weight === (player.weight ?? '')) {
    return player;
  }
  return { ...player, height, weight };
}

export function migrateTeamsPlayerMeasurements(teams: Team[]): { teams: Team[]; changed: boolean } {
  let changed = false;
  const migratedTeams = teams.map((team) => {
    const players = (team.players ?? []).map((player) => {
      const next = migratePlayerMeasurements(player);
      if (next !== player) changed = true;
      return next;
    });
    return players === team.players ? team : { ...team, players };
  });
  return { teams: migratedTeams, changed };
}

export const PLAYER_MEASUREMENTS_MIGRATION_KEY = 'runitback_player_measurements_v1';
