import type { Game, GameEvent } from '../App';
import type { FoulCategory } from './foulFlow';
import { getTournamentGameFormat } from '../utils/gameFormat';
import type { Tournament } from '../App';

/** FIBA-style: team enters bonus on the 5th counting foul in the period. */
export const PERIOD_BONUS_TEAM_FOUL_THRESHOLD = 5;

/**
 * Fouls that fill the live scoreboard PF dots / period bonus (locked: personal +
 * unsportsmanlike). Technicial / offensive / double are excluded from this count.
 */
export function foulEventCountsTowardPeriodBonus(
  event: Pick<GameEvent, 'type' | 'details'>
): boolean {
  if (event.type !== 'foul') return false;
  const category =
    (typeof event.details?.foulCategory === 'string'
      ? event.details.foulCategory
      : undefined) ??
    (typeof event.details?.foulType === 'string' ? event.details.foulType : undefined) ??
    'personal';
  return category === 'personal' || category === 'unsportsmanlike';
}

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
    (e) =>
      e.period === period &&
      e.teamId === teamId &&
      foulEventCountsTowardPeriodBonus(e)
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
