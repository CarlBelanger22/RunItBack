/**
 * LE-115 — Resolve Winner/Loser feeders into team ids (display-time; no persist).
 */

import type { Game } from '../App';
import { pickGameForMatchup } from './matchupGamePick';
import {
  linkGameToBracketSlot,
  type BracketLinkResult,
} from './bracketGameLink';
import type {
  BracketRound,
  BracketSlot,
  TournamentStructure,
} from './tournamentStructure';
import { normalizeTournamentStructure } from './tournamentStructure';

export interface AutoLinkReport {
  linked: number;
  skipped: number;
  details: string[];
}

export interface AutoLinkResult extends BracketLinkResult {
  report: AutoLinkReport;
}

function resolveScore(game: Game): { home: number; away: number } | null {
  if (game.finalScore) return game.finalScore;
  const home = game.teamStats?.home?.total_points;
  const away = game.teamStats?.away?.total_points;
  if (typeof home === 'number' && typeof away === 'number') {
    return { home, away };
  }
  return null;
}

/** Winner/loser when game has a decided (non-tie) score. */
export function winnerLoserTeamIds(
  game: Game
): { winnerId: string; loserId: string } | null {
  const score = resolveScore(game);
  if (!score || score.home === score.away) return null;
  if (score.home > score.away) {
    return { winnerId: game.homeTeamId, loserId: game.awayTeamId };
  }
  return { winnerId: game.awayTeamId, loserId: game.homeTeamId };
}

function findSlotInRounds(
  rounds: BracketRound[],
  slotId: string
): BracketSlot | undefined {
  for (const round of rounds) {
    const hit = round.slots.find((s) => s.id === slotId);
    if (hit) return hit;
  }
  return undefined;
}

export type BracketSide = 'home' | 'away';

/**
 * Resolve one side of a slot to a team id.
 * Priority: linked feeder game outcome → explicit slot team id.
 * Does not persist; pure read of structure + games.
 */
export function resolveBracketSideTeamId(
  slot: BracketSlot,
  side: BracketSide,
  rounds: BracketRound[],
  gameById: Map<string, Game>,
  visiting: Set<string> = new Set()
): string | null {
  const fromSlotId =
    side === 'home' ? slot.homeFromSlotId : slot.awayFromSlotId;
  const outcome =
    side === 'home' ? slot.homeFromOutcome : slot.awayFromOutcome;
  const storedId = side === 'home' ? slot.homeTeamId : slot.awayTeamId;

  if (fromSlotId) {
    if (visiting.has(fromSlotId)) return null;
    visiting.add(fromSlotId);

    const feeder = findSlotInRounds(rounds, fromSlotId);
    if (!feeder) {
      visiting.delete(fromSlotId);
      return null;
    }

    // Prefer completed feeder game
    if (feeder.gameId) {
      const game = gameById.get(feeder.gameId);
      if (game) {
        const wl = winnerLoserTeamIds(game);
        visiting.delete(fromSlotId);
        if (!wl) return null;
        return (outcome === 'loser' ? wl.loserId : wl.winnerId) || null;
      }
    }

    // Recurse if feeder sides are themselves feeders / seeds (rare)
    const homeId = resolveBracketSideTeamId(
      feeder,
      'home',
      rounds,
      gameById,
      visiting
    );
    const awayId = resolveBracketSideTeamId(
      feeder,
      'away',
      rounds,
      gameById,
      visiting
    );
    visiting.delete(fromSlotId);
    // Without a game we cannot pick winner/loser between homeId/awayId
    void homeId;
    void awayId;
    return null;
  }

  return storedId ?? null;
}

export function resolveBracketSlotTeamIds(
  slot: BracketSlot,
  rounds: BracketRound[],
  gameById: Map<string, Game>
): { homeTeamId: string | null; awayTeamId: string | null } {
  return {
    homeTeamId: resolveBracketSideTeamId(slot, 'home', rounds, gameById),
    awayTeamId: resolveBracketSideTeamId(slot, 'away', rounds, gameById),
  };
}

/**
 * Link empty slots when both sides resolve to team ids and a matching
 * tournament game exists (generic — Format A, custom placement, etc.).
 * LE-116: when teams met more than once, prefer the **latest** game (KO rematch).
 */
export function autoLinkBracketByResolvedTeams(
  structureInput: TournamentStructure | undefined,
  allGames: Game[],
  tournamentId: string
): AutoLinkResult {
  const structure = normalizeTournamentStructure(structureInput);
  const report: AutoLinkReport = {
    linked: 0,
    skipped: 0,
    details: [],
  };
  if (!structure) {
    return { structure: { stages: [] }, games: allGames, report };
  }

  const tournamentGames = allGames.filter((g) => g.tournamentId === tournamentId);
  const gameById = new Map(tournamentGames.map((g) => [g.id, g]));

  let nextStructure = structure;
  let nextGames = allGames;
  const usedGameIds = new Set<string>();
  for (const stage of nextStructure.stages) {
    for (const round of stage.bracket?.rounds ?? []) {
      for (const slot of round.slots) {
        if (slot.gameId) usedGameIds.add(slot.gameId);
      }
    }
  }

  for (const stage of nextStructure.stages) {
    if (stage.kind !== 'classification' || !stage.bracket) continue;
    // Multi-pass: later rounds need earlier slots' gameIds from this run.
    // Re-read rounds from nextStructure each iteration (avoid stale feeder refs).
    let passLinked = 0;
    do {
      passLinked = 0;
      const stageNow = nextStructure.stages.find((s) => s.id === stage.id);
      if (!stageNow?.bracket) break;
      const rounds = stageNow.bracket.rounds;

      for (const round of rounds) {
        for (const slot of round.slots) {
          let homeTeamId: string | null = null;
          let awayTeamId: string | null = null;

          if (slot.gameId) {
            const current = gameById.get(slot.gameId);
            if (current) {
              homeTeamId = current.homeTeamId;
              awayTeamId = current.awayTeamId;
              const excludeForUpgrade = new Set(usedGameIds);
              excludeForUpgrade.delete(slot.gameId);
              const latest = pickGameForMatchup(
                tournamentGames,
                homeTeamId,
                awayTeamId,
                'latest',
                excludeForUpgrade
              );
              if (latest && latest.id !== slot.gameId) {
                usedGameIds.delete(slot.gameId);
                const linked = linkGameToBracketSlot(
                  nextStructure,
                  nextGames,
                  slot.id,
                  latest.id
                );
                nextStructure = linked.structure;
                nextGames = linked.games;
                usedGameIds.add(latest.id);
                gameById.set(latest.id, latest);
                report.linked += 1;
                passLinked += 1;
                report.details.push(
                  `Upgraded ${slot.label ?? slot.id}: ${slot.gameId} → ${latest.id} (later rematch)`
                );
              }
            }
            continue;
          }

          const resolved = resolveBracketSlotTeamIds(slot, rounds, gameById);
          homeTeamId = resolved.homeTeamId;
          awayTeamId = resolved.awayTeamId;
          if (!homeTeamId || !awayTeamId) {
            continue;
          }
          const match = pickGameForMatchup(
            tournamentGames,
            homeTeamId,
            awayTeamId,
            'latest',
            usedGameIds
          );
          if (!match) {
            report.details.push(
              `No game for ${slot.label ?? slot.id} (${homeTeamId} vs ${awayTeamId})`
            );
            continue;
          }
          const linked = linkGameToBracketSlot(
            nextStructure,
            nextGames,
            slot.id,
            match.id
          );
          nextStructure = linked.structure;
          nextGames = linked.games;
          usedGameIds.add(match.id);
          report.linked += 1;
          passLinked += 1;
          report.details.push(
            `Linked ${match.id} → ${slot.label ?? slot.id}`
          );
        }
      }
    } while (passLinked > 0);
  }

  // Recount skips for empty still-unlinked classification slots
  for (const stage of nextStructure.stages) {
    if (stage.kind !== 'classification' || !stage.bracket) continue;
    for (const round of stage.bracket.rounds) {
      for (const slot of round.slots) {
        if (!slot.gameId) report.skipped += 1;
      }
    }
  }

  return {
    structure: normalizeTournamentStructure(nextStructure) ?? nextStructure,
    games: nextGames,
    report,
  };
}
