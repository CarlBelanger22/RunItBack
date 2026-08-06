/**
 * LE-95.5 — Auto-link IUBIT classification games into bracket slots.
 * Semis / 13–14: match by group finish labels (A1 vs D1, …).
 * Finals / placement: match by winners or losers of the two semis.
 */

import type { Game } from '../App';
import {
  linkGameToBracketSlot,
  type BracketLinkResult,
} from './bracketGameLink';
import {
  ensureClassificationBrackets,
} from './fourTeamBracket';
import {
  iubitClassificationBracketForStage,
} from './iubit2026Bracket';
import { computeGroupFinishPlaces } from './retagTournamentGames';
import type {
  BracketSlot,
  TournamentGroup,
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

function winnerLoserIds(
  game: Game
): { winnerId: string; loserId: string } | null {
  const score = resolveScore(game);
  if (!score) return null;
  if (score.home === score.away) return null;
  if (score.home > score.away) {
    return { winnerId: game.homeTeamId, loserId: game.awayTeamId };
  }
  return { winnerId: game.awayTeamId, loserId: game.homeTeamId };
}

function gameHasTeams(game: Game, a: string, b: string): boolean {
  const ids = new Set([game.homeTeamId, game.awayTeamId]);
  return ids.has(a) && ids.has(b);
}

function groupLetter(group: TournamentGroup): string | null {
  const fromName = group.name.match(/\b([A-D])\b/i)?.[1];
  if (fromName) return fromName.toUpperCase();
  const fromId = group.id.match(/(?:^|[-_])([abcd])(?:$|[-_])/i)?.[1];
  return fromId ? fromId.toUpperCase() : null;
}

/** Map "A1" → teamId from group finish places. */
export function resolveSeedTeamId(
  code: string,
  groups: TournamentGroup[],
  placesByTeam: Map<string, number>
): string | null {
  const m = code.trim().match(/^([A-D])([1-4])$/i);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const place = Number(m[2]);
  const group = groups.find((g) => groupLetter(g) === letter);
  if (!group) return null;
  for (const teamId of group.teamIds) {
    if (placesByTeam.get(teamId) === place) return teamId;
  }
  return null;
}

function parseSeedMatchup(label: string | undefined): [string, string] | null {
  if (!label) return null;
  const m = label.match(/^([A-D][1-4])\s+vs\s+([A-D][1-4])$/i);
  if (!m) return null;
  return [m[1].toUpperCase(), m[2].toUpperCase()];
}

function findGameForTeams(
  games: Game[],
  teamA: string,
  teamB: string,
  usedGameIds: Set<string>
): Game | undefined {
  return games.find(
    (g) => !usedGameIds.has(g.id) && gameHasTeams(g, teamA, teamB)
  );
}

type SlotPlan =
  | { kind: 'seed'; slotId: string; codeA: string; codeB: string }
  | {
      kind: 'from_semis';
      slotId: string;
      pick: 'winners' | 'losers';
      semiSlotIds: [string, string];
    };

function plansForStage(stageId: string): SlotPlan[] {
  const bracket = iubitClassificationBracketForStage(stageId);
  if (!bracket) return [];
  const plans: SlotPlan[] = [];
  const semiIds: string[] = [];

  for (const round of bracket.rounds) {
    for (const slot of round.slots) {
      const seeds = parseSeedMatchup(slot.label);
      if (seeds) {
        plans.push({
          kind: 'seed',
          slotId: slot.id,
          codeA: seeds[0],
          codeB: seeds[1],
        });
        if (round.name.toLowerCase().includes('semi')) {
          semiIds.push(slot.id);
        }
        continue;
      }
      // Finals / placement derived from semis
      if (semiIds.length === 2) {
        const label = (slot.label ?? '').toLowerCase();
        const winners =
          label.includes('final') ||
          label.includes('5th') ||
          label.includes('9th');
        const losers =
          label.includes('3rd') ||
          label.includes('7th') ||
          label.includes('11th');
        if (winners) {
          plans.push({
            kind: 'from_semis',
            slotId: slot.id,
            pick: 'winners',
            semiSlotIds: [semiIds[0], semiIds[1]],
          });
        } else if (losers) {
          plans.push({
            kind: 'from_semis',
            slotId: slot.id,
            pick: 'losers',
            semiSlotIds: [semiIds[0], semiIds[1]],
          });
        }
      }
    }
  }
  return plans;
}

function slotById(
  structure: TournamentStructure,
  slotId: string
): BracketSlot | undefined {
  for (const stage of structure.stages) {
    for (const round of stage.bracket?.rounds ?? []) {
      const hit = round.slots.find((s) => s.id === slotId);
      if (hit) return hit;
    }
  }
  return undefined;
}

/**
 * Ensure IUBIT slots exist, then link matching tournament games.
 * Skips slots that already have a gameId.
 */
export function autoLinkIubitBracketGames(
  structureInput: TournamentStructure | undefined,
  allGames: Game[],
  tournamentId: string
): AutoLinkResult {
  const report: AutoLinkReport = { linked: 0, skipped: 0, details: [] };
  let structure = normalizeTournamentStructure(structureInput);
  if (!structure) {
    report.details.push('No structure');
    return { structure: { stages: [] }, games: allGames, report };
  }

  structure = ensureClassificationBrackets(structure);
  const tournamentGames = allGames.filter((g) => g.tournamentId === tournamentId);
  let games = allGames;

  const rrStage = structure.stages.find((s) => s.kind === 'round_robin');
  const groups = rrStage?.groups ?? [];
  const placesByTeam = new Map<string, number>();
  for (const group of groups) {
    const places = computeGroupFinishPlaces(group, tournamentGames, structure);
    for (const [teamId, place] of places) {
      placesByTeam.set(teamId, place);
    }
  }

  const usedGameIds = new Set<string>();
  for (const stage of structure.stages) {
    for (const round of stage.bracket?.rounds ?? []) {
      for (const slot of round.slots) {
        if (slot.gameId) usedGameIds.add(slot.gameId);
      }
    }
  }

  // Seed slots first, then derived (so semis are linked before Final/3rd).
  const classification = structure.stages
    .filter((s) => s.kind === 'classification')
    .sort((a, b) => a.order - b.order);

  for (const stage of classification) {
    const plans = plansForStage(stage.id);
    const seedPlans = plans.filter((p) => p.kind === 'seed');
    const derivedPlans = plans.filter((p) => p.kind === 'from_semis');

    for (const plan of [...seedPlans, ...derivedPlans]) {
      const existing = slotById(structure, plan.slotId);
      if (existing?.gameId) {
        report.skipped += 1;
        report.details.push(`Skip ${plan.slotId}: already linked`);
        continue;
      }

      let teamA: string | null = null;
      let teamB: string | null = null;

      if (plan.kind === 'seed') {
        teamA = resolveSeedTeamId(plan.codeA, groups, placesByTeam);
        teamB = resolveSeedTeamId(plan.codeB, groups, placesByTeam);
        if (!teamA || !teamB) {
          report.skipped += 1;
          report.details.push(
            `Skip ${plan.slotId}: unresolved ${plan.codeA}/${plan.codeB}`
          );
          continue;
        }
      } else {
        const g0 = slotById(structure, plan.semiSlotIds[0])?.gameId;
        const g1 = slotById(structure, plan.semiSlotIds[1])?.gameId;
        const game0 = g0 ? games.find((g) => g.id === g0) : undefined;
        const game1 = g1 ? games.find((g) => g.id === g1) : undefined;
        if (!game0 || !game1) {
          report.skipped += 1;
          report.details.push(`Skip ${plan.slotId}: semis not linked`);
          continue;
        }
        const wl0 = winnerLoserIds(game0);
        const wl1 = winnerLoserIds(game1);
        if (!wl0 || !wl1) {
          report.skipped += 1;
          report.details.push(`Skip ${plan.slotId}: missing semi scores`);
          continue;
        }
        if (plan.pick === 'winners') {
          teamA = wl0.winnerId;
          teamB = wl1.winnerId;
        } else {
          teamA = wl0.loserId;
          teamB = wl1.loserId;
        }
      }

      const match = findGameForTeams(
        tournamentGames,
        teamA,
        teamB,
        usedGameIds
      );
      if (!match) {
        report.skipped += 1;
        report.details.push(
          `Skip ${plan.slotId}: no game for ${teamA} vs ${teamB}`
        );
        continue;
      }

      const linked = linkGameToBracketSlot(
        structure,
        games,
        plan.slotId,
        match.id
      );
      structure = linked.structure;
      games = linked.games;
      usedGameIds.add(match.id);
      report.linked += 1;
      report.details.push(`Linked ${plan.slotId} → ${match.id}`);
    }
  }

  return { structure, games, report };
}
