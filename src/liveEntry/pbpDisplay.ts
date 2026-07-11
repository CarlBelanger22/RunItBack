import type { Game, GameEvent, GameStats, Shot, Team, TeamStats } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { GameLogic } from '../utils/GameLogic';

export interface PbpEventSnapshot {
  players: Record<string, GameStats>;
  home: TeamStats;
  away: TeamStats;
}

export type PbpRow =
  | { kind: 'event'; key: string; event: GameEvent }
  | {
      kind: 'block';
      key: string;
      shotEvent: GameEvent;
      blockerId: string;
      blockerTeamId: string;
    }
  | {
      kind: 'double_foul_partner';
      key: string;
      foulEvent: GameEvent;
      partnerId: string;
      partnerTeamId: string;
    };

export interface PbpActionStyle {
  playerLine: string;
  label: string;
  color: string;
  detail?: string;
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
  };
}

function createReplayGame(homeTeam: Team, awayTeam: Team): Game {
  return {
    id: 'pbp-replay',
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeTeam,
    awayTeam,
    date: '',
    gameStats: [],
    teamStats: {
      home: emptyTeamStats(homeTeam.id),
      away: emptyTeamStats(awayTeam.id),
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: true,
    isCompleted: false,
  };
}

function clonePlayerStats(stats: GameStats[]): Record<string, GameStats> {
  const out: Record<string, GameStats> = {};
  for (const s of stats) {
    out[s.playerId] = { ...s };
  }
  return out;
}

/** Replay all events once and capture cumulative stats after each event. */
export function buildPbpStatSnapshots(
  homeTeam: Team,
  awayTeam: Team,
  events: GameEvent[]
): Map<string, PbpEventSnapshot> {
  const snapshots = new Map<string, PbpEventSnapshot>();
  let game = createReplayGame(homeTeam, awayTeam);

  for (const event of events) {
    if (event.type === 'shot_attempt' && event.playerId) {
      const d = event.details;
      const shot: Shot = {
        id: `shot-${event.id}`,
        playerId: event.playerId,
        x: typeof d.x === 'number' ? d.x : 50,
        y: typeof d.y === 'number' ? d.y : 50,
        made: !!d.made,
        isThree: !!d.isThree,
        timestamp: event.timestamp,
        assistedBy: d.assistedBy,
        blockedBy: d.blockedBy,
        isTransition: d.isTransition,
        inPaint: d.inPaint,
        period: event.period,
        gameTime: event.gameTime,
      };
      game = { ...game, shots: [...game.shots, shot] };
    }

    game = GameLogic.recordEvent(game, event);
    snapshots.set(event.id, {
      players: clonePlayerStats(game.gameStats),
      home: { ...game.teamStats.home },
      away: { ...game.teamStats.away },
    });
  }

  return snapshots;
}

/** First name labels; disambiguate duplicates with last initial. */
export function buildFirstNameLabels(homeTeam: Team, awayTeam: Team): Map<string, string> {
  const allPlayers = [...homeTeam.players, ...awayTeam.players];
  const firstCounts = new Map<string, number>();

  for (const player of allPlayers) {
    const parts = player.name.trim().split(/\s+/);
    const first = parts[0] ?? player.name;
    firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
  }

  const labels = new Map<string, string>();
  for (const player of allPlayers) {
    const parts = player.name.trim().split(/\s+/);
    const first = parts[0] ?? player.name;
    if ((firstCounts.get(first) ?? 0) > 1 && parts.length > 1) {
      labels.set(player.id, `${first} ${parts[1][0]}.`);
    } else {
      labels.set(player.id, first);
    }
  }
  return labels;
}

export function getPlayerFirstName(
  playerId: string | undefined,
  labels: Map<string, string>
): string {
  if (!playerId) return '—';
  return labels.get(playerId) ?? 'Unknown';
}

function playerStats(
  snap: PbpEventSnapshot | undefined,
  playerId: string | undefined
): GameStats | null {
  if (!snap || !playerId) return null;
  return snap.players[playerId] ?? null;
}

function teamStatsFor(
  snap: PbpEventSnapshot | undefined,
  teamId: string,
  homeTeamId: string
): TeamStats | null {
  if (!snap) return null;
  return teamId === homeTeamId ? snap.home : snap.away;
}

function totalRebounds(stats: GameStats): number {
  return stats.orb + stats.drb;
}

function twoMade(stats: GameStats): number {
  return stats.fg_made - stats.three_made;
}

function twoAttempted(stats: GameStats): number {
  return stats.fg_attempted - stats.three_attempted;
}

function formatReboundLabel(reboundType: string): string {
  switch (reboundType) {
    case 'offensive':
      return 'ORB';
    case 'defensive':
      return 'DRB';
    case 'team_offensive':
      return 'TEAM ORB';
    case 'team_defensive':
      return 'TEAM DRB';
    default:
      return reboundType.toUpperCase();
  }
}

function formatPeriodLabel(period: number): string {
  return period <= 4 ? `Q${period}` : `OT${period - 4}`;
}

export function buildPbpRows(events: GameEvent[], homeTeam: Team, awayTeam: Team): PbpRow[] {
  const rows: PbpRow[] = [];
  for (const event of events) {
    rows.push({ kind: 'event', key: event.id, event });
    if (event.type === 'shot_attempt' && event.details.blockedBy) {
      const blockerId = event.details.blockedBy as string;
      const blockerTeamId = teamIdForPlayer(homeTeam, awayTeam, blockerId);
      if (blockerTeamId) {
        rows.push({
          kind: 'block',
          key: `${event.id}-blk`,
          shotEvent: event,
          blockerId,
          blockerTeamId,
        });
      }
    }
    if (event.type === 'foul') {
      const category = (event.details.foulCategory as string) ?? 'personal';
      const foulType = (event.details.foulType as string) ?? '';
      const partnerId = event.details.doublePartnerPlayerId as string | undefined;
      const partnerTeamId = event.details.doublePartnerTeamId as string | undefined;
      if (
        (category === 'double' || foulType === 'double') &&
        partnerId &&
        partnerTeamId
      ) {
        rows.push({
          kind: 'double_foul_partner',
          key: `${event.id}-dbl2`,
          foulEvent: event,
          partnerId,
          partnerTeamId,
        });
      }
    }
  }
  return rows;
}

function teamIdForPlayer(homeTeam: Team, awayTeam: Team, playerId: string): string | null {
  if (homeTeam.players.some((p) => p.id === playerId)) return homeTeam.id;
  if (awayTeam.players.some((p) => p.id === playerId)) return awayTeam.id;
  return null;
}

export function pbpRowSourceEvent(row: PbpRow): GameEvent {
  switch (row.kind) {
    case 'event':
      return row.event;
    case 'block':
      return row.shotEvent;
    case 'double_foul_partner':
      return row.foulEvent;
  }
}

function foulPlayerLine(stats: GameStats, event: GameEvent): string {
  const category = (event.details.foulCategory as string) ?? 'personal';
  const foulType = (event.details.foulType as string) ?? '';
  const parts: string[] = [`${stats.fouls} pf`];

  if (category === 'offensive' || foulType === 'offensive') {
    parts.push(`${stats.turnovers} to`);
  } else if (foulType === 'technical' || category === 'technical') {
    parts.push(`${stats.tech_fouls} tech`);
  } else if (foulType === 'unsportsmanlike' || category === 'unsportsmanlike') {
    parts.push(`${stats.unsportsmanlike_fouls} uns`);
  }

  return parts.join(', ');
}

export function formatPbpAction(
  row: PbpRow,
  snap: PbpEventSnapshot | undefined,
  homeTeam: Team,
  awayTeam: Team,
  labels: Map<string, string>,
  colors: { success: string; destructive: string; muted: string; away: string }
): PbpActionStyle {
  if (row.kind === 'block') {
    const blockerStats = playerStats(snap, row.blockerId);
    const shooterName = getPlayerFirstName(row.shotEvent.playerId, labels);
    const blockerName = getPlayerFirstName(row.blockerId, labels);
    const blk = blockerStats?.blocks ?? 0;
    const teamId = row.blockerTeamId;
    const color =
      teamId === homeTeam.id ? colors.success : colors.destructive;

    return {
      playerLine: `${blockerName} (${blk} blk)`,
      label: 'BLOCK',
      color,
      detail: shooterName,
    };
  }

  if (row.kind === 'double_foul_partner') {
    const partnerStats = playerStats(snap, row.partnerId);
    const primaryName = getPlayerFirstName(row.foulEvent.playerId, labels);
    const partnerName = getPlayerFirstName(row.partnerId, labels);
    const pf = partnerStats?.fouls ?? 0;

    return {
      playerLine: `${partnerName} (${pf} pf)`,
      label: 'DBL FOUL',
      color: colors.away,
      detail: primaryName,
    };
  }

  const event = row.event;
  const playerId = event.playerId;
  const stats = playerStats(snap, playerId);
  const playerName = playerId ? getPlayerFirstName(playerId, labels) : 'Team';
  const teamSnap = teamStatsFor(snap, event.teamId, homeTeam.id);

  switch (event.type) {
    case 'shot_attempt': {
      const pts = event.details.isThree ? 3 : 2;
      const made = !!event.details.made;
      const blockedBy = event.details.blockedBy as string | undefined;
      const assistedBy = event.details.assistedBy as string | undefined;
      const isThree = !!event.details.isThree;

      if (blockedBy) {
        const blockerName = getPlayerFirstName(blockedBy, labels);
        const blockerStats = playerStats(snap, blockedBy);
        const blk = blockerStats?.blocks ?? 0;
        const made2 = twoMade(stats ?? MetricsCalculator.getEmptyStats('x'));
        const att2 = twoAttempted(stats ?? MetricsCalculator.getEmptyStats('x'));
        const made3 = stats?.three_made ?? 0;
        const att3 = stats?.three_attempted ?? 0;
        const shotLine = isThree ? `${made3}/${att3} 3P` : `${made2}/${att2} 2P`;

        return {
          playerLine: `${playerName} (${shotLine})`,
          label: 'BLOCKED',
          color: colors.destructive,
          detail: `BLK ${blockerName} (${blk} blk)`,
        };
      }

      if (made) {
        const points = stats?.points ?? 0;
        const detail = assistedBy
          ? `AST ${getPlayerFirstName(assistedBy, labels)} (${playerStats(snap, assistedBy)?.assists ?? 0} ast)`
          : undefined;
        return {
          playerLine: `${playerName} (${points} pts)`,
          label: `${pts}PT MAKE`,
          color: colors.success,
          detail,
        };
      }

      const empty = MetricsCalculator.getEmptyStats(playerId ?? 'x');
      const s = stats ?? empty;
      const shotLine = isThree
        ? `${s.three_made}/${s.three_attempted} 3P`
        : `${twoMade(s)}/${twoAttempted(s)} 2P`;

      return {
        playerLine: `${playerName} (${shotLine})`,
        label: `${pts}PT MISS`,
        color: colors.destructive,
      };
    }

    case 'free_throw': {
      const made = !!event.details.made;
      const ftMade = stats?.ft_made ?? 0;
      const ftAtt = stats?.ft_attempted ?? 0;
      const ftLine = `${ftMade}/${ftAtt} ft`;

      if (made) {
        const points = stats?.points ?? 0;
        return {
          playerLine: `${playerName} (${points} pts)`,
          label: 'FT MAKE',
          color: colors.success,
          detail: `(${ftLine})`,
        };
      }

      return {
        playerLine: `${playerName} (${ftLine})`,
        label: 'FT MISS',
        color: colors.destructive,
      };
    }

    case 'rebound': {
      const rt = (event.details.reboundType as string) ?? 'reb';
      const isTeam = rt === 'team_offensive' || rt === 'team_defensive';
      const isOffensive = rt === 'offensive' || rt === 'team_offensive';

      if (isTeam && teamSnap) {
        const teamReb = isOffensive ? teamSnap.orb : teamSnap.drb;
        const teamLabel = isOffensive ? 'team orb' : 'team drb';
        return {
          playerLine: 'Team',
          label: `${teamLabel} (${teamReb})`,
          color: colors.muted,
        };
      }

      const rebTotal = stats ? totalRebounds(stats) : 0;
      const typeCount = isOffensive ? (stats?.orb ?? 0) : (stats?.drb ?? 0);
      const typeLabel = isOffensive ? 'orb' : 'drb';

      return {
        playerLine: `${playerName} (${rebTotal} reb)`,
        label: `${typeLabel} (${typeCount})`,
        color: colors.muted,
      };
    }

    case 'foul': {
      const foulType = (event.details.foulType as string) ?? 'normal';
      const category = (event.details.foulCategory as string) ?? 'personal';
      const drawnBy = event.details.drawnBy as string | undefined;
      const isTeamFoul = !!event.details.isTeamFoul;
      const isCoachFoul = !!event.details.isCoachFoul;

      let label = 'FOUL';
      if (category === 'technical' || foulType === 'technical') label = 'TECH';
      else if (category === 'offensive' || foulType === 'offensive') label = 'OFF FOUL';
      else if (category === 'unsportsmanlike' || foulType === 'unsportsmanlike') label = 'UNS';
      else if (category === 'double' || foulType === 'double') label = 'DBL FOUL';

      if (isTeamFoul || isCoachFoul) {
        const teamFouls = teamSnap?.fouls ?? 0;
        const detailParts: string[] = [];
        if (isCoachFoul) detailParts.push('Coach');
        return {
          playerLine: 'Team',
          label: `${label} (${teamFouls} pf)`,
          color: colors.away,
          detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
        };
      }

      const s = stats ?? MetricsCalculator.getEmptyStats(playerId ?? 'x');
      const detailParts: string[] = [];
      if (drawnBy) {
        const drawerStats = playerStats(snap, drawnBy);
        detailParts.push(
          `FD ${getPlayerFirstName(drawnBy, labels)} (${drawerStats?.fouls_drawn ?? 0} fd)`
        );
      }

      return {
        playerLine: `${playerName} (${foulPlayerLine(s, event)})`,
        label,
        color: colors.away,
        detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
      };
    }

    case 'turnover': {
      const isTeam = !!event.details.isTeamTurnover;
      const stolenBy = event.details.stolenBy as string | undefined;

      if (isTeam && teamSnap) {
        return {
          playerLine: 'Team',
          label: `TURNOVER (${teamSnap.turnovers} to)`,
          color: colors.destructive,
        };
      }

      const to = stats?.turnovers ?? 0;
      const detail =
        stolenBy && stolenBy !== 'team'
          ? `STL ${getPlayerFirstName(stolenBy, labels)} (${playerStats(snap, stolenBy)?.steals ?? 0} stl)`
          : undefined;

      return {
        playerLine: `${playerName} (${to} to)`,
        label: 'TURNOVER',
        color: colors.destructive,
        detail,
      };
    }

    case 'jump_ball': {
      const kind = event.details.kind as string;
      if (kind === 'opening') {
        const winnerId = event.details.winnerTeamId as string;
        const abbrev =
          winnerId === homeTeam.id ? homeTeam.abbreviation : awayTeam.abbreviation;
        return {
          playerLine: abbrev,
          label: 'OPENING TIP',
          color: colors.muted,
        };
      }
      const awardedId = event.details.awardedTeamId as string;
      const abbrev =
        awardedId === homeTeam.id ? homeTeam.abbreviation : awayTeam.abbreviation;
      const stealId = event.details.stealPlayerId as string | undefined;
      const toPlayer = stats?.turnovers ?? 0;

      return {
        playerLine: playerId ? `${playerName} (${toPlayer} to)` : abbrev,
        label: 'JUMP BALL',
        color: colors.muted,
        detail: stealId
          ? `${abbrev} · STL ${getPlayerFirstName(stealId, labels)} (${playerStats(snap, stealId)?.steals ?? 0} stl)`
          : `${abbrev} · arrow flip`,
      };
    }

    case 'substitution': {
      const clock = (event.details.clockTime as string) ?? event.gameTime;
      return {
        playerLine: 'Sub',
        label: 'SUB',
        color: colors.muted,
        detail: `${clock} · ${(event.details.playersIn as string[])?.length ?? 0} in`,
      };
    }

    case 'period_start': {
      const p = (event.details.period as number) ?? event.period;
      const label = p <= 4 ? `START Q${p}` : `START OT${p - 4}`;
      const possessionTeamId = event.details.possessionTeamId as string | undefined;
      const possessionAbbr =
        possessionTeamId === homeTeam.id
          ? homeTeam.abbreviation
          : possessionTeamId === awayTeam.id
            ? awayTeam.abbreviation
            : undefined;
      return {
        playerLine: possessionAbbr ?? '—',
        label,
        color: colors.muted,
        detail: possessionAbbr ? `${possessionAbbr} ball` : undefined,
      };
    }

    case 'period_end': {
      const p = (event.details.period as number) ?? event.period;
      const label = p <= 4 ? `END Q${p}` : `END OT${p - 4}`;
      return {
        playerLine: formatPeriodLabel(p),
        label,
        color: colors.muted,
      };
    }

    default:
      return {
        playerLine: playerName,
        label: event.type.toUpperCase().replace(/_/g, ' '),
        color: colors.muted,
      };
  }
}
