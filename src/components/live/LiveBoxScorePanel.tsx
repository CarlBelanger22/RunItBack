import React, { useMemo, useState } from 'react';
import type { Game, GameStats } from '../../App';
import { MetricsCalculator } from '../MetricsCalculator';
import { orderBoxScorePlayers } from '../../utils/boxScoreOrder';
import { Button } from '../ui/button';
import { getLiveTeamColor, liveTeamTint, LIVE_SEMANTIC, LIVE_TEAM_HEX } from './liveEntryTheme';
import { tournamentRecordsStat } from '../../utils/statRecordingCoverage';
import { NoStatRecorded } from '../StatDisplay';

interface LiveBoxScorePanelProps {
  game: Game;
  onCourtHomeIds?: string[];
  onCourtAwayIds?: string[];
  onCompleteGame?: () => void;
}

type BoxScoreView = 'traditional' | 'advanced';

type PlayerRowLiveFull = GameStats & {
  playerId: string;
  name: string;
  number: number;
  reb: number;

  // Derived shooting percentages (0-100)
  fgPct: number;
  threePct: number;
  ftPct: number;

  // Advanced metrics
  efficiency: number; // EFF
  gameScore: number; // GmSc
  twoPointPercentage: number; // 2P%
  twoPointMade: number; // 2P made
  twoPointAttempted: number; // 2P attempted

  // Shot chart derived points (null when no shot chart data exists yet)
  paintPoints: number | null; // Paint points
  fastbreakPoints: number | null; // Fastbreak points
};

function formatTime(minutes: number) {
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatPercentage(value: number) {
  return value > 0 ? `${value.toFixed(1)}%` : '0.0%';
}

function formatStat(value: number, decimals: number = 1) {
  return value > 0 ? value.toFixed(decimals) : '0';
}

type StatKey =
  | 'points'
  | 'fg_made'
  | 'fg_attempted'
  | 'three_made'
  | 'three_attempted'
  | 'ft_made'
  | 'ft_attempted'
  | 'reb'
  | 'assists'
  | 'steals'
  | 'blocks'
  | 'turnovers'
  | 'fouls';

const COLS: { key: StatKey; label: string }[] = [
  { key: 'points', label: 'PTS' },
  { key: 'fg_made', label: 'FGM' },
  { key: 'fg_attempted', label: 'FGA' },
  { key: 'three_made', label: '3PM' },
  { key: 'three_attempted', label: '3PA' },
  { key: 'ft_made', label: 'FTM' },
  { key: 'ft_attempted', label: 'FTA' },
  { key: 'reb', label: 'REB' },
  { key: 'assists', label: 'AST' },
  { key: 'steals', label: 'STL' },
  { key: 'blocks', label: 'BLK' },
  { key: 'turnovers', label: 'TO' },
  { key: 'fouls', label: 'PF' },
];

type PlayerRow = GameStats & { name: string; number: number; playerId: string };

function statValue(player: PlayerRow, key: StatKey): number {
  if (key === 'reb') return player.orb + player.drb;
  if (key === 'points') return player.points;
  if (key === 'fouls') return player.fouls;
  return player[key];
}

function fgPct(m: number, a: number): string {
  return a > 0 ? `${Math.round((m / a) * 100)}%` : '—';
}

function FigmaBoxScoreTable({
  game,
  side,
  onCourtIds,
}: {
  game: Game;
  side: 'home' | 'away';
  onCourtIds: string[];
}) {
  const team = side === 'home' ? game.homeTeam : game.awayTeam;
  const starterIds = side === 'home' ? game.homeStarters : game.awayStarters;
  const color = getLiveTeamColor(side);

  const [sortKey, setSortKey] = useState<StatKey>('points');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const players = useMemo(() => {
    const rows = orderBoxScorePlayers(
      team.players.map((p) => {
        const stats =
          game.gameStats.find((s) => s.playerId === p.id) ??
          MetricsCalculator.getEmptyStats(p.id);
        return {
          ...stats,
          playerId: p.id,
          name: p.name,
          number: p.number,
        };
      }),
      starterIds ?? []
    );

    return rows
      .filter((r) => r.kind !== 'divider' && r.player)
      .map((r) => r.player as PlayerRow);
  }, [game, team, starterIds]);

  const sorted = useMemo(() => {
    return [...players].sort((a, b) => {
      const av = statValue(a, sortKey);
      const bv = statValue(b, sortKey);
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [players, sortKey, sortDir]);

  const totals = useMemo(() => {
    return players.reduce(
      (acc, p) => {
        COLS.forEach((c) => {
          acc[c.key] = (acc[c.key] ?? 0) + statValue(p, c.key);
        });
        return acc;
      },
      {} as Record<StatKey, number>
    );
  }, [players]);

  const handleSort = (key: StatKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const onCourtSet = new Set(onCourtIds);
  return (
    <div className="live-box-table-wrap">
      <table className="live-box-table">
        <thead>
          <tr>
            <th className="live-box-th-player">PLAYER</th>
            {COLS.map((c) => (
              <th
                key={c.key}
                className="live-box-th-stat"
                style={{ color: sortKey === c.key ? color : LIVE_SEMANTIC.muted }}
                onClick={() => handleSort(c.key)}
              >
                {c.label}
                {sortKey === c.key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
              </th>
            ))}
            <th className="live-box-th-stat" style={{ color: LIVE_SEMANTIC.muted }}>
              FG%
            </th>
            <th className="live-box-th-stat" style={{ color: LIVE_SEMANTIC.muted }}>
              3P%
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.playerId} className="live-box-tr">
              <td className="live-box-td-player">
                <div className="live-box-player-cell">
                  <span
                    className="live-box-on-court-dot"
                    style={{ background: onCourtSet.has(p.playerId) ? color : LIVE_SEMANTIC.inactive }}
                  />
                  <span className="live-font-mono live-box-num">{p.number}</span>
                  <span className="live-box-name">{p.name}</span>
                </div>
              </td>
              {COLS.map((c) => (
                <td
                  key={c.key}
                  className="live-box-td-stat"
                  style={{
                    color:
                      c.key === 'points'
                        ? LIVE_SEMANTIC.foreground
                        : c.key === 'turnovers' || c.key === 'fouls'
                          ? 'color-mix(in srgb, var(--live-danger) 55%, transparent)'
                          : LIVE_SEMANTIC.muted,
                    fontWeight: c.key === 'points' ? 700 : 400,
                  }}
                >
                  {statValue(p, c.key)}
                </td>
              ))}
              <td className="live-box-td-stat" style={{ color: LIVE_SEMANTIC.muted }}>
                {fgPct(p.fg_made, p.fg_attempted)}
              </td>
              <td className="live-box-td-stat" style={{ color: LIVE_SEMANTIC.muted }}>
                {fgPct(p.three_made, p.three_attempted)}
              </td>
            </tr>
          ))}
          {sorted.length > 0 && (
            <tr className="live-box-totals-row" style={{ borderTopColor: liveTeamTint(side, '33'), background: liveTeamTint(side, '08') }}>
              <td className="live-box-td-player live-font-condensed live-box-totals-label">
                TEAM TOTALS
              </td>
              {COLS.map((c) => (
                <td key={c.key} className="live-box-td-stat live-box-totals-val" style={{ color }}>
                  {totals[c.key] ?? 0}
                </td>
              ))}
              <td className="live-box-td-stat live-box-totals-val" style={{ color }}>
                {fgPct(totals.fg_made ?? 0, totals.fg_attempted ?? 0)}
              </td>
              <td className="live-box-td-stat live-box-totals-val" style={{ color }}>
                {fgPct(totals.three_made ?? 0, totals.three_attempted ?? 0)}
              </td>
            </tr>
          )}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLS.length + 3} className="live-box-empty">
                No stats yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LiveBoxScoreTableWithView({
  game,
  side,
  onCourtIds,
  view,
}: {
  game: Game;
  side: 'home' | 'away';
  onCourtIds: string[];
  view: BoxScoreView;
}) {
  const team = side === 'home' ? game.homeTeam : game.awayTeam;
  const starterIds = side === 'home' ? game.homeStarters : game.awayStarters;
  const color = getLiveTeamColor(side);

  const recordsPlusMinus = tournamentRecordsStat(game.tournamentId, 'plus_minus');
  const recordsFoulsDrawn = tournamentRecordsStat(game.tournamentId, 'fouls_drawn');

  type TraditionalSortKey =
    | 'minutes_played'
    | 'points'
    | 'fg_made'
    | 'fg_pct'
    | 'three_made'
    | 'three_pct'
    | 'ft_made'
    | 'ft_pct'
    | 'orb'
    | 'drb'
    | 'reb'
    | 'assists'
    | 'steals'
    | 'blocks'
    | 'turnovers'
    | 'fouls'
    | 'plus_minus';

  type AdvancedSortKey =
    | 'minutes_played'
    | 'efficiency'
    | 'gameScore'
    | 'twoPointPercentage'
    | 'twoPointMade'
    | 'paintPoints'
    | 'fastbreakPoints'
    | 'fouls_drawn'
    | 'blocks_received'
    | 'tech_fouls'
    | 'unsportsmanlike_fouls';

  const [traditionalSortKey, setTraditionalSortKey] = useState<TraditionalSortKey>('points');
  const [traditionalSortDir, setTraditionalSortDir] = useState<'desc' | 'asc'>('desc');

  const [advancedSortKey, setAdvancedSortKey] = useState<AdvancedSortKey>('efficiency');
  const [advancedSortDir, setAdvancedSortDir] = useState<'desc' | 'asc'>('desc');

  const { hasShotChart, paintFastMap } = useMemo(() => {
    const hasShotChart = game.shots.length > 0;
    const map = new Map<string, { paintPoints: number; fastbreakPoints: number }>();

    if (!hasShotChart) return { hasShotChart, paintFastMap: map };

    for (const shot of game.shots) {
      if (!shot.made) continue;
      const pts = shot.isThree ? 3 : 2;
      const prev = map.get(shot.playerId) ?? { paintPoints: 0, fastbreakPoints: 0 };
      if (shot.inPaint) prev.paintPoints += pts;
      if (shot.isTransition) prev.fastbreakPoints += pts;
      map.set(shot.playerId, prev);
    }

    return { hasShotChart, paintFastMap: map };
  }, [game.shots]);

  const players = useMemo(() => {
    const rows = orderBoxScorePlayers(
      team.players.map((p) => {
        const stats =
          game.gameStats.find((s) => s.playerId === p.id) ?? MetricsCalculator.getEmptyStats(p.id);
        const adv = MetricsCalculator.calculateAdvancedMetrics(stats);

        const paintTotals = paintFastMap.get(p.id);

        return {
          ...stats,
          playerId: p.id,
          name: p.name,
          number: p.number,

          reb: stats.orb + stats.drb,

          fgPct: stats.fg_attempted > 0 ? (stats.fg_made / stats.fg_attempted) * 100 : 0,
          threePct: stats.three_attempted > 0 ? (stats.three_made / stats.three_attempted) * 100 : 0,
          ftPct: stats.ft_attempted > 0 ? (stats.ft_made / stats.ft_attempted) * 100 : 0,

          efficiency: adv.efficiency,
          gameScore: adv.gameScore,
          twoPointPercentage: adv.twoPointPercentage,
          twoPointMade: adv.twoPointMade,
          twoPointAttempted: adv.twoPointAttempted,

          paintPoints: hasShotChart ? paintTotals?.paintPoints ?? 0 : null,
          fastbreakPoints: hasShotChart ? paintTotals?.fastbreakPoints ?? 0 : null,
        } satisfies PlayerRowLiveFull;
      }),
      starterIds ?? []
    );

    return rows
      .filter((r) => r.kind !== 'divider' && r.player)
      .map((r) => r.player as PlayerRowLiveFull);
  }, [game, team, starterIds, hasShotChart, paintFastMap]);

  const sortedTraditional = useMemo(() => {
    const valueForSort = (p: PlayerRowLiveFull) => {
      switch (traditionalSortKey) {
        case 'minutes_played':
          return p.minutes_played;
        case 'points':
          return p.points;
        case 'fg_made':
          return p.fg_made;
        case 'fg_pct':
          return p.fgPct;
        case 'three_made':
          return p.three_made;
        case 'three_pct':
          return p.threePct;
        case 'ft_made':
          return p.ft_made;
        case 'ft_pct':
          return p.ftPct;
        case 'orb':
          return p.orb;
        case 'drb':
          return p.drb;
        case 'reb':
          return p.reb;
        case 'assists':
          return p.assists;
        case 'steals':
          return p.steals;
        case 'blocks':
          return p.blocks;
        case 'turnovers':
          return p.turnovers;
        case 'fouls':
          return p.fouls;
        case 'plus_minus':
          return recordsPlusMinus ? p.plus_minus : 0;
        default:
          return 0;
      }
    };

    return [...players].sort((a, b) => {
      const av = valueForSort(a);
      const bv = valueForSort(b);
      return traditionalSortDir === 'desc' ? bv - av : av - bv;
    });
  }, [players, traditionalSortKey, traditionalSortDir, recordsPlusMinus]);

  const totalsTraditional = useMemo(() => {
    return players.reduce(
      (acc, p) => {
        acc.minutes_played += p.minutes_played;
        acc.points += p.points;

        acc.fg_made += p.fg_made;
        acc.fg_attempted += p.fg_attempted;
        acc.three_made += p.three_made;
        acc.three_attempted += p.three_attempted;
        acc.ft_made += p.ft_made;
        acc.ft_attempted += p.ft_attempted;

        acc.orb += p.orb;
        acc.drb += p.drb;

        acc.assists += p.assists;
        acc.steals += p.steals;
        acc.blocks += p.blocks;
        acc.turnovers += p.turnovers;
        acc.fouls += p.fouls;

        acc.plus_minus += p.plus_minus;
        return acc;
      },
      {
        minutes_played: 0,
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
        plus_minus: 0,
      }
    );
  }, [players]);

  const sortedAdvanced = useMemo(() => {
    const valueForSort = (p: PlayerRowLiveFull) => {
      switch (advancedSortKey) {
        case 'minutes_played':
          return p.minutes_played;
        case 'efficiency':
          return p.efficiency;
        case 'gameScore':
          return p.gameScore;
        case 'twoPointPercentage':
          return p.twoPointPercentage;
        case 'twoPointMade':
          return p.twoPointMade;
        case 'paintPoints':
          return p.paintPoints === null ? -Infinity : p.paintPoints;
        case 'fastbreakPoints':
          return p.fastbreakPoints === null ? -Infinity : p.fastbreakPoints;
        case 'fouls_drawn':
          return p.fouls_drawn;
        case 'blocks_received':
          return p.blocks_received;
        case 'tech_fouls':
          return p.tech_fouls;
        case 'unsportsmanlike_fouls':
          return p.unsportsmanlike_fouls;
        default:
          return 0;
      }
    };

    return [...players].sort((a, b) => {
      const av = valueForSort(a);
      const bv = valueForSort(b);
      return advancedSortDir === 'desc' ? bv - av : av - bv;
    });
  }, [players, advancedSortKey, advancedSortDir]);

  const handleTraditionalSort = (key: TraditionalSortKey) => {
    if (key === traditionalSortKey) {
      setTraditionalSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setTraditionalSortKey(key);
      setTraditionalSortDir('desc');
    }
  };

  const handleAdvancedSort = (key: AdvancedSortKey) => {
    if (key === advancedSortKey) {
      setAdvancedSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setAdvancedSortKey(key);
      setAdvancedSortDir('desc');
    }
  };

  const onCourtSet = new Set(onCourtIds);

  if (view === 'advanced') {
    const renderSortHeader = (key: AdvancedSortKey, label: string) => {
      const displayColor = advancedSortKey === key ? color : LIVE_SEMANTIC.muted;
      return (
        <th
          key={key}
          className="live-box-th-stat"
          style={{ color: displayColor }}
          onClick={() => handleAdvancedSort(key)}
        >
          {label}
          {advancedSortKey === key ? (advancedSortDir === 'desc' ? ' ▼' : ' ▲') : ''}
        </th>
      );
    };

    return (
      <div className="live-box-table-wrap">
        <table className="live-box-table">
          <thead>
            <tr>
              <th className="live-box-th-player">PLAYER</th>
              {renderSortHeader('minutes_played', 'MIN')}
              {renderSortHeader('efficiency', 'EFF')}
              {renderSortHeader('gameScore', 'GmSc')}
              {renderSortHeader('twoPointPercentage', '2P%')}
              {renderSortHeader('twoPointMade', '2P')}
              {renderSortHeader('paintPoints', 'Paint')}
              {renderSortHeader('fastbreakPoints', 'FB')}
              {renderSortHeader('fouls_drawn', 'FD')}
              {renderSortHeader('blocks_received', 'BA')}
              {renderSortHeader('tech_fouls', 'TF')}
              {renderSortHeader('unsportsmanlike_fouls', 'UF')}
            </tr>
          </thead>
          <tbody>
            {sortedAdvanced.map((p) => (
              <tr key={p.playerId} className="live-box-tr">
                <td className="live-box-td-player">
                  <div className="live-box-player-cell">
                    <span
                      className="live-box-on-court-dot"
                      style={{
                        background: onCourtSet.has(p.playerId) ? color : LIVE_SEMANTIC.inactive,
                      }}
                    />
                    <span className="live-font-mono live-box-num">{p.number}</span>
                    <span className="live-box-name">{p.name}</span>
                  </div>
                </td>

                <td className="live-box-td-stat">{formatTime(p.minutes_played)}</td>
                <td className="live-box-td-stat">{formatStat(p.efficiency, 0)}</td>
                <td className="live-box-td-stat">{formatStat(p.gameScore, 1)}</td>
                <td className="live-box-td-stat">{formatPercentage(p.twoPointPercentage)}</td>
                <td className="live-box-td-stat">
                  {p.twoPointMade}/{p.twoPointAttempted}
                </td>
                <td className="live-box-td-stat">
                  {p.paintPoints === null ? <NoStatRecorded /> : p.paintPoints}
                </td>
                <td className="live-box-td-stat">
                  {p.fastbreakPoints === null ? <NoStatRecorded /> : p.fastbreakPoints}
                </td>
                <td className="live-box-td-stat">
                  {recordsFoulsDrawn ? p.fouls_drawn : <NoStatRecorded />}
                </td>
                <td className="live-box-td-stat">{p.blocks_received}</td>
                <td className="live-box-td-stat">{p.tech_fouls}</td>
                <td className="live-box-td-stat">{p.unsportsmanlike_fouls}</td>
              </tr>
            ))}

            {sortedAdvanced.length === 0 && (
              <tr>
                <td colSpan={12} className="live-box-empty">
                  No stats yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const renderTraditionalSortHeader = (key: TraditionalSortKey, label: string) => {
    const displayColor = traditionalSortKey === key ? color : LIVE_SEMANTIC.muted;
    return (
      <th
        key={key}
        className="live-box-th-stat"
        style={{ color: displayColor }}
        onClick={() => handleTraditionalSort(key)}
      >
        {label}
        {traditionalSortKey === key ? (traditionalSortDir === 'desc' ? ' ▼' : ' ▲') : ''}
      </th>
    );
  };

  return (
    <div className="live-box-table-wrap">
      <table className="live-box-table">
        <thead>
          <tr>
            <th className="live-box-th-player">PLAYER</th>
            {renderTraditionalSortHeader('minutes_played', 'MIN')}
            {renderTraditionalSortHeader('points', 'PTS')}

            {renderTraditionalSortHeader('fg_made', 'FG')}
            {renderTraditionalSortHeader('fg_pct', 'FG%')}

            {renderTraditionalSortHeader('three_made', '3P')}
            {renderTraditionalSortHeader('three_pct', '3P%')}

            {renderTraditionalSortHeader('ft_made', 'FT')}
            {renderTraditionalSortHeader('ft_pct', 'FT%')}

            {renderTraditionalSortHeader('orb', 'ORB')}
            {renderTraditionalSortHeader('drb', 'DRB')}
            {renderTraditionalSortHeader('reb', 'REB')}

            {renderTraditionalSortHeader('assists', 'AST')}
            {renderTraditionalSortHeader('steals', 'STL')}
            {renderTraditionalSortHeader('blocks', 'BLK')}
            {renderTraditionalSortHeader('turnovers', 'TO')}
            {renderTraditionalSortHeader('fouls', 'PF')}
            {renderTraditionalSortHeader('plus_minus', '+/-')}
          </tr>
        </thead>
        <tbody>
          {sortedTraditional.map((p) => (
            <tr key={p.playerId} className="live-box-tr">
              <td className="live-box-td-player">
                <div className="live-box-player-cell">
                  <span
                    className="live-box-on-court-dot"
                    style={{
                      background: onCourtSet.has(p.playerId) ? color : LIVE_SEMANTIC.inactive,
                    }}
                  />
                  <span className="live-font-mono live-box-num">{p.number}</span>
                  <span className="live-box-name">{p.name}</span>
                </div>
              </td>

              <td className="live-box-td-stat">{formatTime(p.minutes_played)}</td>
              <td className="live-box-td-stat" style={{ color: LIVE_SEMANTIC.foreground, fontWeight: 700 }}>
                {p.points}
              </td>

              <td className="live-box-td-stat">
                {p.fg_made}/{p.fg_attempted}
              </td>
              <td className="live-box-td-stat">{formatPercentage(p.fgPct)}</td>

              <td className="live-box-td-stat">
                {p.three_made}/{p.three_attempted}
              </td>
              <td className="live-box-td-stat">{formatPercentage(p.threePct)}</td>

              <td className="live-box-td-stat">
                {p.ft_made}/{p.ft_attempted}
              </td>
              <td className="live-box-td-stat">{formatPercentage(p.ftPct)}</td>

              <td className="live-box-td-stat">{p.orb}</td>
              <td className="live-box-td-stat">{p.drb}</td>
              <td className="live-box-td-stat">{p.reb}</td>

              <td className="live-box-td-stat">{p.assists}</td>
              <td className="live-box-td-stat">{p.steals}</td>
              <td className="live-box-td-stat">{p.blocks}</td>

              <td className="live-box-td-stat" style={{ color: 'color-mix(in srgb, var(--live-danger) 55%, transparent)' }}>
                {p.turnovers}
              </td>
              <td className="live-box-td-stat" style={{ color: 'color-mix(in srgb, var(--live-danger) 55%, transparent)' }}>
                {p.fouls}
              </td>

              <td
                className="live-box-td-stat"
                style={{
                  color: recordsPlusMinus
                    ? p.plus_minus < 0
                      ? 'color-mix(in srgb, var(--live-danger) 55%, transparent)'
                      : LIVE_SEMANTIC.foreground
                    : LIVE_SEMANTIC.muted,
                }}
              >
                {recordsPlusMinus ? (p.plus_minus >= 0 ? `+${p.plus_minus}` : p.plus_minus) : <NoStatRecorded />}
              </td>
            </tr>
          ))}

          {sortedTraditional.length > 0 && (
            <tr
              className="live-box-totals-row"
              style={{ borderTopColor: liveTeamTint(side, '33'), background: liveTeamTint(side, '08') }}
            >
              <td className="live-box-td-player live-font-condensed live-box-totals-label">TEAM TOTALS</td>

              <td className="live-box-td-stat live-box-totals-val">{formatTime(totalsTraditional.minutes_played)}</td>
              <td className="live-box-td-stat live-box-totals-val" style={{ color: LIVE_SEMANTIC.foreground }}>
                {totalsTraditional.points}
              </td>

              <td className="live-box-td-stat live-box-totals-val">
                {totalsTraditional.fg_made}/{totalsTraditional.fg_attempted}
              </td>
              <td className="live-box-td-stat live-box-totals-val">
                {formatPercentage(
                  totalsTraditional.fg_attempted > 0
                    ? (totalsTraditional.fg_made / totalsTraditional.fg_attempted) * 100
                    : 0
                )}
              </td>

              <td className="live-box-td-stat live-box-totals-val">
                {totalsTraditional.three_made}/{totalsTraditional.three_attempted}
              </td>
              <td className="live-box-td-stat live-box-totals-val">
                {formatPercentage(
                  totalsTraditional.three_attempted > 0
                    ? (totalsTraditional.three_made / totalsTraditional.three_attempted) * 100
                    : 0
                )}
              </td>

              <td className="live-box-td-stat live-box-totals-val">
                {totalsTraditional.ft_made}/{totalsTraditional.ft_attempted}
              </td>
              <td className="live-box-td-stat live-box-totals-val">
                {formatPercentage(
                  totalsTraditional.ft_attempted > 0
                    ? (totalsTraditional.ft_made / totalsTraditional.ft_attempted) * 100
                    : 0
                )}
              </td>

              <td className="live-box-td-stat live-box-totals-val">{totalsTraditional.orb}</td>
              <td className="live-box-td-stat live-box-totals-val">{totalsTraditional.drb}</td>
              <td className="live-box-td-stat live-box-totals-val">{totalsTraditional.orb + totalsTraditional.drb}</td>

              <td className="live-box-td-stat live-box-totals-val">{totalsTraditional.assists}</td>
              <td className="live-box-td-stat live-box-totals-val">{totalsTraditional.steals}</td>
              <td className="live-box-td-stat live-box-totals-val">{totalsTraditional.blocks}</td>

              <td
                className="live-box-td-stat live-box-totals-val"
                style={{ color: 'color-mix(in srgb, var(--live-danger) 55%, transparent)' }}
              >
                {totalsTraditional.turnovers}
              </td>
              <td
                className="live-box-td-stat live-box-totals-val"
                style={{ color: 'color-mix(in srgb, var(--live-danger) 55%, transparent)' }}
              >
                {totalsTraditional.fouls}
              </td>
              <td className="live-box-td-stat live-box-totals-val">
                <NoStatRecorded />
              </td>
            </tr>
          )}

          {sortedTraditional.length === 0 && (
            <tr>
              <td colSpan={18} className="live-box-empty">
                No stats yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function LiveBoxScorePanel({
  game,
  onCourtHomeIds = [],
  onCourtAwayIds = [],
  onCompleteGame,
}: LiveBoxScorePanelProps) {
  const homeColor = LIVE_TEAM_HEX.home;
  const awayColor = LIVE_TEAM_HEX.away;
  const [view, setView] = useState<BoxScoreView>('traditional');

  return (
    <div className="live-box-panel">
      <div className="live-box-panel-header">
        <div className="live-box-tab live-box-tab--active" style={{ borderColor: homeColor }}>
          <span className="live-box-tab-dot" style={{ background: homeColor }} />
          <span className="live-font-condensed live-box-tab-label" style={{ color: homeColor }}>
            {game.homeTeam.name} — Box Score
          </span>
        </div>
        <div className="live-box-tab-divider" />
        <div className="live-box-tab" style={{ borderColor: awayColor }}>
          <span className="live-box-tab-dot" style={{ background: awayColor }} />
          <span className="live-font-condensed live-box-tab-label" style={{ color: awayColor }}>
            {game.awayTeam.name} — Box Score
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            size="sm"
            variant={view === 'traditional' ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setView('traditional')}
          >
            Traditional
          </Button>
          <Button
            size="sm"
            variant={view === 'advanced' ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setView('advanced')}
          >
            Advanced
          </Button>
        </div>
        <span className="live-font-mono live-box-hint" style={{ marginLeft: 0 }}>
          Click column to sort
        </span>
        {onCompleteGame && (
          <Button size="sm" className="live-box-complete-btn h-7 text-xs" onClick={onCompleteGame}>
            Complete game
          </Button>
        )}
      </div>

      <div className="live-box-scroll">
        <div className="live-box-table-section">
          <LiveBoxScoreTableWithView
            game={game}
            side="home"
            onCourtIds={onCourtHomeIds}
            view={view}
          />
        </div>
        <div className="live-box-table-section live-box-table-section--away">
          <LiveBoxScoreTableWithView
            game={game}
            side="away"
            onCourtIds={onCourtAwayIds}
            view={view}
          />
        </div>
      </div>
    </div>
  );
}
