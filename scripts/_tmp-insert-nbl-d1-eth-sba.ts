/**
 * INSERT-only: NBL Div 1 2026 Eng Tat 73–64 SBA (2026-09-10 21:00).
 * Prem Haran (#1) DNP mistake → fold into Wang Xuan Chun (#83).
 * Louis Ho DNP / Wang #21 DNP omitted.
 *
 *   npx tsx scripts/_tmp-insert-nbl-d1-eth-sba.ts
 */
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const TOURNAMENT_ID = 'tournament-1788719241722';
const LEAGUE_ID = 'league-default';
const ETH_ID = 'team-1788719469161';
const SBA_ID = 'team-1788720231763';
const GAME_ID = 'game-nbl-d1-2026-2026-09-10-eth-sba';

const ETH = {
  justinLin: 'player-1788765568678', // #0
  julian: 'player-1788765626505', // #4
  russel: 'player-1788765637720', // #5
  leck: 'player-1788765648980', // #6
  dingloon: 'player-1788765662433', // #9
  jerome: 'player-1788765706172', // #20
  kelvin: 'player-1788765720177', // #22
  pingkiat: 'player-1788765733532', // #23
  folkoff: 'player-1788765774484', // #24
  yuanming: 'player-1788765787994', // #32
  enmao: 'player-1780304645177', // #77
  chinhong: 'player-1788766219174', // #93
} as const;

const SBA = {
  zachary: 'player-nbl-d1-2026-sba-00-zachary',
  weilong: 'player-nbl-d1-2026-sba-05-weilong',
  tng: 'player-nbl-d1-2026-sba-07-tng',
  herman: 'player-nbl-d1-2026-sba-09-herman',
  nigel: 'player-nbl-d1-2026-sba-14-nigel',
  kovan: 'player-sunig-ntu-21',
  ding: 'player-nbl-d1-2026-sba-28-ding',
  royce: 'player-nbl-d1-2026-sba-31-royce',
  jovan: 'player-nbl-d1-2026-sba-67-jovan',
  chun: 'player-nbl-d1-2026-sba-83-chun', // + Prem 00:32
} as const;

function min(mmss: string): number {
  const [m, s] = mmss.split(':').map(Number);
  return m + s / 60;
}

function stat(
  playerId: string,
  mmss: string,
  fg: [number, number],
  three: [number, number],
  ft: [number, number],
  orb: number,
  drb: number,
  assists: number,
  turnovers: number,
  steals: number,
  blocks: number,
  fouls: number,
  foulsDrawn: number,
  plusMinus: number,
  points: number
) {
  const twoMade = fg[0] - three[0];
  const twoAtt = fg[1] - three[1];
  if (twoMade < 0 || twoAtt < 0) throw new Error(`2P negative for ${playerId}`);
  const expectedPts = twoMade * 2 + three[0] * 3 + ft[0];
  if (expectedPts !== points) {
    throw new Error(`${playerId} PTS ${points} != ${expectedPts}`);
  }
  return {
    playerId,
    points,
    fg_made: fg[0],
    fg_attempted: fg[1],
    three_made: three[0],
    three_attempted: three[1],
    ft_made: ft[0],
    ft_attempted: ft[1],
    orb,
    drb,
    assists,
    steals,
    blocks,
    turnovers,
    fouls,
    tech_fouls: 0,
    unsportsmanlike_fouls: 0,
    fouls_drawn: foulsDrawn,
    blocks_received: 0,
    plus_minus: plusMinus,
    minutes_played: min(mmss),
  };
}

function classicEff(s: ReturnType<typeof stat>): number {
  return (
    s.points +
    s.orb +
    s.drb +
    s.assists +
    s.steals +
    s.blocks -
    (s.fg_attempted - s.fg_made) -
    (s.ft_attempted - s.ft_made) -
    s.turnovers
  );
}

type Stat = ReturnType<typeof stat>;
function sum<K extends keyof Stat>(rows: Stat[], key: K): number {
  return rows.reduce((n, r) => n + (r[key] as number), 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const ethStats: Stat[] = [
  stat(ETH.justinLin, '10:52', [0, 3], [0, 1], [0, 0], 0, 1, 0, 2, 1, 0, 0, 0, -10, 0),
  stat(ETH.julian, '19:36', [3, 6], [1, 3], [0, 2], 2, 6, 0, 1, 3, 0, 4, 2, -2, 7),
  stat(ETH.russel, '28:18', [3, 12], [0, 0], [4, 11], 3, 6, 1, 4, 0, 3, 1, 7, 13, 10),
  stat(ETH.leck, '00:45', [0, 0], [0, 0], [0, 0], 0, 0, 0, 0, 0, 0, 1, 0, -2, 0),
  stat(ETH.dingloon, '31:46', [7, 18], [0, 7], [2, 4], 2, 5, 1, 3, 1, 1, 1, 2, 15, 16),
  stat(ETH.jerome, '00:59', [0, 0], [0, 0], [0, 0], 0, 0, 0, 0, 0, 0, 0, 0, -2, 0),
  stat(ETH.kelvin, '28:21', [9, 13], [1, 1], [3, 4], 3, 8, 1, 3, 1, 0, 5, 3, 10, 22),
  stat(ETH.pingkiat, '00:59', [0, 0], [0, 0], [0, 0], 0, 0, 0, 1, 0, 0, 0, 0, -2, 0),
  stat(ETH.folkoff, '24:22', [3, 10], [0, 4], [4, 6], 1, 6, 3, 1, 0, 0, 0, 3, 17, 10),
  stat(ETH.yuanming, '14:34', [0, 0], [0, 0], [1, 2], 2, 2, 0, 0, 1, 0, 1, 1, 5, 1),
  stat(ETH.enmao, '14:18', [1, 3], [1, 2], [0, 0], 1, 0, 0, 0, 0, 0, 1, 0, -10, 3),
  stat(ETH.chinhong, '25:10', [2, 8], [0, 0], [0, 0], 0, 5, 2, 2, 2, 1, 2, 2, 13, 4),
];

// Wang #83 = PDF #83 + Prem #1 (00:32, 0/1 FG, +/- -3); Prem omitted.
const sbaStats: Stat[] = [
  stat(SBA.zachary, '25:48', [5, 9], [1, 2], [1, 2], 0, 5, 1, 0, 1, 0, 2, 2, -18, 12),
  stat(SBA.weilong, '26:41', [2, 11], [1, 7], [5, 7], 0, 5, 5, 3, 2, 0, 2, 4, 0, 10),
  stat(SBA.tng, '21:16', [2, 5], [1, 3], [0, 2], 2, 0, 0, 3, 0, 0, 2, 2, -8, 5),
  stat(SBA.herman, '22:35', [0, 2], [0, 0], [0, 0], 1, 2, 1, 0, 1, 2, 3, 1, 4, 0),
  stat(SBA.nigel, '31:44', [3, 16], [3, 10], [2, 2], 0, 6, 1, 2, 2, 0, 3, 1, -9, 11),
  stat(SBA.kovan, '14:45', [2, 2], [0, 0], [0, 0], 0, 1, 0, 1, 0, 0, 1, 0, -12, 4),
  stat(SBA.ding, '03:02', [1, 1], [0, 0], [0, 0], 1, 1, 0, 0, 0, 0, 0, 0, -1, 2),
  stat(SBA.royce, '34:02', [4, 12], [2, 3], [0, 0], 0, 5, 0, 5, 1, 1, 4, 1, 0, 10),
  stat(SBA.jovan, '16:11', [3, 8], [2, 3], [2, 2], 1, 1, 1, 2, 1, 0, 1, 3, 6, 10),
  stat(SBA.chun, '03:59', [0, 1], [0, 0], [0, 0], 0, 0, 0, 2, 0, 1, 2, 1, -7, 0),
];

const ETH_EFF: Array<[string, number]> = [
  [ETH.justinLin, -3],
  [ETH.julian, 12],
  [ETH.russel, 3],
  [ETH.leck, 0],
  [ETH.dingloon, 10],
  [ETH.jerome, 0],
  [ETH.kelvin, 27],
  [ETH.pingkiat, -1],
  [ETH.folkoff, 10],
  [ETH.yuanming, 5],
  [ETH.enmao, 2],
  [ETH.chinhong, 6],
];

const SBA_EFF: Array<[string, number]> = [
  [SBA.zachary, 14],
  [SBA.weilong, 8],
  [SBA.tng, -1],
  [SBA.herman, 5],
  [SBA.nigel, 5],
  [SBA.kovan, 4],
  [SBA.ding, 4],
  [SBA.royce, 4],
  [SBA.jovan, 7],
  [SBA.chun, -2], // PDF #83 was -1; + Prem miss/TO → -2
];

function assertTotals(): void {
  const ethSec = Math.round(sum(ethStats, 'minutes_played') * 60);
  const sbaSec = Math.round(sum(sbaStats, 'minutes_played') * 60);
  // FIBA sheets / float mm:ss can be ± a few seconds vs 200:00.
  if (Math.abs(ethSec - 12000) > 3) throw new Error(`ETH minutes ${ethSec}`);
  if (Math.abs(sbaSec - 12000) > 3) throw new Error(`SBA minutes ${sbaSec}`);

  if (sum(ethStats, 'points') !== 73) throw new Error(`ETH PTS ${sum(ethStats, 'points')}`);
  if (sum(sbaStats, 'points') !== 64) throw new Error(`SBA PTS ${sum(sbaStats, 'points')}`);
  if (sum(ethStats, 'fg_made') !== 28 || sum(ethStats, 'fg_attempted') !== 73) {
    throw new Error('ETH FG');
  }
  if (sum(sbaStats, 'fg_made') !== 22 || sum(sbaStats, 'fg_attempted') !== 67) {
    throw new Error(`SBA FG ${sum(sbaStats, 'fg_made')}/${sum(sbaStats, 'fg_attempted')}`);
  }
  if (sum(ethStats, 'three_made') !== 3 || sum(ethStats, 'three_attempted') !== 18) {
    throw new Error('ETH 3P');
  }
  if (sum(sbaStats, 'three_made') !== 10 || sum(sbaStats, 'three_attempted') !== 28) {
    throw new Error('SBA 3P');
  }
  if (sum(ethStats, 'ft_made') !== 14 || sum(ethStats, 'ft_attempted') !== 29) {
    throw new Error('ETH FT');
  }
  if (sum(sbaStats, 'ft_made') !== 10 || sum(sbaStats, 'ft_attempted') !== 15) {
    throw new Error('SBA FT');
  }
  if (sum(ethStats, 'assists') !== 8) throw new Error('ETH AST');
  if (sum(sbaStats, 'assists') !== 9) throw new Error('SBA AST');
  if (sum(ethStats, 'steals') !== 9) throw new Error('ETH ST');
  if (sum(sbaStats, 'steals') !== 8) throw new Error('SBA ST');
  if (sum(ethStats, 'blocks') !== 5) throw new Error('ETH BS');
  if (sum(sbaStats, 'blocks') !== 4) throw new Error('SBA BS');
  if (sum(ethStats, 'fouls') !== 16) throw new Error(`ETH PF ${sum(ethStats, 'fouls')}`);
  if (sum(sbaStats, 'fouls') !== 20) throw new Error(`SBA PF ${sum(sbaStats, 'fouls')}`);
  if (sum(ethStats, 'turnovers') !== 17) {
    throw new Error(`ETH player TO ${sum(ethStats, 'turnovers')}`);
  }
  if (sum(sbaStats, 'turnovers') !== 18) {
    throw new Error(`SBA player TO ${sum(sbaStats, 'turnovers')}`);
  }
  if (sum(ethStats, 'plus_minus') !== 45) {
    throw new Error(`ETH +/- ${sum(ethStats, 'plus_minus')}`);
  }
  if (sum(sbaStats, 'plus_minus') !== -45) {
    throw new Error(`SBA +/- ${sum(sbaStats, 'plus_minus')}`);
  }

  const ethStarters = [
    ETH.russel,
    ETH.dingloon,
    ETH.kelvin,
    ETH.folkoff,
    ETH.chinhong,
  ];
  const sbaStarters = [SBA.zachary, SBA.weilong, SBA.herman, SBA.nigel, SBA.royce];
  const ethBench =
    73 -
    ethStats
      .filter((s) => ethStarters.includes(s.playerId as (typeof ethStarters)[number]))
      .reduce((n, s) => n + s.points, 0);
  const sbaBench =
    64 -
    sbaStats
      .filter((s) => sbaStarters.includes(s.playerId as (typeof sbaStarters)[number]))
      .reduce((n, s) => n + s.points, 0);
  if (ethBench !== 11) throw new Error(`ETH bench ${ethBench}`);
  if (sbaBench !== 21) throw new Error(`SBA bench ${sbaBench}`);

  const byId = new Map([...ethStats, ...sbaStats].map((s) => [s.playerId, s]));
  for (const [id, expected] of [...ETH_EFF, ...SBA_EFF]) {
    const got = classicEff(byId.get(id)!);
    if (got !== expected) throw new Error(`EFF ${id} ${got} != ${expected}`);
  }
}

function teamStats(
  teamId: string,
  q: [number, number, number, number],
  totals: {
    fg: [number, number];
    three: [number, number];
    ft: [number, number];
    orb: number;
    drb: number;
    teamOrb: number;
    teamDrb: number;
    teamTo: number;
    teamFouls: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fouls: number;
    pitp: number;
    second: number;
    fb: number;
    bench: number;
    lead: number;
    run: number;
    pto: number;
  }
) {
  return {
    teamId,
    q1_points: q[0],
    q2_points: q[1],
    q3_points: q[2],
    q4_points: q[3],
    ot_points: 0,
    total_points: q[0] + q[1] + q[2] + q[3],
    fg_made: totals.fg[0],
    fg_attempted: totals.fg[1],
    three_made: totals.three[0],
    three_attempted: totals.three[1],
    two_made: totals.fg[0] - totals.three[0],
    two_attempted: totals.fg[1] - totals.three[1],
    ft_made: totals.ft[0],
    ft_attempted: totals.ft[1],
    orb: totals.orb,
    drb: totals.drb,
    team_rebounds: totals.teamOrb + totals.teamDrb,
    total_rebounds: totals.orb + totals.drb + totals.teamOrb + totals.teamDrb,
    assists: totals.assists,
    steals: totals.steals,
    blocks: totals.blocks,
    turnovers: totals.turnovers,
    fouls: totals.fouls,
    points_off_turnovers: totals.pto,
    points_in_paint: totals.pitp,
    second_chance_points: totals.second,
    fastbreak_points: totals.fb,
    bench_points: totals.bench,
    biggest_lead: totals.lead,
    biggest_scoring_run: totals.run,
    team_coach: {
      orb: totals.teamOrb,
      drb: totals.teamDrb,
      turnovers: totals.teamTo,
      fouls: totals.teamFouls,
    },
  };
}

assertTotals();

const PLAYED: Array<{ teamId: string; playerId: string; number: number }> = [
  { teamId: ETH_ID, playerId: ETH.justinLin, number: 0 },
  { teamId: ETH_ID, playerId: ETH.julian, number: 4 },
  { teamId: ETH_ID, playerId: ETH.russel, number: 5 },
  { teamId: ETH_ID, playerId: ETH.leck, number: 6 },
  { teamId: ETH_ID, playerId: ETH.dingloon, number: 9 },
  { teamId: ETH_ID, playerId: ETH.jerome, number: 20 },
  { teamId: ETH_ID, playerId: ETH.kelvin, number: 22 },
  { teamId: ETH_ID, playerId: ETH.pingkiat, number: 23 },
  { teamId: ETH_ID, playerId: ETH.folkoff, number: 24 },
  { teamId: ETH_ID, playerId: ETH.yuanming, number: 32 },
  { teamId: ETH_ID, playerId: ETH.enmao, number: 77 },
  { teamId: ETH_ID, playerId: ETH.chinhong, number: 93 },
  { teamId: SBA_ID, playerId: SBA.zachary, number: 0 },
  { teamId: SBA_ID, playerId: SBA.weilong, number: 5 },
  { teamId: SBA_ID, playerId: SBA.tng, number: 7 },
  { teamId: SBA_ID, playerId: SBA.herman, number: 9 },
  { teamId: SBA_ID, playerId: SBA.nigel, number: 14 },
  { teamId: SBA_ID, playerId: SBA.kovan, number: 15 },
  { teamId: SBA_ID, playerId: SBA.ding, number: 28 },
  { teamId: SBA_ID, playerId: SBA.royce, number: 31 },
  { teamId: SBA_ID, playerId: SBA.jovan, number: 67 },
  { teamId: SBA_ID, playerId: SBA.chun, number: 83 },
];

loadEnvLocalIntoProcess();

async function main(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('missing supabase env');
  const supabase = createClient(url, key);

  const { data: existingTr } = await supabase
    .from('tournament_rosters')
    .select('player_id,team_id')
    .eq('tournament_id', TOURNAMENT_ID);
  if ((existingTr ?? []).length < 65) {
    throw new Error(`prior rosters wiped (${existingTr?.length ?? 0} < 65). Stop.`);
  }

  const playerIds = PLAYED.map((p) => p.playerId);
  const { data: clubLinks, error: clubErr } = await supabase
    .from('team_players')
    .select('team_id,player_id,number')
    .in('player_id', playerIds);
  if (clubErr) throw clubErr;

  for (const row of PLAYED) {
    const link = (clubLinks ?? []).find(
      (r) => r.player_id === row.playerId && r.team_id === row.teamId
    );
    if (!link) throw new Error(`missing club link ${row.playerId} on ${row.teamId}`);
    if (link.number !== row.number) {
      throw new Error(
        `jersey mismatch ${row.playerId}: club ${link.number} vs box ${row.number}`
      );
    }
  }

  const { data: profiles, error: pErr } = await supabase
    .from('players')
    .select('id,name,position,secondary_position')
    .in('id', playerIds);
  if (pErr) throw pErr;
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: existingGame } = await supabase
    .from('games')
    .select('id')
    .eq('id', GAME_ID)
    .maybeSingle();
  if (existingGame) throw new Error(`game already exists: ${GAME_ID}`);

  const already = new Set(
    (existingTr ?? [])
      .filter((r) => playerIds.includes(r.player_id as string))
      .map((r) => r.player_id as string)
  );
  for (const row of existingTr ?? []) {
    const expected = PLAYED.find((p) => p.playerId === row.player_id);
    if (expected && row.team_id !== expected.teamId) {
      throw new Error(`player ${row.player_id} already on ${row.team_id}`);
    }
  }

  const rosterInserts = PLAYED.filter((p) => !already.has(p.playerId)).map((p) => {
    const profile = profileById.get(p.playerId)!;
    return {
      tournament_id: TOURNAMENT_ID,
      team_id: p.teamId,
      player_id: p.playerId,
      number: p.number,
      position: profile.position || '',
      secondary_position: profile.secondary_position ?? null,
    };
  });

  // FIBA totals OR/DR include team/coach; derive team board from printed totals.
  const ethTeamOrb = 16 - sum(ethStats, 'orb');
  const ethTeamDrb = 40 - sum(ethStats, 'drb');
  const sbaTeamOrb = 8 - sum(sbaStats, 'orb');
  const sbaTeamDrb = 36 - sum(sbaStats, 'drb');
  if (ethTeamOrb < 0 || ethTeamDrb < 0 || sbaTeamOrb < 0 || sbaTeamDrb < 0) {
    throw new Error(
      `team reb eth ${ethTeamOrb}/${ethTeamDrb} sba ${sbaTeamOrb}/${sbaTeamDrb}`
    );
  }

  const ethTeamTo = 18 - sum(ethStats, 'turnovers');
  const sbaTeamTo = 19 - sum(sbaStats, 'turnovers');
  const ethTeamFouls = 16 - sum(ethStats, 'fouls');
  const sbaTeamFouls = 20 - sum(sbaStats, 'fouls');
  if (ethTeamTo < 0 || sbaTeamTo < 0 || ethTeamFouls < 0 || sbaTeamFouls < 0) {
    throw new Error('negative team TO/fouls');
  }

  const gameRow = {
    id: GAME_ID,
    league_id: LEAGUE_ID,
    tournament_id: TOURNAMENT_ID,
    home_team_id: ETH_ID,
    away_team_id: SBA_ID,
    date: '2026-09-10',
    current_period: 4,
    current_game_time: '00:00',
    track_both_teams: true,
    is_active: false,
    is_completed: true,
    final_score_home: 73,
    final_score_away: 64,
    home_starters: [
      ETH.russel,
      ETH.dingloon,
      ETH.kelvin,
      ETH.folkoff,
      ETH.chinhong,
    ],
    away_starters: [SBA.zachary, SBA.weilong, SBA.herman, SBA.nigel, SBA.royce],
    game_stats: [...ethStats, ...sbaStats],
    team_stats: {
      home: teamStats(ETH_ID, [19, 15, 24, 15], {
        fg: [28, 73],
        three: [3, 18],
        ft: [14, 29],
        orb: sum(ethStats, 'orb'),
        drb: sum(ethStats, 'drb'),
        teamOrb: ethTeamOrb,
        teamDrb: ethTeamDrb,
        teamTo: ethTeamTo,
        teamFouls: ethTeamFouls,
        assists: 8,
        steals: 9,
        blocks: 5,
        turnovers: 18,
        fouls: 16,
        pitp: 40,
        second: 14,
        fb: 17,
        bench: 11,
        lead: 18,
        run: 10,
        pto: 22,
      }),
      away: teamStats(SBA_ID, [17, 13, 17, 17], {
        fg: [22, 67],
        three: [10, 28],
        ft: [10, 15],
        orb: sum(sbaStats, 'orb'),
        drb: sum(sbaStats, 'drb'),
        teamOrb: sbaTeamOrb,
        teamDrb: sbaTeamDrb,
        teamTo: sbaTeamTo,
        teamFouls: sbaTeamFouls,
        assists: 9,
        steals: 8,
        blocks: 4,
        turnovers: 19,
        fouls: 20,
        pitp: 20,
        second: 9,
        fb: 5,
        bench: 21,
        lead: 4,
        run: 9,
        pto: 13,
      }),
      __meta: {
        startTime: '21:00',
        venue: 'Singapore Basketball Centre',
        fibaGameNo: '5236665',
        clockSettings: {
          regulationPeriods: 4,
          regulationPeriodMinutes: 10,
          overtimePeriodMinutes: 5,
        },
      },
    },
    shots: [],
    events: [],
    lineup_stints: [],
  };

  console.log('Eng Tat 73 – SBA 64 | 2026-09-10 21:00');
  console.log('Wang #83 (incl Prem)', min('03:59').toFixed(4), '+/-', -7, 'EF', classicEff(sbaStats.find(s=>s.playerId===SBA.chun)!));
  console.log(
    'ETH',
    ethStats.map((s) => `${profileById.get(s.playerId)?.name} ${s.points}`)
  );
  console.log(
    'SBA',
    sbaStats.map((s) => `${profileById.get(s.playerId)?.name} ${s.points}`)
  );
  console.log('roster insert', rosterInserts.length, 'already', already.size);
  console.log('team boards', {
    eth: { orb: ethTeamOrb, drb: ethTeamDrb, to: ethTeamTo, pf: ethTeamFouls },
    sba: { orb: sbaTeamOrb, drb: sbaTeamDrb, to: sbaTeamTo, pf: sbaTeamFouls },
  });

  if (rosterInserts.length > 0) {
    const { error } = await supabase
      .from('tournament_rosters')
      .insert(rosterInserts)
      .select('player_id');
    if (error) throw new Error(`tournament_rosters: ${error.message}`);
  }

  const { error: gameInsErr } = await supabase.from('games').insert(gameRow);
  if (gameInsErr) throw new Error(`games insert: ${gameInsErr.message}`);

  await sleep(1500);

  const { data: check } = await supabase
    .from('games')
    .select('id,final_score_home,final_score_away,is_completed,game_stats')
    .eq('id', GAME_ID)
    .single();
  const stats = (check?.game_stats as Stat[]) ?? [];
  const chun = stats.find((s) => s.playerId === SBA.chun);
  console.log('Inserted', {
    id: check?.id,
    score: [check?.final_score_home, check?.final_score_away],
    done: check?.is_completed,
    nStats: stats.length,
    chunMin: chun?.minutes_played,
    chunPlusMinus: chun?.plus_minus,
    hasPrem: stats.some((s) => s.playerId === 'player-nbl-d1-2026-sba-01-prem'),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
