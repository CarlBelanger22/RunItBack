import {
  mergeTournamentRosters,
  tournamentRosterEntryKey,
  type TournamentRosterEntry,
} from '../utils/tournamentRosters';

export interface TournamentRosterDelete {
  tournamentId: string;
  teamId: string;
  playerId: string;
}

export interface TournamentRosterCloudWritePlan {
  upsert: TournamentRosterEntry[];
  deletes: TournamentRosterDelete[];
}

/** Post-merge: stale local ids → kept profiles that own the games. */
export const MERGED_PLAYER_ID_ALIASES: Readonly<Record<string, string>> = {
  'player-sunig-nus-14-paolo': 'player-nbl-d1-2026-xh-12-paolo',
  'player-sunig-nus-00-zachary-gan': 'player-nbl-d1-2026-sba-00-zachary',
  'player-sunig-nus-22-yifan': 'player-nbl-d1-2026-cg-22-yifan',
};

export function tournamentRosterDeleteKey(
  row: TournamentRosterDelete
): string {
  return `${row.tournamentId}:${row.teamId}:${row.playerId}`;
}

export function collectKnownPlayerIdsFromTeams(
  teams: Array<{ players?: Array<{ id: string }> }>
): Set<string> {
  const ids = new Set<string>();
  for (const team of teams) {
    for (const player of team.players ?? []) {
      if (player?.id) ids.add(player.id);
    }
  }
  return ids;
}

/**
 * Remap known merged aliases, drop roster rows whose player is not on any
 * club roster (avoids tournament_rosters_player_id_fkey), then dedupe keys.
 */
export function sanitizeTournamentRostersForCloud(args: {
  entries: TournamentRosterEntry[];
  teams: Array<{ players?: Array<{ id: string }> }>;
  aliases?: Readonly<Record<string, string>>;
}): {
  entries: TournamentRosterEntry[];
  remappedCount: number;
  droppedPlayerIds: string[];
  changed: boolean;
} {
  const aliases = args.aliases ?? MERGED_PLAYER_ID_ALIASES;
  const known = collectKnownPlayerIdsFromTeams(args.teams);
  let remappedCount = 0;
  const droppedPlayerIds: string[] = [];

  const rewritten = args.entries.map((row) => {
    const nextId = aliases[row.playerId];
    if (nextId && nextId !== row.playerId) {
      remappedCount += 1;
      return { ...row, playerId: nextId };
    }
    return row;
  });

  const byKey = new Map<string, TournamentRosterEntry>();
  for (const row of rewritten) {
    if (!known.has(row.playerId)) {
      droppedPlayerIds.push(row.playerId);
      continue;
    }
    byKey.set(tournamentRosterEntryKey(row), row);
  }
  const kept = [...byKey.values()];

  const changed =
    remappedCount > 0 ||
    droppedPlayerIds.length > 0 ||
    kept.length !== args.entries.length ||
    !tournamentRosterSetsEqual(kept, args.entries);

  return { entries: kept, remappedCount, droppedPlayerIds, changed };
}

export function remapTournamentRosterDeletes(
  deletes: TournamentRosterDelete[],
  aliases: Readonly<Record<string, string>> = MERGED_PLAYER_ID_ALIASES
): TournamentRosterDelete[] {
  return deletes.map((row) => {
    const nextId = aliases[row.playerId];
    return nextId && nextId !== row.playerId
      ? { ...row, playerId: nextId }
      : row;
  });
}

export function collectTournamentRosterRemovals(
  prev: TournamentRosterEntry[],
  next: TournamentRosterEntry[]
): TournamentRosterDelete[] {
  const nextKeys = new Set(next.map(tournamentRosterEntryKey));
  return prev
    .filter((row) => !nextKeys.has(tournamentRosterEntryKey(row)))
    .map((row) => ({
      tournamentId: row.tournamentId,
      teamId: row.teamId,
      playerId: row.playerId,
    }));
}

/**
 * Upsert client rows; delete only explicit removals.
 * Never plan a tournament-scoped wipe of rows the client does not hold.
 */
export function planTournamentRosterCloudWrite(args: {
  clientRows: TournamentRosterEntry[];
  pendingDeletes?: TournamentRosterDelete[];
}): TournamentRosterCloudWritePlan {
  const pendingDeletes = args.pendingDeletes ?? [];
  const deleteKeys = new Set(pendingDeletes.map(tournamentRosterDeleteKey));
  const upsert = args.clientRows.filter(
    (row) => !deleteKeys.has(tournamentRosterEntryKey(row))
  );
  return { upsert, deletes: pendingDeletes };
}

/** Union local + cloud; local jersey/position overlay; honor explicit removes. */
export function mergeLocalAndCloudTournamentRosters(
  local: TournamentRosterEntry[],
  cloud: TournamentRosterEntry[],
  pendingDeletes: TournamentRosterDelete[] = []
): TournamentRosterEntry[] {
  const merged = mergeTournamentRosters(local, cloud);
  if (pendingDeletes.length === 0) return merged;
  const deleteKeys = new Set(pendingDeletes.map(tournamentRosterDeleteKey));
  return merged.filter(
    (row) => !deleteKeys.has(tournamentRosterEntryKey(row))
  );
}

export function tournamentRosterSetsEqual(
  a: TournamentRosterEntry[],
  b: TournamentRosterEntry[]
): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(tournamentRosterEntryKey));
  return b.every((row) => keys.has(tournamentRosterEntryKey(row)));
}

/**
 * After first cloud fetch, always re-enable saves.
 * If the user edited during fetch, persist those edits.
 */
export function resolvePostRevalidateSaveGate(args: {
  cloudApplied: boolean;
  hadCache: boolean;
  hadLocalEdits: boolean;
  rostersAheadOfCloud?: boolean;
}): { enableSaves: boolean; persistKind: 'full' | 'rosters-only' | null } {
  if (args.hadLocalEdits) {
    return {
      enableSaves: true,
      persistKind: args.cloudApplied ? 'full' : 'rosters-only',
    };
  }
  if (args.rostersAheadOfCloud) {
    return { enableSaves: true, persistKind: 'rosters-only' };
  }
  return { enableSaves: true, persistKind: null };
}
