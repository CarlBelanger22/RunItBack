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

export function tournamentRosterDeleteKey(
  row: TournamentRosterDelete
): string {
  return `${row.tournamentId}:${row.teamId}:${row.playerId}`;
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
