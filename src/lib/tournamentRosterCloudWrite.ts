import {
  mergeTournamentRosters,
  resolvePlayerTeamSideInGame,
  buildClubRosterByTeam,
  tournamentRosterEntryKey,
  type TournamentRosterEntry,
} from '../utils/tournamentRosters';
import type { Game, Team } from '../App';

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
  // Rekt import duplicates → kept profiles
  'player-rekt-s2-unicorns-3-khai-mun': 'player-sunig-ntu-14',
  'player-rekt-s2-og-basketball-9-tay-ding-loon': 'player-1788765662433',
  'player-rekt-s2-soldiers-12-teo-sze-tuan': 'player-nbl-d1-2026-sgb-21-teo',
  'player-rekt-s2-z3no-4-au-jin-kai': 'player-nbl-d1-2026-xh-04-au',
  'player-rekt-s2-phalanx-7-thng-jun-rong': 'player-rekt-s1-kcw-7-thng-jun-rong',
  'player-rekt-s2-og-basketball-6-ouyang-s-m': 'player-sunig-nus-11-auyeung',
  'player-rekt-s2-phalanx-4-liang-rong': 'player-nbl-d1-2026-xh-19-wang',
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
 * Remap known merged aliases, drop roster rows that cannot exist in DB, then
 * dedupe keys.
 *
 * Keep rules (important):
 * - Always keep players who appear in completed game_stats for that
 *   tournament on a game involving `row.teamId` — even if the in-memory club
 *   template is thin (snapshot / under-merge). Dropping those caused id-as-name
 *   stubs and cloud TR wipes (NBL 2025).
 * - Still drop true garbage: no club membership AND never appeared for that
 *   team in the tournament (avoids FK / cross-club leftovers).
 */
export function sanitizeTournamentRostersForCloud(args: {
  entries: TournamentRosterEntry[];
  teams: Array<{ id?: string; players?: Array<{ id: string }> }>;
  /** When set, rows are kept if the player has stats on that team in that tournament. */
  games?: Game[];
  aliases?: Readonly<Record<string, string>>;
}): {
  entries: TournamentRosterEntry[];
  remappedCount: number;
  droppedPlayerIds: string[];
  changed: boolean;
} {
  const aliases = args.aliases ?? MERGED_PLAYER_ID_ALIASES;
  const known = collectKnownPlayerIdsFromTeams(args.teams);
  const clubPlayerIdsByTeam = new Map<string, Set<string>>();
  for (const team of args.teams) {
    if (!team.id) continue;
    clubPlayerIdsByTeam.set(
      team.id,
      new Set((team.players ?? []).map((p) => p.id).filter(Boolean))
    );
  }

  const clubByTeam = buildClubRosterByTeam(args.teams as Team[]);
  /** tournamentId:teamId:playerId — side resolved via club/starters when possible. */
  const playedForTeam = new Set<string>();
  /**
   * tournamentId:teamId:playerId — player has box stats in a completed game
   * where this team is home or away (does not require club template membership).
   */
  const appearedOnTeamGame = new Set<string>();

  for (const game of args.games ?? []) {
    if (!game.isCompleted || !game.tournamentId) continue;
    const homeId = game.homeTeamId || game.homeTeam?.id;
    const awayId = game.awayTeamId || game.awayTeam?.id;
    for (const stat of game.gameStats ?? []) {
      if (!stat.playerId) continue;
      if (homeId) {
        appearedOnTeamGame.add(
          `${game.tournamentId}:${homeId}:${stat.playerId}`
        );
      }
      if (awayId) {
        appearedOnTeamGame.add(
          `${game.tournamentId}:${awayId}:${stat.playerId}`
        );
      }
      const side = resolvePlayerTeamSideInGame(
        stat.playerId,
        game,
        clubByTeam
      );
      if (!side) continue;
      playedForTeam.add(`${game.tournamentId}:${side}:${stat.playerId}`);
    }
  }

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
    const appearedKey = `${row.tournamentId}:${row.teamId}:${row.playerId}`;
    const keptByAppearance =
      appearedOnTeamGame.has(appearedKey) || playedForTeam.has(appearedKey);

    // Unknown to thin in-memory clubs: still keep if they played for this team.
    if (!known.has(row.playerId) && !keptByAppearance) {
      droppedPlayerIds.push(row.playerId);
      continue;
    }

    const clubIds = clubPlayerIdsByTeam.get(row.teamId);
    if (clubIds && !clubIds.has(row.playerId) && !keptByAppearance) {
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

/** Resolve a stale merged id to the kept profile id. */
export function resolveMergedPlayerId(
  playerId: string,
  aliases: Readonly<Record<string, string>> = MERGED_PLAYER_ID_ALIASES
): string {
  return aliases[playerId] ?? playerId;
}

/** Deep-remap merged player ids inside game JSON (stats/events/shots/stints/starters). */
export function deepRemapMergedPlayerIds<T>(
  value: T,
  aliases: Readonly<Record<string, string>> = MERGED_PLAYER_ID_ALIASES
): T {
  if (typeof value === 'string') {
    return (aliases[value] ?? value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepRemapMergedPlayerIds(v, aliases)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepRemapMergedPlayerIds(v, aliases);
    }
    return out as T;
  }
  return value;
}

/**
 * Remap starter/stat/event player ids on a game before cloud upsert so a stale
 * local snapshot cannot resurrect deleted merge-from profiles.
 */
export function applyMergedPlayerIdAliasesToGame<T extends {
  homeStarters?: string[];
  awayStarters?: string[];
  gameStats?: Array<{ playerId?: string } & Record<string, unknown>>;
  shots?: unknown[];
  events?: unknown[];
  lineupStints?: unknown[];
  gameDayRosterIds?: { home: string[]; away: string[] };
}>(
  game: T,
  aliases: Readonly<Record<string, string>> = MERGED_PLAYER_ID_ALIASES
): T {
  if (Object.keys(aliases).length === 0) return game;
  const gameStats = deepRemapMergedPlayerIds(game.gameStats ?? [], aliases);
  // If local state still had both merge-from and kept ids, keep one row per player.
  const byPlayer = new Map<string, (typeof gameStats)[number]>();
  for (const row of gameStats) {
    const id = row.playerId;
    if (!id) continue;
    byPlayer.set(id, row);
  }
  return {
    ...game,
    homeStarters: deepRemapMergedPlayerIds(game.homeStarters ?? [], aliases),
    awayStarters: deepRemapMergedPlayerIds(game.awayStarters ?? [], aliases),
    gameStats: [...byPlayer.values()],
    shots: deepRemapMergedPlayerIds(game.shots ?? [], aliases),
    events: deepRemapMergedPlayerIds(game.events ?? [], aliases),
    lineupStints: deepRemapMergedPlayerIds(game.lineupStints ?? [], aliases),
    gameDayRosterIds: game.gameDayRosterIds
      ? deepRemapMergedPlayerIds(game.gameDayRosterIds, aliases)
      : game.gameDayRosterIds,
  };
}

/** Drop merge-from profile ids so cloud save cannot recreate deleted duplicates. */
export function filterMergedAwayPlayers<T extends { id: string }>(
  players: T[],
  aliases: Readonly<Record<string, string>> = MERGED_PLAYER_ID_ALIASES
): T[] {
  return players.filter((p) => !aliases[p.id]);
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

/** Normalize optional rookie flag for cloud compare (missing === false). */
export function tournamentRosterRookieFlag(entry: {
  isRookie?: boolean;
}): boolean {
  return entry.isRookie === true;
}

/** True when cloud-relevant fields match (key + jersey/position + isRookie). */
export function tournamentRosterEntryCloudEqual(
  a: TournamentRosterEntry,
  b: TournamentRosterEntry
): boolean {
  return (
    a.tournamentId === b.tournamentId &&
    a.teamId === b.teamId &&
    a.playerId === b.playerId &&
    a.number === b.number &&
    (a.position || '') === (b.position || '') &&
    (a.secondaryPosition || '') === (b.secondaryPosition || '') &&
    tournamentRosterRookieFlag(a) === tournamentRosterRookieFlag(b)
  );
}

/**
 * Membership + jersey/position only — ignores isRookie.
 * Used to decide whether Eligibility can take the light flush path.
 */
export function tournamentRosterEntryMembershipEqual(
  a: TournamentRosterEntry,
  b: TournamentRosterEntry
): boolean {
  return (
    a.tournamentId === b.tournamentId &&
    a.teamId === b.teamId &&
    a.playerId === b.playerId &&
    a.number === b.number &&
    (a.position || '') === (b.position || '') &&
    (a.secondaryPosition || '') === (b.secondaryPosition || '')
  );
}

export type RookieFlagOnlyFlushPlan = {
  upsert: TournamentRosterEntry[];
  /** How dirty rows were chosen. */
  mode: 'delta' | 'tagged-only' | 'empty';
  /** Rows skipped because jersey/position drifted vs baseline (not written). */
  skippedNonRookieDrift: number;
};

/**
 * Eligibility light flush — always returns a plan (never "reject → full persist").
 *
 * Writes **every current tag** for the tournament (not only baseline deltas) so
 * a wrong/empty ack baseline cannot report Saved while skipping most rows.
 * Also upserts clears (baseline tagged, local untagged).
 */
export function planRookieFlagOnlyFlush(args: {
  local: TournamentRosterEntry[];
  baseline: TournamentRosterEntry[] | null | undefined;
  /** Required to scope tags/clears to one tournament. */
  tournamentId?: string;
}): RookieFlagOnlyFlushPlan {
  const tournamentId = args.tournamentId?.trim();
  if (!tournamentId) {
    return { upsert: [], mode: 'empty', skippedNonRookieDrift: 0 };
  }

  const inScope = (row: TournamentRosterEntry) =>
    row.tournamentId === tournamentId;
  const localByKey = new Map(
    args.local.filter(inScope).map((row) => [tournamentRosterEntryKey(row), row])
  );
  const byKey = new Map<string, TournamentRosterEntry>();
  let skippedNonRookieDrift = 0;

  for (const row of localByKey.values()) {
    if (!tournamentRosterRookieFlag(row)) continue;
    byKey.set(tournamentRosterEntryKey(row), row);
  }

  const baseline = args.baseline ?? [];
  for (const prev of baseline) {
    if (!inScope(prev) || !tournamentRosterRookieFlag(prev)) continue;
    const key = tournamentRosterEntryKey(prev);
    const local = localByKey.get(key);
    if (local && tournamentRosterRookieFlag(local)) continue;
    // Cleared (or row missing locally) — upsert without isRookie.
    if (local) {
      if (!tournamentRosterEntryMembershipEqual(prev, local)) {
        skippedNonRookieDrift += 1;
      }
      const { isRookie: _drop, ...rest } = local;
      byKey.set(key, rest);
    } else {
      const { isRookie: _drop, ...rest } = prev;
      byKey.set(key, rest);
    }
  }

  const upsert = [...byKey.values()];
  const anyClear = upsert.some((row) => !tournamentRosterRookieFlag(row));
  return {
    upsert,
    mode:
      upsert.length === 0
        ? 'empty'
        : anyClear || (args.baseline != null && args.baseline.length > 0)
          ? 'delta'
          : 'tagged-only',
    skippedNonRookieDrift,
  };
}

/** Overlay upserted rows onto a baseline ack set (by entry key). */
export function mergeTournamentRosterAckBaseline(
  baseline: TournamentRosterEntry[],
  upserted: TournamentRosterEntry[]
): TournamentRosterEntry[] {
  if (upserted.length === 0) return baseline;
  const byKey = new Map(
    baseline.map((row) => [tournamentRosterEntryKey(row), row])
  );
  for (const row of upserted) {
    byKey.set(tournamentRosterEntryKey(row), row);
  }
  return [...byKey.values()];
}

/**
 * Restore jersey numbers when next has silent `0` but trusted (cloud/baseline)
 * still has a non-zero. `0` is overloaded (real #0 vs default) — never treat a
 * reconcile/default 0 as authority over a known non-zero unless the key is in
 * `allowZeroForKeys` (explicit user edit to #0).
 */
export function preserveNonZeroJerseysFromTrusted(
  next: TournamentRosterEntry[],
  trusted: TournamentRosterEntry[] | null | undefined,
  options?: { allowZeroForKeys?: ReadonlySet<string> }
): { entries: TournamentRosterEntry[]; restoredCount: number } {
  if (!trusted || trusted.length === 0) {
    return { entries: next, restoredCount: 0 };
  }
  const trustedByKey = new Map(
    trusted.map((row) => [tournamentRosterEntryKey(row), row])
  );
  const allow = options?.allowZeroForKeys;
  let restoredCount = 0;
  const entries = next.map((row) => {
    const key = tournamentRosterEntryKey(row);
    if (allow?.has(key)) return row;
    if ((row.number ?? 0) !== 0) return row;
    const prev = trustedByKey.get(key);
    if (!prev || (prev.number ?? 0) === 0) return row;
    restoredCount += 1;
    return { ...row, number: prev.number };
  });
  return { entries, restoredCount };
}

/**
 * Upsert client rows; delete only explicit removals.
 * Never plan a tournament-scoped wipe of rows the client does not hold.
 *
 * When `baseline` is provided (last successfully acked cloud set), only upsert
 * rows that are new or changed — avoids full-league rewrite on small edits.
 * Pass `forceFullUpsert: true` (or omit baseline) for a full sync.
 *
 * Also restores silent `0` jerseys from baseline before planning (unless
 * `allowZeroForKeys`), so idle reconcile cannot write non-zero → 0.
 */
export function planTournamentRosterCloudWrite(args: {
  clientRows: TournamentRosterEntry[];
  pendingDeletes?: TournamentRosterDelete[];
  baseline?: TournamentRosterEntry[] | null;
  forceFullUpsert?: boolean;
  /** Keys (`tournamentId:teamId:playerId`) where user explicitly set jersey #0. */
  allowZeroForKeys?: ReadonlySet<string>;
}): TournamentRosterCloudWritePlan {
  const pendingDeletes = args.pendingDeletes ?? [];
  const deleteKeys = new Set(pendingDeletes.map(tournamentRosterDeleteKey));
  const filtered = args.clientRows.filter(
    (row) => !deleteKeys.has(tournamentRosterEntryKey(row))
  );
  const { entries: candidates } = preserveNonZeroJerseysFromTrusted(
    filtered,
    args.baseline,
    { allowZeroForKeys: args.allowZeroForKeys }
  );

  if (args.forceFullUpsert || args.baseline == null) {
    return { upsert: candidates, deletes: pendingDeletes };
  }

  const baselineByKey = new Map(
    args.baseline.map((row) => [tournamentRosterEntryKey(row), row])
  );
  const upsert = candidates.filter((row) => {
    const prev = baselineByKey.get(tournamentRosterEntryKey(row));
    if (!prev) return true;
    return !tournamentRosterEntryCloudEqual(prev, row);
  });
  return { upsert, deletes: pendingDeletes };
}

/**
 * One keep-team per (tournamentId, playerId) from the upsert set.
 * Persist must DELETE any other team_id for that pair in the cloud before
 * upsert — otherwise a stale other-club row the client never held still
 * violates tournament_rosters_tournament_id_player_id_key.
 */
export function collectUpsertKeepTeams(
  upsert: TournamentRosterEntry[]
): Array<{ tournamentId: string; playerId: string; keepTeamId: string }> {
  const byPair = new Map<
    string,
    { tournamentId: string; playerId: string; keepTeamId: string }
  >();
  for (const row of upsert) {
    const key = `${row.tournamentId}:${row.playerId}`;
    // Last write wins within a batch; callers should dedupe first.
    byPair.set(key, {
      tournamentId: row.tournamentId,
      playerId: row.playerId,
      keepTeamId: row.teamId,
    });
  }
  return [...byPair.values()];
}

/**
 * Given known cloud/local rows, which other-team rows must be deleted so the
 * upsert keep-team can land without unique (tournament_id, player_id) conflict.
 */
export function collectOtherTeamDeletesForUpsert(args: {
  upsert: TournamentRosterEntry[];
  existingRows: TournamentRosterEntry[];
}): TournamentRosterDelete[] {
  const keepByPair = new Map<string, string>();
  for (const keep of collectUpsertKeepTeams(args.upsert)) {
    keepByPair.set(
      `${keep.tournamentId}:${keep.playerId}`,
      keep.keepTeamId
    );
  }
  const out: TournamentRosterDelete[] = [];
  const seen = new Set<string>();
  for (const row of args.existingRows) {
    const pair = `${row.tournamentId}:${row.playerId}`;
    const keepTeamId = keepByPair.get(pair);
    if (!keepTeamId || row.teamId === keepTeamId) continue;
    const key = tournamentRosterDeleteKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      tournamentId: row.tournamentId,
      teamId: row.teamId,
      playerId: row.playerId,
    });
  }
  return out;
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
  gamesAheadOfCloud?: boolean;
}): { enableSaves: boolean; persistKind: 'full' | 'rosters-only' | null } {
  if (args.hadLocalEdits) {
    return {
      enableSaves: true,
      persistKind: args.cloudApplied ? 'full' : 'rosters-only',
    };
  }
  if (args.gamesAheadOfCloud) {
    return { enableSaves: true, persistKind: 'full' };
  }
  if (args.rostersAheadOfCloud) {
    return { enableSaves: true, persistKind: 'rosters-only' };
  }
  return { enableSaves: true, persistKind: null };
}
