/**
 * Once the group stage is locked, a bracket slot or seed matchup that already
 * has both clubs and a date becomes a saved unplayed game so Track stats can
 * open it. A second run does not create another game.
 */

import type { Game, Team, TeamStats } from '../App';
import { linkGameToBracketSlot } from './bracketGameLink';
import { isSeedPlaceholderTeamId } from './groupMembers';
import { resolveGroupSeedMatchups } from './groupMatchRows';
import { matchupPairKey } from './matchupGamePick';
import { defaultClockForTournament, formatPeriodClock } from './gameClock';
import {
  resolveBracketSideTeamId,
  type BracketSide,
} from './resolveBracketFeeders';
import { normalizeSeedCode } from './seedCodes';
import { resolveBracketSlotDateTime } from './sunig2026BracketSchedule';
import type {
  BracketRound,
  BracketSlot,
  GroupSeedMatchup,
  TournamentStructure,
} from './tournamentStructure';
import { normalizeTournamentStructure } from './tournamentStructure';

export interface EnsureScheduledReport {
  created: number;
  linked: number;
  details: string[];
}

export interface EnsureScheduledResult {
  structure: TournamentStructure;
  games: Game[];
  report: EnsureScheduledReport;
}

function emptyTeamStats(teamId: string): TeamStats {
  return {
    teamId,
    q1_points: 0,
    q2_points: 0,
    q3_points: 0,
    q4_points: 0,
    ot_points: 0,
    total_points: 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    two_made: 0,
    two_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    team_rebounds: 0,
    total_rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    points_off_turnovers: null,
    points_in_paint: null,
    second_chance_points: null,
    fastbreak_points: null,
    bench_points: null,
    biggest_lead: null,
    biggest_scoring_run: null,
    team_coach: { orb: 0, drb: 0, turnovers: 0, fouls: 0 },
  };
}

function day(value: string | undefined): string {
  return (value ?? '').slice(0, 10);
}

function samePair(game: Game, homeId: string, awayId: string): boolean {
  return matchupPairKey(game.homeTeamId, game.awayTeamId) === matchupPairKey(homeId, awayId);
}

function scheduledGame(args: {
  id: string;
  tournamentId: string;
  home: Team;
  away: Team;
  date: string;
  startTime?: string;
  stageId: string;
  groupId?: string;
  bracketSlotId?: string;
}): Game {
  const clock = defaultClockForTournament(args.tournamentId);
  return {
    id: args.id,
    homeTeam: { ...args.home, players: [...args.home.players] },
    awayTeam: { ...args.away, players: [...args.away.players] },
    homeTeamId: args.home.id,
    awayTeamId: args.away.id,
    tournamentId: args.tournamentId,
    date: args.date,
    startTime: args.startTime || undefined,
    clockSettings: clock,
    gameStats: [],
    teamStats: {
      home: emptyTeamStats(args.home.id),
      away: emptyTeamStats(args.away.id),
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: formatPeriodClock(clock.regulationPeriodMinutes),
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    stageId: args.stageId,
    groupId: args.groupId,
    bracketSlotId: args.bracketSlotId,
    isActive: false,
    isPaused: false,
    isCompleted: false,
  };
}

function sideTeamId(
  slot: BracketSlot,
  side: BracketSide,
  rounds: BracketRound[],
  gameById: Map<string, Game>,
  snapshot: Record<string, string> | undefined
): string | null {
  const fromFeeder = side === 'home' ? slot.homeFromSlotId : slot.awayFromSlotId;
  if (fromFeeder) {
    const resolved = resolveBracketSideTeamId(slot, side, rounds, gameById);
    if (!resolved || isSeedPlaceholderTeamId(resolved)) return null;
    return resolved;
  }
  const stored = side === 'home' ? slot.homeTeamId : slot.awayTeamId;
  if (stored && !isSeedPlaceholderTeamId(stored)) return stored;
  const label = side === 'home' ? slot.homeSeedLabel : slot.awaySeedLabel;
  const code = label ? normalizeSeedCode(label) : null;
  const fromSnapshot = code ? snapshot?.[code] : undefined;
  return fromSnapshot || null;
}

export function ensureScheduledFixtureGames(
  structureInput: TournamentStructure | undefined,
  allGames: Game[],
  tournamentId: string,
  teams: Team[]
): EnsureScheduledResult {
  const structure = normalizeTournamentStructure(structureInput);
  const report: EnsureScheduledReport = { created: 0, linked: 0, details: [] };
  if (!structure?.groupStageLocked) {
    return {
      structure: structure ?? { stages: [] },
      games: allGames,
      report,
    };
  }

  const teamById = new Map(teams.map((team) => [team.id, team]));
  let nextStructure = structure;
  let nextGames = allGames;
  const snapshot = nextStructure.seedSnapshot;

  const realTeam = (id: string | null): Team | undefined => {
    if (!id || isSeedPlaceholderTeamId(id)) return undefined;
    return teamById.get(id);
  };

  const tournamentGames = () =>
    nextGames.filter((game) => game.tournamentId === tournamentId);

  const sameDateGame = (homeId: string, awayId: string, date: string) =>
    tournamentGames().find(
      (game) => samePair(game, homeId, awayId) && day(game.date) === day(date)
    );

  for (const stage of nextStructure.stages) {
    if (stage.kind !== 'classification' || !stage.bracket) continue;
    const rounds = stage.bracket.rounds;
    for (const round of rounds) {
      for (const slot of round.slots) {
        if (slot.inactive) continue;
        const gameById = new Map(nextGames.map((game) => [game.id, game]));
        const homeId = sideTeamId(slot, 'home', rounds, gameById, snapshot);
        const awayId = sideTeamId(slot, 'away', rounds, gameById, snapshot);
        const home = realTeam(homeId);
        const away = realTeam(awayId);
        if (!home || !away || home.id === away.id) continue;

        const { date, startTime } = resolveBracketSlotDateTime(slot);
        if (!date) continue;

        const linked = slot.gameId
          ? nextGames.find((game) => game.id === slot.gameId)
          : undefined;
        const tagged = nextGames.find(
          (game) =>
            game.tournamentId === tournamentId && game.bracketSlotId === slot.id
        );
        if (linked || tagged) {
          if (slot.gameId !== (linked ?? tagged)!.id) {
            const attached = linkGameToBracketSlot(
              nextStructure,
              nextGames,
              slot.id,
              (linked ?? tagged)!.id
            );
            nextStructure = attached.structure;
            nextGames = attached.games;
            report.linked += 1;
            report.details.push(
              `Linked ${(linked ?? tagged)!.id} → ${slot.label ?? slot.id}`
            );
          }
          continue;
        }

        const existing = sameDateGame(home.id, away.id, date);
        if (
          existing &&
          (!existing.bracketSlotId || existing.bracketSlotId === slot.id)
        ) {
          const attached = linkGameToBracketSlot(
            nextStructure,
            nextGames,
            slot.id,
            existing.id
          );
          nextStructure = attached.structure;
          nextGames = attached.games;
          report.linked += 1;
          report.details.push(
            `Linked ${existing.id} → ${slot.label ?? slot.id}`
          );
          continue;
        }

        const createdId = `game-sched-${slot.id}`;
        if (nextGames.some((game) => game.id === createdId)) {
          const attached = linkGameToBracketSlot(
            nextStructure,
            nextGames,
            slot.id,
            createdId
          );
          nextStructure = attached.structure;
          nextGames = attached.games;
          report.linked += 1;
          report.details.push(`Linked ${createdId} → ${slot.label ?? slot.id}`);
          continue;
        }
        const created = scheduledGame({
          id: createdId,
          tournamentId,
          home,
          away,
          date,
          startTime,
          stageId: stage.id,
          bracketSlotId: slot.id,
        });
        nextGames = [...nextGames, created];
        const attached = linkGameToBracketSlot(
          nextStructure,
          nextGames,
          slot.id,
          created.id
        );
        nextStructure = attached.structure;
        nextGames = attached.games;
        report.created += 1;
        report.details.push(
          `Created ${created.id} → ${slot.label ?? slot.id}`
        );
      }
    }
  }

  nextStructure = {
    ...nextStructure,
    stages: nextStructure.stages.map((stage) => {
      if (stage.kind !== 'round_robin') return stage;
      const groups = (stage.groups ?? []).map((group) => {
        const matchups = resolveGroupSeedMatchups(group);
        if (matchups.length === 0) return group;
        let groupChanged = false;
        const nextMatchups: GroupSeedMatchup[] = matchups.map((matchup) => {
          const homeCode = normalizeSeedCode(matchup.homeSeed);
          const awayCode = normalizeSeedCode(matchup.awaySeed);
          const home = realTeam(homeCode ? snapshot?.[homeCode] : null);
          const away = realTeam(awayCode ? snapshot?.[awayCode] : null);
          if (!home || !away || !matchup.date || home.id === away.id) return matchup;
          const linked = matchup.gameId
            ? nextGames.find((game) => game.id === matchup.gameId)
            : undefined;
          if (linked) return matchup;
          const existing = sameDateGame(home.id, away.id, matchup.date);
          if (
            existing &&
            (!existing.bracketSlotId || existing.groupId === group.id)
          ) {
            if (!existing.groupId || existing.groupId === group.id) {
              nextGames = nextGames.map((game) =>
                game.id === existing.id
                  ? { ...game, stageId: stage.id, groupId: group.id }
                  : game
              );
            }
            report.linked += 1;
            report.details.push(
              `Linked ${existing.id} → ${matchup.homeSeed} vs ${matchup.awaySeed}`
            );
            groupChanged = true;
            return { ...matchup, gameId: existing.id };
          }
          const id = `game-sched-${group.id}-${matchup.homeSeed}-${matchup.awaySeed}`;
          if (nextGames.some((game) => game.id === id)) {
            report.linked += 1;
            report.details.push(
              `Linked ${id} → ${matchup.homeSeed} vs ${matchup.awaySeed}`
            );
            groupChanged = true;
            return { ...matchup, gameId: id };
          }
          nextGames = [
            ...nextGames,
            scheduledGame({
              id,
              tournamentId,
              home,
              away,
              date: matchup.date,
              startTime: matchup.startTime,
              stageId: stage.id,
              groupId: group.id,
            }),
          ];
          report.created += 1;
          report.details.push(
            `Created ${id} → ${matchup.homeSeed} vs ${matchup.awaySeed}`
          );
          groupChanged = true;
          return { ...matchup, gameId: id };
        });
        if (!groupChanged) return group;
        return { ...group, seedMatchups: nextMatchups };
      });
      return { ...stage, groups };
    }),
  };

  return { structure: nextStructure, games: nextGames, report };
}
