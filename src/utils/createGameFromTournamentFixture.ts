/**
 * Admin Track stats on an Upcoming fixture: create (or reuse) one unplayed
 * tournament game, link it to the bracket slot / seed matchup, then return it
 * for stats-entry prefill. Does not invent games until the admin clicks.
 */

import type { Game, Team, TeamStats } from '../App';
import { linkGameToBracketSlot } from './bracketGameLink';
import { isSeedPlaceholderTeamId } from './groupMembers';
import type { TournamentFixtureRow } from './groupMatchRows';
import { matchupPairKey } from './matchupGamePick';
import { defaultClockForTournament, formatPeriodClock } from './gameClock';
import { normalizeSeedCode } from './seedCodes';
import type { TournamentStructure } from './tournamentStructure';
import { normalizeTournamentStructure } from './tournamentStructure';

export interface CreateGameFromFixtureResult {
  structure: TournamentStructure;
  games: Game[];
  game: Game;
  created: boolean;
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

function samePair(game: Game, homeId: string, awayId: string): boolean {
  return (
    matchupPairKey(game.homeTeamId, game.awayTeamId) ===
    matchupPairKey(homeId, awayId)
  );
}

function buildUnplayedGame(args: {
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

function linkSeedMatchupGameId(
  structure: TournamentStructure,
  groupId: string,
  homeSeed: string,
  awaySeed: string,
  gameId: string
): TournamentStructure {
  const homeCode = normalizeSeedCode(homeSeed);
  const awayCode = normalizeSeedCode(awaySeed);
  return {
    ...structure,
    stages: structure.stages.map((stage) => {
      if (stage.kind !== 'round_robin') return stage;
      return {
        ...stage,
        groups: (stage.groups ?? []).map((group) => {
          if (group.id !== groupId) return group;
          const matchups = group.seedMatchups;
          if (!matchups?.length) {
            return {
              ...group,
              seedMatchups: [
                {
                  homeSeed: homeCode ?? homeSeed,
                  awaySeed: awayCode ?? awaySeed,
                  gameId,
                },
              ],
            };
          }
          return {
            ...group,
            seedMatchups: matchups.map((m) => {
              const mh = normalizeSeedCode(m.homeSeed);
              const ma = normalizeSeedCode(m.awaySeed);
              if (mh === homeCode && ma === awayCode) {
                return { ...m, gameId };
              }
              return m;
            }),
          };
        }),
      };
    }),
  };
}

function linkTeamMatchupGameId(
  structure: TournamentStructure,
  groupId: string,
  homeTeamId: string,
  awayTeamId: string,
  date: string | undefined,
  gameId: string
): TournamentStructure {
  const day = (date ?? '').slice(0, 10);
  return {
    ...structure,
    stages: structure.stages.map((stage) => {
      if (stage.kind !== 'round_robin') return stage;
      return {
        ...stage,
        groups: (stage.groups ?? []).map((group) => {
          if (group.id !== groupId) return group;
          const matchups = group.teamMatchups ?? [];
          return {
            ...group,
            teamMatchups: matchups.map((m) => {
              if (m.homeTeamId !== homeTeamId || m.awayTeamId !== awayTeamId) {
                return m;
              }
              if (day && (m.date ?? '').slice(0, 10) !== day) return m;
              return { ...m, gameId };
            }),
          };
        }),
      };
    }),
  };
}

/** Both clubs present and not seed placeholders. */
export function fixtureCanTrackStats(fixture: TournamentFixtureRow): boolean {
  const home = fixture.homeTeam;
  const away = fixture.awayTeam;
  if (!home || !away) return false;
  if (fixture.isPlaceholder) return false;
  if (isSeedPlaceholderTeamId(home.id) || isSeedPlaceholderTeamId(away.id)) {
    return false;
  }
  return home.id !== away.id;
}

/**
 * Create or reuse an unplayed game for a Games-tab fixture, and link it to the
 * structure slot / seed matchup when possible.
 */
export function createGameFromTournamentFixture(
  structureInput: TournamentStructure | undefined,
  allGames: Game[],
  tournamentId: string,
  fixture: TournamentFixtureRow
): CreateGameFromFixtureResult {
  const structure = normalizeTournamentStructure(structureInput) ?? {
    stages: [],
  };
  if (!fixtureCanTrackStats(fixture)) {
    throw new Error('Fixture needs two real teams before Track stats');
  }
  const home = fixture.homeTeam!;
  const away = fixture.awayTeam!;
  const date = (fixture.date ?? '').trim();
  const startTime = fixture.startTime?.trim() || undefined;
  const tournamentGames = allGames.filter((g) => g.tournamentId === tournamentId);

  const findReusable = (opts: {
    bracketSlotId?: string;
    groupId?: string;
  }): Game | undefined => {
    if (opts.bracketSlotId) {
      const tagged = tournamentGames.find(
        (g) => g.bracketSlotId === opts.bracketSlotId
      );
      if (tagged) return tagged;
    }
    return tournamentGames.find((g) => {
      if (!samePair(g, home.id, away.id)) return false;
      if (g.isCompleted || g.isActive) return false;
      if (opts.bracketSlotId) {
        return !g.bracketSlotId || g.bracketSlotId === opts.bracketSlotId;
      }
      if (opts.groupId) {
        return !g.groupId || g.groupId === opts.groupId;
      }
      return !g.bracketSlotId;
    });
  };

  if (fixture.bracketSlotId) {
    const slotId = fixture.bracketSlotId;
    const existing = findReusable({ bracketSlotId: slotId });
    if (existing) {
      const attached = linkGameToBracketSlot(
        structure,
        allGames,
        slotId,
        existing.id
      );
      const game =
        attached.games.find((g) => g.id === existing.id) ?? existing;
      return {
        structure: attached.structure,
        games: attached.games,
        game,
        created: false,
      };
    }
    const id = `game-sched-${slotId}`;
    const already = allGames.find((g) => g.id === id);
    if (already) {
      const attached = linkGameToBracketSlot(structure, allGames, slotId, id);
      return {
        structure: attached.structure,
        games: attached.games,
        game: attached.games.find((g) => g.id === id) ?? already,
        created: false,
      };
    }
    const created = buildUnplayedGame({
      id,
      tournamentId,
      home,
      away,
      date,
      startTime,
      stageId: fixture.stageId,
      bracketSlotId: slotId,
    });
    const nextGames = [...allGames, created];
    const attached = linkGameToBracketSlot(
      structure,
      nextGames,
      slotId,
      created.id
    );
    return {
      structure: attached.structure,
      games: attached.games,
      game: attached.games.find((g) => g.id === created.id) ?? created,
      created: true,
    };
  }

  if (fixture.groupId) {
    const groupId = fixture.groupId;

    if (fixture.teamMatchup) {
      const existing = findReusable({ groupId });
      if (existing) {
        const taggedGames = allGames.map((g) =>
          g.id === existing.id
            ? { ...g, stageId: fixture.stageId, groupId }
            : g
        );
        return {
          structure: linkTeamMatchupGameId(
            structure,
            groupId,
            home.id,
            away.id,
            date,
            existing.id
          ),
          games: taggedGames,
          game: taggedGames.find((g) => g.id === existing.id) ?? existing,
          created: false,
        };
      }
      const id = `game-sched-${groupId}-${home.id}-${away.id}-${date || 'nodate'}`;
      const already = allGames.find((g) => g.id === id);
      if (already) {
        const taggedGames = allGames.map((g) =>
          g.id === already.id
            ? { ...g, stageId: fixture.stageId, groupId }
            : g
        );
        return {
          structure: linkTeamMatchupGameId(
            structure,
            groupId,
            home.id,
            away.id,
            date,
            id
          ),
          games: taggedGames,
          game: taggedGames.find((g) => g.id === id) ?? already,
          created: false,
        };
      }
      const created = buildUnplayedGame({
        id,
        tournamentId,
        home,
        away,
        date,
        startTime,
        stageId: fixture.stageId,
        groupId,
      });
      return {
        structure: linkTeamMatchupGameId(
          structure,
          groupId,
          home.id,
          away.id,
          date,
          created.id
        ),
        games: [...allGames, created],
        game: created,
        created: true,
      };
    }

    const homeSeed = fixture.homeLabel;
    const awaySeed = fixture.awayLabel;
    const existing = findReusable({ groupId });
    if (existing) {
      const taggedGames = allGames.map((g) =>
        g.id === existing.id
          ? { ...g, stageId: fixture.stageId, groupId }
          : g
      );
      const nextStructure = linkSeedMatchupGameId(
        structure,
        groupId,
        homeSeed,
        awaySeed,
        existing.id
      );
      const game = taggedGames.find((g) => g.id === existing.id) ?? existing;
      return {
        structure: nextStructure,
        games: taggedGames,
        game,
        created: false,
      };
    }
    const homeCode = normalizeSeedCode(homeSeed) ?? homeSeed;
    const awayCode = normalizeSeedCode(awaySeed) ?? awaySeed;
    const id = `game-sched-${groupId}-${homeCode}-${awayCode}`;
    const already = allGames.find((g) => g.id === id);
    if (already) {
      const taggedGames = allGames.map((g) =>
        g.id === already.id
          ? { ...g, stageId: fixture.stageId, groupId }
          : g
      );
      return {
        structure: linkSeedMatchupGameId(
          structure,
          groupId,
          homeSeed,
          awaySeed,
          id
        ),
        games: taggedGames,
        game: taggedGames.find((g) => g.id === id) ?? already,
        created: false,
      };
    }
    const created = buildUnplayedGame({
      id,
      tournamentId,
      home,
      away,
      date,
      startTime,
      stageId: fixture.stageId,
      groupId,
    });
    return {
      structure: linkSeedMatchupGameId(
        structure,
        groupId,
        homeSeed,
        awaySeed,
        created.id
      ),
      games: [...allGames, created],
      game: created,
      created: true,
    };
  }

  // Untagged fixture with two teams — still allow Track stats.
  const existing = findReusable({});
  if (existing) {
    return {
      structure,
      games: allGames,
      game: existing,
      created: false,
    };
  }
  const id = `game-sched-${tournamentId}-${home.id}-${away.id}-${date || 'nodate'}`;
  const already = allGames.find((g) => g.id === id);
  if (already) {
    return { structure, games: allGames, game: already, created: false };
  }
  const created = buildUnplayedGame({
    id,
    tournamentId,
    home,
    away,
    date,
    startTime,
    stageId: fixture.stageId,
    groupId: fixture.groupId,
  });
  return {
    structure,
    games: [...allGames, created],
    game: created,
    created: true,
  };
}
