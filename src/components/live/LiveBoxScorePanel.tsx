import React, { useMemo, useState } from 'react';
import type { Game, GameStats } from '../../App';
import { MetricsCalculator } from '../MetricsCalculator';
import { playerPlayedInGame } from '../../utils/gameDisplay';
import { orderBoxScorePlayers } from '../../utils/boxScoreOrder';
import { Button } from '../ui/button';
import { getLiveTeamColor, liveTeamTint, LIVE_SEMANTIC, LIVE_TEAM_HEX } from './liveEntryTheme';

interface LiveBoxScorePanelProps {
  game: Game;
  onCourtHomeIds?: string[];
  onCourtAwayIds?: string[];
  onCompleteGame?: () => void;
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

type PlayerRow = GameStats & { name: string; number: string; playerId: string };

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
      team.players
        .filter((p) => playerPlayedInGame(game, p.id, team.id))
        .map((p) => {
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
                  <span className="live-font-mono live-box-num" style={{ color }}>
                    {p.number}
                  </span>
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
                          ? 'color-mix(in srgb, var(--destructive) 55%, transparent)'
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

export function LiveBoxScorePanel({
  game,
  onCourtHomeIds = [],
  onCourtAwayIds = [],
  onCompleteGame,
}: LiveBoxScorePanelProps) {
  const homeColor = LIVE_TEAM_HEX.home;
  const awayColor = LIVE_TEAM_HEX.away;

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
        <span className="live-font-mono live-box-hint">Click column to sort</span>
        {onCompleteGame && (
          <Button size="sm" className="live-box-complete-btn h-7 text-xs" onClick={onCompleteGame}>
            Complete game
          </Button>
        )}
      </div>

      <div className="live-box-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="live-box-table-section">
          <FigmaBoxScoreTable game={game} side="home" onCourtIds={onCourtHomeIds} />
        </div>
        <div className="live-box-table-section live-box-table-section--away">
          <FigmaBoxScoreTable game={game} side="away" onCourtIds={onCourtAwayIds} />
        </div>
      </div>
    </div>
  );
}
