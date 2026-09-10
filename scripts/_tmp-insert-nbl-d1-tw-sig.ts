/**
 * INSERT-only: NBL Div 1 2026 Tong Whye 72–81 Siglap (2026-09-10 19:30).
 * Jeryl Gan row folded into Hannes (human: Jeryl DNP / sheet mistake).
 *
 *   npx tsx scripts/_tmp-insert-nbl-d1-tw-sig.ts
 */
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const TOURNAMENT_ID = 'tournament-1788719241722';
const LEAGUE_ID = 'league-default';
const TW_ID = 'team-1788720372483';
const SIG_ID = 'team-1788719599265';
const GAME_ID = 'game-nbl-d1-2026-2026-09-10-tw-sig';

const TW = {
  lavin: 'player-1786719502718',
  justin: 'player-nbl-d1-2026-tw-05-justin',
  zoel: 'player-nbl-d1-2026-tw-07-zoel',
  vernon: 'player-1788886979510',
  reubenChoo: 'player-nbl-d1-2026-tw-10-reuben',
  liow: 'player-nbl-d1-2026-tw-11-liow',
  firdaus: 'player-nbl-d1-2026-tw-12-firdaus',
  zachery: 'player-nbl-d1-2026-tw-13-zachery',
  peter: 'player-nbl-d1-2026-tw-19-peter', // PDF: Sandhu Singh
  sashi: 'player-nbl-d1-2026-tw-24-sashi',
  minhan: 'player-1786719974252',
  brendon: 'player-nbl-d1-2026-tw-34-brendon',
} as const;

const SIG = {
  shabbir: 'player-1786716960993',
  eshan: 'player-nbl-d1-2026-siglap-09-eshan',
  hoong: 'player-nbl-d1-2026-siglap-11-tan',
  jerome: 'player-nbl-d1-2026-siglap-13-jerome',
  carl: 'player-sunig-ntu-22',
  lebon: 'player-nbl-d1-2026-siglap-25-lebon',
  hannes: 'player-nbl-d1-2026-siglap-29-hannes', // + Jeryl 00:31 / +/-2
  reuben: 'player-1781194731488', // PDF: Reuben David → Amado
  xavier: 'player-nbl-d1-2026-siglap-31-xavier',
  gavin: 'player-nbl-d1-2026-siglap-99-gavin',
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

const twStats: Stat[] = [
  stat(TW.lavin, '20:48', [5, 8], [0, 0], [1, 1], 1, 4, 1, 2, 0, 1, 2, 2, 7, 11),
  stat(TW.justin, '17:15', [6, 10], [0, 3], [0, 0], 1, 3, 0, 6, 0, 0, 2, 0, 4, 12),
  stat(TW.zoel, '23:07', [3, 12], [2, 10], [0, 0], 2, 2, 1, 1, 0, 0, 2, 1, 2, 8),
  stat(TW.vernon, '06:46', [1, 1], [0, 0], [0, 0], 0, 3, 0, 0, 0, 0, 0, 0, -10, 2),
  stat(TW.reubenChoo, '08:42', [0, 2], [0, 0], [0, 0], 1, 3, 0, 1, 0, 0, 2, 0, -3, 0),
  stat(TW.liow, '28:27', [4, 7], [1, 3], [0, 0], 1, 3, 5, 5, 2, 0, 3, 1, -7, 9),
  stat(TW.firdaus, '18:41', [3, 5], [0, 1], [0, 0], 2, 2, 0, 3, 0, 0, 3, 2, -9, 6),
  stat(TW.zachery, '04:02', [0, 0], [0, 0], [2, 2], 0, 1, 0, 0, 0, 0, 1, 1, -15, 2),
  stat(TW.peter, '14:35', [4, 8], [0, 2], [7, 7], 0, 2, 1, 3, 0, 1, 1, 4, -6, 15),
  stat(TW.sashi, '17:23', [0, 1], [0, 0], [0, 0], 0, 3, 1, 1, 0, 1, 2, 0, -5, 0),
  stat(TW.minhan, '24:55', [2, 8], [0, 0], [1, 2], 0, 4, 1, 5, 1, 3, 3, 3, 7, 5),
  stat(TW.brendon, '15:20', [1, 5], [0, 0], [0, 0], 2, 2, 2, 4, 1, 0, 1, 0, -10, 2),
];

// Hannes = PDF Hannes + Jeryl (00:31, +/- +2); Jeryl omitted.
const sigStats: Stat[] = [
  stat(SIG.shabbir, '20:51', [6, 10], [1, 3], [0, 2], 1, 1, 0, 0, 1, 0, 0, 2, 9, 13),
  stat(SIG.eshan, '28:57', [6, 16], [0, 3], [0, 5], 1, 3, 1, 5, 3, 1, 1, 3, 3, 12),
  stat(SIG.hoong, '29:39', [0, 8], [0, 3], [2, 4], 2, 3, 2, 2, 1, 0, 2, 2, -3, 2),
  stat(SIG.jerome, '04:54', [0, 1], [0, 1], [0, 0], 0, 0, 1, 0, 1, 0, 0, 1, 5, 0),
  stat(SIG.carl, '25:23', [4, 11], [0, 2], [5, 8], 4, 5, 3, 2, 2, 1, 2, 4, 13, 13),
  stat(SIG.lebon, '05:36', [0, 2], [0, 0], [1, 2], 1, 0, 0, 1, 1, 0, 2, 1, -9, 1),
  stat(SIG.hannes, '03:42', [0, 0], [0, 0], [0, 0], 0, 0, 0, 0, 1, 0, 1, 0, -2, 0),
  stat(SIG.reuben, '12:52', [1, 1], [0, 0], [1, 2], 1, 1, 3, 1, 3, 0, 0, 2, 18, 3),
  stat(SIG.xavier, '34:52', [10, 19], [3, 8], [1, 1], 2, 1, 6, 0, 2, 0, 2, 4, 15, 24),
  stat(SIG.gavin, '33:14', [5, 12], [0, 3], [3, 3], 1, 7, 1, 3, 3, 0, 4, 3, -4, 13),
];

const TW_EFF: Array<[string, number]> = [
  [TW.lavin, 13],
  [TW.justin, 6],
  [TW.zoel, 3],
  [TW.vernon, 5],
  [TW.reubenChoo, 1],
  [TW.liow, 12],
  [TW.firdaus, 5],
  [TW.zachery, 3],
  [TW.peter, 12],
  [TW.sashi, 3],
  [TW.minhan, 2],
  [TW.brendon, 1],
];

const SIG_EFF: Array<[string, number]> = [
  [SIG.shabbir, 10],
  [SIG.eshan, 1],
  [SIG.hoong, -2],
  [SIG.jerome, 1],
  [SIG.carl, 16],
  [SIG.lebon, -1],
  [SIG.hannes, 1],
  [SIG.reuben, 9],
  [SIG.xavier, 26],
  [SIG.gavin, 15],
];

function assertTotals(): void {
  const twSec = Math.round(sum(twStats, 'minutes_played') * 60);
  const sigSec = Math.round(sum(sigStats, 'minutes_played') * 60);
  // FIBA sheet TW player minutes sum to 12001s (1s over); keep as printed.
  if (Math.abs(twSec - 12000) > 1) throw new Error(`TW minutes ${twSec}`);
  if (sigSec !== 12000) throw new Error(`SIG minutes ${sigSec}`);
  if (sum(twStats, 'points') !== 72) throw new Error(`TW PTS ${sum(twStats, 'points')}`);
  if (sum(sigStats, 'points') !== 81) throw new Error(`SIG PTS ${sum(sigStats, 'points')}`);
  if (sum(twStats, 'fg_made') !== 29 || sum(twStats, 'fg_attempted') !== 67) {
    throw new Error('TW FG');
  }
  if (sum(sigStats, 'fg_made') !== 32 || sum(sigStats, 'fg_attempted') !== 80) {
    throw new Error('SIG FG');
  }
  if (sum(twStats, 'three_made') !== 3 || sum(twStats, 'three_attempted') !== 19) {
    throw new Error('TW 3P');
  }
  if (sum(sigStats, 'three_made') !== 4 || sum(sigStats, 'three_attempted') !== 23) {
    throw new Error('SIG 3P');
  }
  if (sum(twStats, 'ft_made') !== 11 || sum(twStats, 'ft_attempted') !== 12) {
    throw new Error('TW FT');
  }
  if (sum(sigStats, 'ft_made') !== 13 || sum(sigStats, 'ft_attempted') !== 27) {
    throw new Error('SIG FT');
  }
  if (sum(twStats, 'assists') !== 12) throw new Error('TW AST');
  if (sum(sigStats, 'assists') !== 17) throw new Error('SIG AST');
  if (sum(twStats, 'steals') !== 4) throw new Error('TW ST');
  if (sum(sigStats, 'steals') !== 18) throw new Error(`SIG ST ${sum(sigStats, 'steals')}`);
  if (sum(twStats, 'blocks') !== 6) throw new Error('TW BS');
  if (sum(sigStats, 'blocks') !== 2) throw new Error('SIG BS');
  if (sum(twStats, 'fouls') !== 22) throw new Error('TW PF');
  if (sum(sigStats, 'fouls') !== 14) throw new Error('SIG PF');
  if (sum(twStats, 'turnovers') !== 31) throw new Error('TW TO');
  if (sum(sigStats, 'turnovers') !== 14) {
    throw new Error(`SIG player TO ${sum(sigStats, 'turnovers')} (team TO 2 → total 16)`);
  }
  if (sum(twStats, 'plus_minus') !== -45) {
    throw new Error(`TW +/- ${sum(twStats, 'plus_minus')}`);
  }
  if (sum(sigStats, 'plus_minus') !== 45) {
    throw new Error(`SIG +/- ${sum(sigStats, 'plus_minus')}`);
  }

  const twStarters = [TW.lavin, TW.justin, TW.zoel, TW.liow, TW.minhan];
  const sigStarters = [SIG.eshan, SIG.hoong, SIG.carl, SIG.xavier, SIG.gavin];
  const twBench =
    72 -
    twStats
      .filter((s) => twStarters.includes(s.playerId as (typeof twStarters)[number]))
      .reduce((n, s) => n + s.points, 0);
  const sigBench =
    81 -
    sigStats
      .filter((s) => sigStarters.includes(s.playerId as (typeof sigStarters)[number]))
      .reduce((n, s) => n + s.points, 0);
  if (twBench !== 27) throw new Error(`TW bench ${twBench}`);
  if (sigBench !== 17) throw new Error(`SIG bench ${sigBench}`);

  const byId = new Map([...twStats, ...sigStats].map((s) => [s.playerId, s]));
  for (const [id, expected] of [...TW_EFF, ...SIG_EFF]) {
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
  { teamId: TW_ID, playerId: TW.lavin, number: 1 },
  { teamId: TW_ID, playerId: TW.justin, number: 5 },
  { teamId: TW_ID, playerId: TW.zoel, number: 7 },
  { teamId: TW_ID, playerId: TW.vernon, number: 9 },
  { teamId: TW_ID, playerId: TW.reubenChoo, number: 10 },
  { teamId: TW_ID, playerId: TW.liow, number: 11 },
  { teamId: TW_ID, playerId: TW.firdaus, number: 12 },
  { teamId: TW_ID, playerId: TW.zachery, number: 13 },
  { teamId: TW_ID, playerId: TW.peter, number: 19 },
  { teamId: TW_ID, playerId: TW.sashi, number: 24 },
  { teamId: TW_ID, playerId: TW.minhan, number: 27 },
  { teamId: TW_ID, playerId: TW.brendon, number: 34 },
  { teamId: SIG_ID, playerId: SIG.shabbir, number: 2 },
  { teamId: SIG_ID, playerId: SIG.eshan, number: 9 },
  { teamId: SIG_ID, playerId: SIG.hoong, number: 11 },
  { teamId: SIG_ID, playerId: SIG.jerome, number: 13 },
  { teamId: SIG_ID, playerId: SIG.carl, number: 22 },
  { teamId: SIG_ID, playerId: SIG.lebon, number: 25 },
  { teamId: SIG_ID, playerId: SIG.hannes, number: 29 },
  { teamId: SIG_ID, playerId: SIG.reuben, number: 30 },
  { teamId: SIG_ID, playerId: SIG.xavier, number: 31 },
  { teamId: SIG_ID, playerId: SIG.gavin, number: 99 },
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

  const twTeamOrb = 2;
  const twTeamDrb = 7;
  const sigTeamOrb = 3;
  const sigTeamDrb = 4;
  if (sum(twStats, 'orb') + twTeamOrb !== 12) throw new Error('TW ORB');
  if (sum(twStats, 'drb') + twTeamDrb !== 39) throw new Error('TW DRB');
  if (sum(sigStats, 'orb') + sigTeamOrb !== 16) throw new Error('SIG ORB');
  if (sum(sigStats, 'drb') + sigTeamDrb !== 25) throw new Error('SIG DRB');

  const gameRow = {
    id: GAME_ID,
    league_id: LEAGUE_ID,
    tournament_id: TOURNAMENT_ID,
    home_team_id: TW_ID,
    away_team_id: SIG_ID,
    date: '2026-09-10',
    current_period: 4,
    current_game_time: '00:00',
    track_both_teams: true,
    is_active: false,
    is_completed: true,
    final_score_home: 72,
    final_score_away: 81,
    home_starters: [TW.lavin, TW.justin, TW.zoel, TW.liow, TW.minhan],
    away_starters: [SIG.eshan, SIG.hoong, SIG.carl, SIG.xavier, SIG.gavin],
    game_stats: [...twStats, ...sigStats],
    team_stats: {
      home: teamStats(TW_ID, [24, 8, 18, 22], {
        fg: [29, 67],
        three: [3, 19],
        ft: [11, 12],
        orb: sum(twStats, 'orb'),
        drb: sum(twStats, 'drb'),
        teamOrb: twTeamOrb,
        teamDrb: twTeamDrb,
        teamTo: 0,
        teamFouls: 0,
        assists: 12,
        steals: 4,
        blocks: 6,
        turnovers: 31,
        fouls: 22,
        pitp: 42,
        second: 11,
        fb: 11,
        bench: 27,
        lead: 11,
        run: 6,
        pto: 23,
      }),
      away: teamStats(SIG_ID, [19, 19, 22, 21], {
        fg: [32, 80],
        three: [4, 23],
        ft: [13, 27],
        orb: sum(sigStats, 'orb'),
        drb: sum(sigStats, 'drb'),
        teamOrb: sigTeamOrb,
        teamDrb: sigTeamDrb,
        teamTo: 2,
        teamFouls: 0,
        assists: 17,
        steals: 18,
        blocks: 2,
        turnovers: 16,
        fouls: 14,
        pitp: 50,
        second: 13,
        fb: 25,
        bench: 17,
        lead: 17,
        run: 12,
        pto: 24,
      }),
      __meta: {
        startTime: '19:30',
        venue: 'Singapore Basketball Centre',
        fibaGameNo: '5236673',
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

  console.log('Tong Whye 72 – Siglap 81 | 2026-09-10 19:30');
  console.log('Hannes minutes (incl Jeryl)', min('03:42').toFixed(4), '+/-', -2);
  console.log(
    'TW',
    twStats.map((s) => `${profileById.get(s.playerId)?.name} ${s.points}`)
  );
  console.log(
    'SIG',
    sigStats.map((s) => `${profileById.get(s.playerId)?.name} ${s.points}`)
  );
  console.log('roster insert', rosterInserts.length, 'already', already.size);

  if (rosterInserts.length > 0) {
    const { error } = await supabase
      .from('tournament_rosters')
      .insert(rosterInserts)
      .select('player_id');
    if (error) throw new Error(`tournament_rosters: ${error.message}`);
  }

  const { error: gameInsErr } = await supabase.from('games').insert(gameRow);
  if (gameInsErr) throw new Error(`games insert: ${gameInsErr.message}`);

  await sleep(2000);

  const { data: check } = await supabase
    .from('games')
    .select('id,final_score_home,final_score_away,is_completed,game_stats,team_stats')
    .eq('id', GAME_ID)
    .single();
  const stats = (check?.game_stats as Stat[]) ?? [];
  const hannes = stats.find((s) => s.playerId === SIG.hannes);
  console.log('Inserted', {
    id: check?.id,
    score: [check?.final_score_home, check?.final_score_away],
    done: check?.is_completed,
    nStats: stats.length,
    hannesMin: hannes?.minutes_played,
    hannesPlusMinus: hannes?.plus_minus,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
