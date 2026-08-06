/**
 * LE-95.4 — per-group standings.
 * Run: npm run test:tournament-standings
 */
import type { Game, GameStats, Team } from '../src/App';
import { buildIubit2026Structure } from '../src/utils/iubit2026Structure';
import {
  buildGroupStandingsTables,
  calculateTeamStandings,
  filterGamesForGroup,
  withExtendedShootingStats,
} from '../src/utils/tournamentStandings';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function team(id: string, abbreviation: string, players: Team['players'] = []): Team {
  return { id, name: abbreviation, abbreviation, players };
}

function emptyTeamStats(teamId: string, total: number): Game['teamStats']['home'] {
  return {
    teamId,
    total_points: total,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    assists: 0,
  } as Game['teamStats']['home'];
}

function game(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  home: number,
  away: number,
  groupId?: string,
  opts?: {
    homeTeamStats?: Partial<Game['teamStats']['home']>;
    awayTeamStats?: Partial<Game['teamStats']['away']>;
    gameStats?: GameStats[];
    homeTeam?: Team;
    awayTeam?: Team;
  }
): Game {
  return {
    id,
    homeTeamId,
    awayTeamId,
    homeTeam: opts?.homeTeam ?? team(homeTeamId, homeTeamId),
    awayTeam: opts?.awayTeam ?? team(awayTeamId, awayTeamId),
    tournamentId: 't1',
    date: '2026-07-01',
    gameStats: opts?.gameStats ?? [],
    teamStats: {
      home: {
        ...emptyTeamStats(homeTeamId, home),
        ...opts?.homeTeamStats,
      },
      away: {
        ...emptyTeamStats(awayTeamId, away),
        ...opts?.awayTeamStats,
      },
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '00:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home, away },
    groupId,
    stageId: groupId ? 'iubit-stage-groups' : undefined,
  };
}

function playerStat(playerId: string, partial: Partial<GameStats>): GameStats {
  return {
    playerId,
    points: 0,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: 0,
    blocks_received: 0,
    plus_minus: 0,
    minutes_played: 1,
    ...partial,
  } as GameStats;
}

function main(): void {
  const teams = [
    team('um', 'UM'),
    team('ntu', 'NTU'),
    team('sjtu', 'SJTU'),
    team('usyd', 'USYD'),
    team('thu', 'THU'),
    team('xjtu', 'XJTU'),
    team('chula', 'CHULA'),
    team('cam', 'CAM'),
    team('pku', 'PKU'),
    team('ustc', 'USTC'),
    team('snu', 'SNU'),
    team('fdu', 'FDU'),
    team('hit', 'HIT'),
    team('nju', 'NJU'),
  ];
  const structure = buildIubit2026Structure(teams)!;
  const groupA = structure.stages[0].groups!.find((g) => g.id === 'iubit-g-a')!;

  const games = [
    game('g1', 'um', 'ntu', 80, 70, 'iubit-g-a', {
      homeTeamStats: { fg_made: 1, fg_attempted: 2 },
      awayTeamStats: { fg_made: 1, fg_attempted: 2 },
    }),
    game('g2', 'um', 'sjtu', 75, 60, 'iubit-g-a', {
      homeTeamStats: { fg_made: 1, fg_attempted: 2 },
      awayTeamStats: { fg_made: 1, fg_attempted: 2 },
    }),
    game('g3', 'ntu', 'sjtu', 65, 60, 'iubit-g-a', {
      homeTeamStats: { fg_made: 1, fg_attempted: 2 },
      awayTeamStats: { fg_made: 1, fg_attempted: 2 },
    }),
    // Classification — must not affect Group A standings
    game('sf', 'um', 'snu', 70, 68),
  ];

  const groupGames = filterGamesForGroup(games, groupA, structure);
  assert(groupGames.length === 3, 'only group A games');

  const standings = calculateTeamStandings(
    [team('um', 'UM'), team('ntu', 'NTU'), team('sjtu', 'SJTU')],
    groupGames
  );
  assert(standings[0].team.id === 'um' && standings[0].wins === 2, 'UM first');
  assert(standings[1].team.id === 'ntu' && standings[1].wins === 1, 'NTU second');
  assert(standings[2].team.id === 'sjtu' && standings[2].wins === 0, 'SJTU third');

  const tables = buildGroupStandingsTables(structure, teams, games);
  assert(tables.length === 4, '4 group tables');
  const aTable = tables.find((t) => t.group.id === 'iubit-g-a')!;
  assert(aTable.standings[0].team.id === 'um', 'group table UM 1st');
  assert(aTable.standings[0].wins === 2, 'group table ignores SF');
  assert(aTable.standings[0].fgPct != null, 'teamStats FG% present');

  // LE-104: same-group rematch linked to bracket must not count in group RR
  const groupAIvp = {
    id: 'ivp-g-a',
    name: 'Group A',
    teamIds: ['ntu', 'np', 'ite', 'suss'],
  };
  const ivpStructure = {
    stages: [
      {
        id: 'ivp-rr',
        name: 'Group stage',
        kind: 'round_robin' as const,
        order: 1,
        groups: [groupAIvp],
      },
      {
        id: 'ivp-class',
        name: 'Classification',
        kind: 'classification' as const,
        order: 2,
        bracket: {
          rounds: [
            {
              id: 'ivp-class-r-sf',
              name: 'Semis',
              slots: [
                {
                  id: 'ivp-class-sf-a1b2',
                  label: 'A1 vs B2',
                  gameId: 'ko-ntu-np',
                },
                { id: 'ivp-class-sf-b1a2', label: 'B1 vs A2' },
              ],
            },
          ],
        },
      },
    ],
  };
  const rrNtuNp = game('rr-ntu-np', 'ntu', 'np', 80, 70, 'ivp-g-a');
  const koNtuNp = {
    ...game('ko-ntu-np', 'ntu', 'np', 90, 75, 'ivp-g-a'),
    stageId: 'ivp-class',
    bracketSlotId: 'ivp-class-sf-a1b2',
    groupId: 'ivp-g-a', // stale group tag — still excluded
  };
  const ivpFiltered = filterGamesForGroup(
    [rrNtuNp, koNtuNp],
    groupAIvp,
    ivpStructure
  );
  assert(ivpFiltered.length === 1, 'LE-104: only RR NTU-NP in group');
  assert(ivpFiltered[0].id === 'rr-ntu-np', 'LE-104: knockout excluded');
  const ivpTables = buildGroupStandingsTables(
    ivpStructure,
    [
      team('ntu', 'NTU'),
      team('np', 'NP'),
      team('ite', 'ITE'),
      team('suss', 'SUSS'),
    ],
    [rrNtuNp, koNtuNp]
  );
  assert(ivpTables[0].standings.find((r) => r.team.id === 'ntu')?.wins === 1, 'NTU 1W from RR only');
  assert(ivpTables[0].standings.find((r) => r.team.id === 'np')?.losses === 1, 'NP 1L from RR only');

  // Score-only (no player FG, teamStats attempts 0) → null %
  const scoreOnlyGame = game('so', 'um', 'ntu', 65, 60, 'iubit-g-a');
  const scoreOnly = withExtendedShootingStats(
    calculateTeamStandings([team('um', 'UM')], [scoreOnlyGame]),
    [scoreOnlyGame]
  );
  assert(scoreOnly[0].fgPct === null, 'score-only FG% is null');
  assert(scoreOnly[0].threePct === null, 'score-only 3P% is null');
  assert(scoreOnly[0].ftPct === null, 'score-only FT% is null');

  // Player box with teamStats FG still 0 → use player lines
  const ntuPlayer = {
    id: 'p-ntu-1',
    name: 'NTU Guard',
    number: '1',
    position: 'G' as const,
  };
  const umPlayer = {
    id: 'p-um-1',
    name: 'UM Guard',
    number: '1',
    position: 'G' as const,
  };
  const ntuTeam = team('ntu', 'NTU', [ntuPlayer]);
  const umTeam = team('um', 'UM', [umPlayer]);
  const tracked = game('tr', 'um', 'ntu', 65, 60, 'iubit-g-a', {
    homeTeam: umTeam,
    awayTeam: ntuTeam,
    gameStats: [
      playerStat('p-um-1', {
        points: 65,
        fg_made: 20,
        fg_attempted: 40,
        three_made: 5,
        three_attempted: 15,
        ft_made: 20,
        ft_attempted: 25,
      }),
      playerStat('p-ntu-1', {
        points: 60,
        fg_made: 22,
        fg_attempted: 50,
        three_made: 4,
        three_attempted: 12,
        ft_made: 12,
        ft_attempted: 20,
      }),
    ],
  });
  const trackedRows = withExtendedShootingStats(
    calculateTeamStandings([ntuTeam], [tracked]),
    [tracked]
  );
  assert(trackedRows[0].fgPct != null, 'player-box FG% present');
  assert(
    Math.abs((trackedRows[0].fgPct as number) - 44) < 0.01,
    `NTU FG% from players expected 44, got ${trackedRows[0].fgPct}`
  );
  assert(
    Math.abs((trackedRows[0].ftPct as number) - 60) < 0.01,
    `NTU FT% from players expected 60, got ${trackedRows[0].ftPct}`
  );

  // Partial coverage (1 tracked + 1 score-only) → null (would be misleading FG%)
  const scoreOnlyUmSjtu = game('so2', 'um', 'sjtu', 75, 60, 'iubit-g-a');
  const partialRows = withExtendedShootingStats(
    calculateTeamStandings([umTeam], [tracked, scoreOnlyUmSjtu]),
    [tracked, scoreOnlyUmSjtu]
  );
  assert(partialRows[0].wins === 2, 'UM still 2 wins with partial shooting');
  assert(
    partialRows[0].fgPct === null,
    'partial shooting coverage must not publish FG%'
  );

  // LE-99: group match list uses same filter as standings
  const onlyGroup = filterGamesForGroup(
    [...games, game('extra', 'um', 'thu', 1, 2)],
    groupA,
    structure
  );
  assert(
    onlyGroup.every((g) => g.groupId === 'iubit-g-a' || !g.groupId),
    'group filter excludes other-group tagged games'
  );
  assert(onlyGroup.length === 3, 'extra non-group game excluded');

  console.log('PASS: test-tournament-standings');
}

main();
