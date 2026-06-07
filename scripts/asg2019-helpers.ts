/** Shared helpers for ASG 2019 import bundles. */

export const TOURNAMENT_ID = 'tournament-1780814669312';

export const TEAM = {
  singapore: 'team-1780814795954',
  philippines: 'team-1780815010233',
  indonesia: 'team-1780815025896',
  vietnam: 'team-1780815038869',
  thailand: 'team-1780815109150',
  malaysia: 'team-1780815124251',
} as const;

/** Box jersey # → existing Singapore player_id (never upsert). */
export const SGP_PLAYER_BY_BOX: Record<number, string> = {
  2: 'player-sunig-ntu-1',
  4: 'player-sunig-ntu-4',
  7: 'player-sunig-ntu-33',
  10: 'player-1780816034976',
  14: 'player-1780816271925',
  17: 'player-1780816185555',
  22: 'player-sunig-ntu-22',
  23: 'player-1780816148225',
  25: 'player-1780815954771',
  28: 'player-1780816214277',
  29: 'player-1780816234770',
  34: 'player-1780816255264',
};

export interface AsgPlayerLine {
  number: number;
  name: string;
  starter: boolean;
  minutes: string;
  fgMade: number;
  fgAttempted: number;
  twoMade: number;
  twoAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  orb: number;
  drb: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  fouls: number;
  foulsDrawn: number;
  plusMinus: number;
  points: number;
  /** When set, use SGP_PLAYER_BY_BOX instead of generating opponent id */
  singapore?: boolean;
}

export interface AsgFullGameDef {
  id: string;
  date: string;
  startTime: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  quarters: { home: [number, number, number, number]; away: [number, number, number, number] };
  homeLines: AsgPlayerLine[];
  awayLines: AsgPlayerLine[];
  opponentTeamKey: 'indonesia' | 'philippines' | 'vietnam';
  opponentSide: 'home' | 'away';
}

export interface AsgScoreOnlyGameDef {
  id: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

export function slugifyPlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function opponentPlayerId(teamKey: string, name: string): string {
  return `player-asg19-${teamKey}-${slugifyPlayerName(name)}`;
}

export function parseFibaMinutes(raw: string): number {
  const [m, s] = raw.split(':').map((x) => parseInt(x, 10));
  return Math.round((m + (s || 0) / 60) * 100) / 100;
}

export function lineToGameStat(
  line: AsgPlayerLine,
  opponentTeamKey: string
): { playerId: string; stat: Record<string, number> } {
  const playerId = line.singapore
    ? SGP_PLAYER_BY_BOX[line.number]
    : opponentPlayerId(opponentTeamKey, line.name);

  if (line.singapore && !playerId) {
    throw new Error(`No Singapore map for box #${line.number} (${line.name})`);
  }

  return {
    playerId,
    stat: {
      playerId,
      points: line.points,
      fg_made: line.fgMade,
      fg_attempted: line.fgAttempted,
      three_made: line.threeMade,
      three_attempted: line.threeAttempted,
      ft_made: line.ftMade,
      ft_attempted: line.ftAttempted,
      orb: line.orb,
      drb: line.drb,
      assists: line.assists,
      steals: line.steals,
      blocks: line.blocks,
      turnovers: line.turnovers,
      fouls: line.fouls,
      tech_fouls: 0,
      unsportsmanlike_fouls: 0,
      fouls_drawn: line.foulsDrawn,
      blocks_received: 0,
      plus_minus: line.plusMinus,
      minutes_played: parseFibaMinutes(line.minutes),
    },
  };
}

export type AsgTeamCoachLine = {
  orb: number;
  drb: number;
  turnovers: number;
  fouls: number;
};

export function aggregateTeamStats(
  teamId: string,
  lines: AsgPlayerLine[],
  quarters: [number, number, number, number],
  teamCoach: AsgTeamCoachLine = { orb: 0, drb: 0, turnovers: 0, fouls: 0 },
  officialRebToFoul?: AsgTeamCoachLine
) {
  const sum = (fn: (l: AsgPlayerLine) => number) =>
    lines.reduce((s, l) => s + fn(l), 0);
  const playerOrb = sum((l) => l.orb);
  const playerDrb = sum((l) => l.drb);
  const playerTo = sum((l) => l.turnovers);
  const playerPf = sum((l) => l.fouls);
  const orb = officialRebToFoul?.orb ?? playerOrb + teamCoach.orb;
  const drb = officialRebToFoul?.drb ?? playerDrb + teamCoach.drb;
  const turnovers = officialRebToFoul?.turnovers ?? playerTo + teamCoach.turnovers;
  const fouls = officialRebToFoul?.fouls ?? playerPf + teamCoach.fouls;
  return {
    teamId,
    q1_points: quarters[0],
    q2_points: quarters[1],
    q3_points: quarters[2],
    q4_points: quarters[3],
    ot_points: 0,
    total_points: sum((l) => l.points),
    fg_made: sum((l) => l.fgMade),
    fg_attempted: sum((l) => l.fgAttempted),
    three_made: sum((l) => l.threeMade),
    three_attempted: sum((l) => l.threeAttempted),
    ft_made: sum((l) => l.ftMade),
    ft_attempted: sum((l) => l.ftAttempted),
    orb,
    drb,
    total_rebounds: orb + drb,
    assists: sum((l) => l.assists),
    steals: sum((l) => l.steals),
    blocks: sum((l) => l.blocks),
    turnovers,
    fouls,
    team_coach: { ...teamCoach },
  };
}

export function scoreOnlyTeamStats(teamId: string, total: number) {
  return {
    teamId,
    q1_points: 0,
    q2_points: 0,
    q3_points: 0,
    q4_points: 0,
    ot_points: 0,
    total_points: total,
    fg_made: 0,
    fg_attempted: 0,
    three_made: 0,
    three_attempted: 0,
    ft_made: 0,
    ft_attempted: 0,
    orb: 0,
    drb: 0,
    total_rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    team_coach: { orb: 0, drb: 0, turnovers: 0, fouls: 0 },
  };
}

/** Shorthand for building a player line */
export function L(
  number: number,
  name: string,
  starter: boolean,
  minutes: string,
  fg: string,
  two: string,
  three: string,
  ft: string,
  reb: string,
  ast: number,
  to: number,
  stl: number,
  blk: number,
  pf: number,
  fd: number,
  pm: number,
  pts: number,
  singapore?: boolean
): AsgPlayerLine {
  const pa = (s: string): [number, number] => {
    const [a, b] = s.split('/').map((x) => parseInt(x, 10));
    return [a, b];
  };
  const [orb, drb] = reb.split('/').map((x) => parseInt(x, 10));
  const [fgMade, fgAttempted] = pa(fg);
  const [twoMade, twoAttempted] = pa(two);
  const [threeMade, threeAttempted] = pa(three);
  const [ftMade, ftAttempted] = pa(ft);
  return {
    number,
    name,
    starter,
    minutes,
    fgMade,
    fgAttempted,
    twoMade,
    twoAttempted,
    threeMade,
    threeAttempted,
    ftMade,
    ftAttempted,
    orb,
    drb,
    assists: ast,
    turnovers: to,
    steals: stl,
    blocks: blk,
    fouls: pf,
    foulsDrawn: fd,
    plusMinus: pm,
    points: pts,
    singapore,
  };
}
