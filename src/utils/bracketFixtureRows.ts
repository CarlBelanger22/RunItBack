/**
 * LE-146 — Bracket slot fixtures for tournament Games tab (A1 vs B2, Final, …).
 */

import type { Game, Team } from '../App';
import { bracketPlaceholderSides } from './bracketPlaceholderSides';
import type { TournamentFixtureRow } from './groupMatchRows';
import { sortGamesTabEntries } from './groupMatchRows';
import { resolveBracketSideTeamId } from './resolveBracketFeeders';
import {
  applyBracketSlotSchedule,
  resolveBracketSlotDateTime,
} from './sunig2026BracketSchedule';
import type { BracketSlot, TournamentStructure } from './tournamentStructure';
import { normalizeTournamentStructure } from './tournamentStructure';

function slotHasGameRow(
  slot: BracketSlot,
  games: Game[],
  gameById: Map<string, Game>
): boolean {
  if (slot.gameId) {
    const linked = gameById.get(slot.gameId);
    if (linked) return true;
  }
  return games.some((g) => g.bracketSlotId === slot.id);
}

export function buildBracketFixtureRows(
  structureInput: TournamentStructure | undefined,
  allGames: Game[],
  teamById: Map<string, Team>
): TournamentFixtureRow[] {
  const structure = normalizeTournamentStructure(structureInput);
  if (!structure) return [];

  const gameById = new Map(allGames.map((g) => [g.id, g]));
  const fixtures: TournamentFixtureRow[] = [];

  for (const stage of structure.stages) {
    if (stage.kind !== 'classification' || !stage.bracket) continue;
    const rounds = stage.bracket.rounds;

    for (const round of rounds) {
      for (const slot of round.slots) {
        if (slot.inactive) continue;
        if (slotHasGameRow(slot, allGames, gameById)) continue;

        const [homeLabel, awayLabel] = bracketPlaceholderSides(slot, rounds);
        const { date, startTime } = resolveBracketSlotDateTime(slot);
        const homeId =
          resolveBracketSideTeamId(slot, 'home', rounds, gameById) ??
          slot.homeTeamId ??
          null;
        const awayId =
          resolveBracketSideTeamId(slot, 'away', rounds, gameById) ??
          slot.awayTeamId ??
          null;

        fixtures.push({
          key: `bracket-${slot.id}`,
          homeLabel,
          awayLabel,
          homeTeam: homeId ? teamById.get(homeId) : undefined,
          awayTeam: awayId ? teamById.get(awayId) : undefined,
          date,
          startTime,
          isPlaceholder: !homeId || !awayId,
          stageId: stage.id,
          bracketSlotId: slot.id,
          slotLabel: slot.label,
          roundName: round.name,
        });
      }
    }
  }

  return sortGamesTabEntries(fixtures);
}
