/** Prefill Stats Entry when starting from a tournament fixture (LE-146). */
export interface StatsEntryPrefill {
  gameId: string;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  date?: string;
  startTime?: string;
  stageId?: string;
  groupId?: string;
}

export const STATS_ENTRY_PREFILL_STATE_KEY = 'statsEntryPrefill';
