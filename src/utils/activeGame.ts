import type { Game, SetupRosterChange, Team } from '../App';

/** IDs assigned in GameSetup when adding a player during live game setup. */
const SETUP_ADDED_PLAYER_ID = /^(home|away)-player-\d+-\d+$/;

export function isSetupAddedPlayerId(playerId: string): boolean {
  return SETUP_ADDED_PLAYER_ID.test(playerId);
}

export function isGameInProgress(game: Game): boolean {
  return Boolean(game.isActive && !game.isCompleted);
}

/** Stale row: not active, not completed, no final score (shows as "Live" incorrectly). */
export function isOrphanedIncompleteGame(game: Game): boolean {
  return !game.isCompleted && !game.finalScore && !isGameInProgress(game);
}

export function canDeleteIncompleteGame(game: Game): boolean {
  return isGameInProgress(game) || isOrphanedIncompleteGame(game);
}

/** True only for teams created in setup via onCreateTeam (team-{timestamp}). */
export function isSetupCreatedTeamId(teamId: string): boolean {
  return /^team-\d{13,}$/.test(teamId);
}

function seedBaselinePlayerIds(
  team: Team,
  baselineByTeamId: Record<string, string[]>,
  dbTeam: Team | undefined
): string[] {
  if (baselineByTeamId[team.id]?.length) {
    return baselineByTeamId[team.id];
  }
  if (dbTeam) {
    return dbTeam.players
      .filter((p) => !isSetupAddedPlayerId(p.id))
      .map((p) => p.id);
  }
  return team.players
    .filter((p) => !isSetupAddedPlayerId(p.id))
    .map((p) => p.id);
}

/**
 * Players added after an existing team was selected in setup.
 * Uses selection snapshot, or DB/catalog ids when snapshot was missing.
 */
export function addedPlayersFromBaseline(
  team: Team,
  baselineByTeamId: Record<string, string[]>,
  dbTeams?: Team[]
): string[] {
  const dbTeam = dbTeams?.find((t) => t.id === team.id);
  const baselineIds = seedBaselinePlayerIds(team, baselineByTeamId, dbTeam);
  if (baselineIds.length === 0) {
    return team.players.filter((p) => isSetupAddedPlayerId(p.id)).map((p) => p.id);
  }
  const baseline = new Set(baselineIds);
  return team.players.filter((p) => !baseline.has(p.id)).map((p) => p.id);
}

/** Setup-added ids on the current team roster (covers stale game snapshots after onUpdateTeam). */
export function inferSetupAddedPlayerIdsFromLiveTeams(
  game: Game,
  liveTeams: Team[],
  teamIdsBeingDeleted: string[]
): SetupRosterChange[] {
  const results: SetupRosterChange[] = [];

  for (const teamId of [game.homeTeamId, game.awayTeamId]) {
    if (!teamId || teamIdsBeingDeleted.includes(teamId)) continue;
    if (teamId.startsWith('opponent-')) continue;

    const live = liveTeams.find((t) => t.id === teamId);
    if (!live) continue;

    const addedPlayerIds = live.players
      .filter((p) => isSetupAddedPlayerId(p.id))
      .map((p) => p.id);

    if (addedPlayerIds.length > 0) {
      results.push({ teamId, addedPlayerIds });
    }
  }

  return results;
}

/** Fallback: setup-added player ids on game snapshot (home-player-*, away-player-*). */
export function inferSetupAddedPlayerIdsFromGameSnapshot(
  game: Game,
  teamIdsBeingDeleted: string[]
): SetupRosterChange[] {
  const entries: [string, Team][] = [
    [game.homeTeamId, game.homeTeam],
    [game.awayTeamId, game.awayTeam],
  ];
  const results: SetupRosterChange[] = [];

  for (const [teamId, team] of entries) {
    if (!teamId || teamIdsBeingDeleted.includes(teamId)) continue;
    if (teamId.startsWith('opponent-')) continue;

    const addedPlayerIds = team.players
      .filter((p) => isSetupAddedPlayerId(p.id))
      .map((p) => p.id);

    if (addedPlayerIds.length > 0) {
      results.push({ teamId, addedPlayerIds });
    }
  }

  return results;
}

function mergeRosterChanges(
  ...lists: SetupRosterChange[][]
): SetupRosterChange[] {
  const byTeam = new Map<string, Set<string>>();
  for (const list of lists) {
    for (const { teamId, addedPlayerIds } of list) {
      const ids = byTeam.get(teamId) ?? new Set<string>();
      addedPlayerIds.forEach((id) => ids.add(id));
      byTeam.set(teamId, ids);
    }
  }
  return Array.from(byTeam.entries()).map(([teamId, ids]) => ({
    teamId,
    addedPlayerIds: [...ids],
  }));
}

/** Only delete teams explicitly marked as created during this game's setup. */
export function resolveTeamsToDeleteWithGame(game: Game): string[] {
  return (game.setupCreatedTeamIds ?? []).filter(isSetupCreatedTeamId);
}

/** Players added to existing teams during setup — strip from roster when game is deleted. */
export function resolveSetupPlayersToRemove(
  game: Game,
  teamIdsBeingDeleted: string[],
  liveTeams?: Team[]
): SetupRosterChange[] {
  const fromMeta = (game.setupRosterChanges ?? []).filter(
    (c) => !teamIdsBeingDeleted.includes(c.teamId) && c.addedPlayerIds.length > 0
  );
  const fromSnapshot = inferSetupAddedPlayerIdsFromGameSnapshot(
    game,
    teamIdsBeingDeleted
  );
  const fromLive =
    liveTeams && liveTeams.length > 0
      ? inferSetupAddedPlayerIdsFromLiveTeams(
          game,
          liveTeams,
          teamIdsBeingDeleted
        )
      : [];
  return mergeRosterChanges(fromMeta, fromSnapshot, fromLive);
}

function pickNewerActive(a: Game, b: Game): Game {
  const dateA = a.date || '';
  const dateB = b.date || '';
  if (dateA !== dateB) {
    return dateA >= dateB ? a : b;
  }
  return a.id >= b.id ? a : b;
}

/** Returns the single in-progress game, preferring `currentGame` when valid. */
export function getActiveGame(
  games: Game[],
  currentGame?: Game | null
): Game | null {
  if (currentGame && isGameInProgress(currentGame)) {
    return currentGame;
  }
  const actives = games.filter(isGameInProgress);
  if (actives.length === 0) return null;
  return actives.reduce(pickNewerActive);
}

/**
 * Ensures at most one active game in the list.
 * Older duplicate actives are marked inactive.
 */
export function dedupeActiveGames(games: Game[]): {
  games: Game[];
  active: Game | null;
  changed: boolean;
} {
  const active = getActiveGame(games);
  if (!active) {
    return { games, active: null, changed: false };
  }

  let changed = false;
  const cleaned = games.map((g) => {
    if (isGameInProgress(g) && g.id !== active.id) {
      changed = true;
      return { ...g, isActive: false };
    }
    return g;
  });

  return { games: cleaned, active, changed };
}
