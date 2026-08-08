/**
 * LE-95.5 — Link / unlink games to classification bracket slots.
 */

import type { Game } from '../App';
import type { TournamentStructure } from './tournamentStructure';
import { findBracketSlot } from './tournamentStructure';

export interface BracketLinkResult {
  structure: TournamentStructure;
  games: Game[];
}

function stageIdForSlot(
  structure: TournamentStructure,
  slotId: string
): string | undefined {
  for (const stage of structure.stages) {
    for (const round of stage.bracket?.rounds ?? []) {
      if (round.slots.some((s) => s.id === slotId)) return stage.id;
    }
  }
  return undefined;
}

function updateSlotGameId(
  structure: TournamentStructure,
  slotId: string,
  gameId: string | null
): TournamentStructure {
  return {
    stages: structure.stages.map((stage) => {
      if (!stage.bracket) return stage;
      return {
        ...stage,
        bracket: {
          rounds: stage.bracket.rounds.map((round) => ({
            ...round,
            slots: round.slots.map((slot) =>
              slot.id === slotId ? { ...slot, gameId } : slot
            ),
          })),
        },
      };
    }),
  };
}

function clearSlotIfGame(
  structure: TournamentStructure,
  gameId: string
): TournamentStructure {
  return {
    stages: structure.stages.map((stage) => {
      if (!stage.bracket) return stage;
      return {
        ...stage,
        bracket: {
          rounds: stage.bracket.rounds.map((round) => ({
            ...round,
            slots: round.slots.map((slot) =>
              slot.gameId === gameId ? { ...slot, gameId: null } : slot
            ),
          })),
        },
      };
    }),
  };
}

/** Link a game to a slot; clears prior links on that slot and that game. */
export function linkGameToBracketSlot(
  structure: TournamentStructure,
  games: Game[],
  slotId: string,
  gameId: string
): BracketLinkResult {
  const stageId = stageIdForSlot(structure, slotId);
  if (!stageId) {
    return { structure, games };
  }
  const game = games.find((g) => g.id === gameId);
  if (!game) {
    return { structure, games };
  }

  const existing = findBracketSlot(structure, slotId);
  let nextStructure = structure;
  let nextGames = games;

  // Unlink previous game on this slot
  if (existing?.gameId && existing.gameId !== gameId) {
    const prevId = existing.gameId;
    nextGames = nextGames.map((g) =>
      g.id === prevId
        ? { ...g, bracketSlotId: undefined, stageId: undefined, groupId: undefined }
        : g
    );
  }

  // Unlink this game from any other slot
  nextStructure = clearSlotIfGame(nextStructure, gameId);
  nextStructure = updateSlotGameId(nextStructure, slotId, gameId);

  nextGames = nextGames.map((g) => {
    if (g.id === gameId) {
      return {
        ...g,
        bracketSlotId: slotId,
        stageId,
        groupId: undefined,
      };
    }
    return g;
  });

  return { structure: nextStructure, games: nextGames };
}

export function unlinkGameFromBracketSlot(
  structure: TournamentStructure,
  games: Game[],
  slotId: string
): BracketLinkResult {
  const existing = findBracketSlot(structure, slotId);
  if (!existing?.gameId) {
    return { structure, games };
  }
  const gameId = existing.gameId;
  const nextStructure = updateSlotGameId(structure, slotId, null);
  const nextGames = games.map((g) =>
    g.id === gameId
      ? { ...g, bracketSlotId: undefined, stageId: undefined, groupId: undefined }
      : g
  );
  return { structure: nextStructure, games: nextGames };
}

/** Games eligible to link to a slot (same stage preferred; exclude other slots' links). */
export function gamesAvailableForBracketSlot(
  games: Game[],
  structure: TournamentStructure,
  stageId: string,
  slotId: string
): Game[] {
  const linkedElsewhere = new Set<string>();
  for (const stage of structure.stages) {
    for (const round of stage.bracket?.rounds ?? []) {
      for (const slot of round.slots) {
        if (slot.gameId && slot.id !== slotId) {
          linkedElsewhere.add(slot.gameId);
        }
      }
    }
  }

  const sameStage = games.filter(
    (g) =>
      g.stageId === stageId &&
      (!g.bracketSlotId || g.bracketSlotId === slotId) &&
      !linkedElsewhere.has(g.id)
  );
  if (sameStage.length > 0) return sameStage;

  // Fallback: any tournament game not linked elsewhere
  return games.filter(
    (g) =>
      (!g.bracketSlotId || g.bracketSlotId === slotId) &&
      !linkedElsewhere.has(g.id)
  );
}
