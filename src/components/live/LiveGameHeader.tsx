import React from 'react';
import type { Game } from '../../App';
import { Button } from '../ui/button';
import { Edit2, SkipForward, Trash2, Undo, ArrowLeft } from 'lucide-react';
import { liveTeamTint, LIVE_TEAM_HEX } from './liveEntryTheme';

interface LiveGameHeaderProps {
  game: Game;
  homeScore: number;
  awayScore: number;
  offenseTeamId: string;
  clockRunning: boolean;
  onToggleClock: () => void;
  onUndo: () => void;
  onEndPeriod: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canUndo: boolean;
  onBack?: () => void;
  tournamentName?: string;
}

function FoulDots({
  count,
  color,
  labelFirst = false,
}: {
  count: number;
  color: string;
  labelFirst?: boolean;
}) {
  const emptyBorder = `${color}66`;

  const dots = Array.from({ length: 5 }).map((_, i) => (
    <div
      key={i}
      className="live-foul-dot"
      style={{
        background: i < count ? color : 'transparent',
        borderColor: i < count ? color : emptyBorder,
      }}
    />
  ));

  return (
    <div className="live-foul-dots">
      {labelFirst && <span className="live-font-mono live-pf-label">PF</span>}
      {dots}
      {!labelFirst && <span className="live-font-mono live-pf-label">PF</span>}
    </div>
  );
}

export function LiveGameHeader({
  game,
  homeScore,
  awayScore,
  clockRunning,
  onToggleClock,
  onUndo,
  onEndPeriod,
  onEdit,
  onDelete,
  canUndo,
  onBack,
  tournamentName,
}: LiveGameHeaderProps) {
  const homeColor = LIVE_TEAM_HEX.home;
  const awayColor = LIVE_TEAM_HEX.away;

  const homeFouls = game.events.filter(
    (e) =>
      e.period === game.currentPeriod &&
      e.type === 'foul' &&
      e.teamId === game.homeTeamId
  ).length;

  const awayFouls = game.events.filter(
    (e) =>
      e.period === game.currentPeriod &&
      e.type === 'foul' &&
      e.teamId === game.awayTeamId
  ).length;

  const period = game.currentPeriod;
  const quarterButtons = period <= 4 ? [1, 2, 3, 4] : [1, 2, 3, 4, period];

  const formatGameDate = () => {
    try {
      return new Date(game.date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return game.date;
    }
  };

  return (
    <header className="live-scoreboard-header shrink-0">
      <div className="live-scoreboard-left">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="live-ops-btn live-back-btn">
            <ArrowLeft className="live-back-btn-icon" />
            Back
          </Button>
        )}
      </div>

      <div className="live-scoreboard-center">
        <div className="live-team-name-block text-right">
          <div className="live-font-condensed live-team-abbr" style={{ color: homeColor }}>
            {game.homeTeam.abbreviation}
          </div>
          <div className="live-font-mono live-team-name">{game.homeTeam.name}</div>
        </div>

        <div className="live-scoreboard-mid">
          <div className="live-score-row">
            <span className="live-font-condensed live-score-num" style={{ color: homeColor }}>
              {homeScore}
            </span>
            <span className="live-score-dash">–</span>
            <span className="live-font-condensed live-score-num" style={{ color: awayColor }}>
              {awayScore}
            </span>
          </div>

          <div className="live-scoreboard-controls">
            <FoulDots count={homeFouls} color={homeColor} labelFirst={false} />

            <div className="live-clock-block">
              <div className="live-quarter-row">
                {quarterButtons.map((q) => (
                  <span
                    key={q}
                    className="live-quarter-btn"
                    style={{
                      background: period === q ? homeColor : 'var(--muted)',
                      color: period === q ? 'var(--primary-foreground)' : 'var(--foreground)',
                    }}
                  >
                    {q <= 4 ? q : `OT${q - 4}`}
                  </span>
                ))}
                <span className="live-font-mono live-qtr-label">QTR</span>
              </div>
              <div className="live-clock-row">
                <span
                  className="live-font-mono live-clock-display"
                  style={{ color: clockRunning ? 'var(--live-success)' : 'var(--foreground)' }}
                >
                  {game.currentGameTime}
                </span>
                <button
                  type="button"
                  onClick={onToggleClock}
                  className="live-font-condensed live-clock-toggle"
                  style={{
                    background: clockRunning
                      ? 'color-mix(in srgb, var(--destructive) 10%, transparent)'
                      : 'color-mix(in srgb, var(--live-success) 10%, transparent)',
                    color: clockRunning ? 'var(--destructive)' : 'var(--live-success)',
                    border: `1px solid ${clockRunning ? 'color-mix(in srgb, var(--destructive) 27%, transparent)' : 'color-mix(in srgb, var(--live-success) 27%, transparent)'}`,
                  }}
                >
                  {clockRunning ? '■' : '▶'}
                </button>
              </div>
            </div>

            <FoulDots count={awayFouls} color={awayColor} labelFirst />
          </div>
        </div>

        <div className="live-team-name-block text-left">
          <div className="live-font-condensed live-team-abbr" style={{ color: awayColor }}>
            {game.awayTeam.abbreviation}
          </div>
          <div className="live-font-mono live-team-name">{game.awayTeam.name}</div>
        </div>
      </div>

      <div className="live-scoreboard-right">
        <div className="live-font-mono live-game-meta">{tournamentName ?? 'Live game'}</div>
        <div className="live-font-mono live-game-meta-dim">
          {formatGameDate()}
          {game.startTime ? ` · ${game.startTime}` : ''}
        </div>
        <div className="live-ops-row">
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            className="live-ops-btn live-ops-btn-sm"
          >
            <Undo className="live-ops-btn-icon" />
            Undo
          </Button>
          <Button variant="ghost" size="sm" onClick={onEndPeriod} className="live-ops-btn live-ops-btn-sm">
            <SkipForward className="live-ops-btn-icon" />
            End Q
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} className="live-ops-btn live-ops-btn-sm">
            <Edit2 className="live-ops-btn-icon" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="live-ops-btn live-ops-btn-sm live-ops-btn-danger"
          >
            <Trash2 className="live-ops-btn-icon" />
            Delete
          </Button>
        </div>
      </div>
    </header>
  );
}
