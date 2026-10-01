import type { Game, GameEvent } from '../App';
import type { FoulCategory } from './foulFlow';
import { getTournamentGameFormat } from '../utils/gameFormat';
import type { Tournament } from '../App';

/** FIBA-style: team enters bonus on the 5th counting foul in the period. */
export const PERIOD_BONUS_TEAM_FOUL_THRESHOLD = 5;

function foulCategoryOnEvent(event: Pick<GameEvent, 'details'>): string {
  if (event.details?.isOffensiveFoul === true) return 'offensive';
  const category =
    (typeof event.details?.foulCategory === 'string'
      ? event.details.foulCategory
      : undefined) ??
    (typeof event.details?.foulType === 'string' ? event.details.foulType : undefined) ??
    'personal';
  if (category === 'normal') return 'personal';
  return category;
}

/** Coach and bench technicals are charged to the coach and are not team fouls. */
function isBenchTechnical(
  event: Pick<GameEvent, 'details'>,
  category: string
): boolean {
  if (category !== 'technical') return false;
  return event.details?.isCoachFoul === true || event.details?.isTeamFoul === true;
}

/**
 * Scoreboard dots for this quarter. Personal, unsportsmanlike, offensive,
 * player technical, and both sides of a double foul count. A bench or coach
 * technical does not.
 */
export function foulEventCountsForPeriodTeam(
  event: Pick<GameEvent, 'type' | 'teamId' | 'details'>,
  teamId: string
): boolean {
  if (event.type !== 'foul') return false;
  const category = foulCategoryOnEvent(event);
  if (isBenchTechnical(event, category)) return false;
  const counts =
    category === 'personal' ||
    category === 'unsportsmanlike' ||
    category === 'offensive' ||
    category === 'technical' ||
    category === 'double';
  if (!counts) return false;
  if (event.teamId === teamId) return true;
  return (
    category === 'double' &&
    event.details?.doublePartnerTeamId === teamId &&
    event.teamId !== teamId
  );
}

/**
 * The bonus hint (suggest 2 free throws) is only for a personal or
 * unsportsmanlike foul. An offensive foul still fills a dot and never
 * suggests free throws, even when the team is already in the bonus.
 */
export function foulCategoryCountsTowardPeriodBonus(
  category: FoulCategory | string | undefined
): boolean {
  const cat = category ?? 'personal';
  return cat === 'personal' || cat === 'unsportsmanlike';
}

/** Period team fouls already on the event log (scoreboard dots / bonus). */
export function countPeriodTeamFoulsTowardBonus(
  game: Pick<Game, 'events'>,
  teamId: string,
  period: number
): number {
  return game.events.filter(
    (e) => e.period === period && foulEventCountsForPeriodTeam(e, teamId)
  ).length;
}

/**
 * True when awarding this foul should show the bonus FT hint (emphasize 2 FTs).
 * Pending foul is not on the log yet — include it when it counts.
 */
export function shouldShowBonusFtPrompt(params: {
  game: Pick<Game, 'events' | 'currentPeriod' | 'tournamentId'>;
  foulingTeamId: string;
  foulCategory: FoulCategory | string | undefined;
  /** 5v5 only; false for 3×3. */
  bonusEnabled: boolean;
  /** And-1 / shooting-foul path already awards FT separately. */
  and1Active?: boolean;
}): boolean {
  if (!params.bonusEnabled || params.and1Active) return false;
  // Offensive and double fouls fill the dots and still award no free throws.
  if (
    params.foulCategory === 'offensive' ||
    params.foulCategory === 'double'
  ) {
    return false;
  }
  if (!foulCategoryCountsTowardPeriodBonus(params.foulCategory)) return false;
  const prior = countPeriodTeamFoulsTowardBonus(
    params.game,
    params.foulingTeamId,
    params.game.currentPeriod
  );
  return prior + 1 >= PERIOD_BONUS_TEAM_FOUL_THRESHOLD;
}

export function isPeriodBonusFtEnabledForGame(
  game: Pick<Game, 'tournamentId'> | null | undefined,
  tournament?: Pick<Tournament, 'id' | 'gameFormat'> | null
): boolean {
  if (!game) return false;
  return getTournamentGameFormat(game.tournamentId, tournament) === '5v5';
}
