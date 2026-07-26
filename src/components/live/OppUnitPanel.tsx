import React from 'react';
import { cn } from '../ui/utils';
import { ON_COURT_SIDE_THEME } from './onCourtSideTheme';

interface OppUnitPanelProps {
  teamName: string;
  abbreviation: string;
  points: number;
  isOffense: boolean;
  disabled?: boolean;
  onTurnover?: () => void;
  onFoul?: () => void;
  className?: string;
}

/** Right-rail panel for single-team live entry — Opponent as a singular unit. */
export function OppUnitPanel({
  teamName,
  abbreviation,
  points,
  isOffense,
  disabled = false,
  onTurnover,
  onFoul,
  className,
}: OppUnitPanelProps) {
  const theme = ON_COURT_SIDE_THEME.away;

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden',
        isOffense && 'border-l-2 pl-2',
        className
      )}
      style={isOffense ? { borderLeftColor: theme.possessionAccent } : undefined}
    >
      <div className="live-on-court-column-header" style={{ color: theme.header }}>
        <span className="live-on-court-column-header-dot" aria-hidden />
        OPP · Unit
      </div>

      <div className="live-opp-unit-body">
        <div className="live-opp-unit-identity">
          <div className="live-opp-unit-abbrev" style={{ color: theme.possessionAccent }}>
            {abbreviation || 'OPP'}
          </div>
          <div className="live-opp-unit-name">{teamName || 'Opponent'}</div>
          <div className="live-opp-unit-score live-font-mono">{points}</div>
        </div>

        <p className="live-opp-unit-hint">
          {isOffense
            ? 'Opp has the ball — tap court to log a shot'
            : 'Your team has the ball — use Opp Foul / TO when needed'}
        </p>

        <div className="live-opp-unit-actions">
          <button
            type="button"
            className="live-opp-unit-btn"
            disabled={disabled || !onTurnover}
            onClick={onTurnover}
          >
            Opp TO
          </button>
          <button
            type="button"
            className="live-opp-unit-btn"
            disabled={disabled || !onFoul}
            onClick={onFoul}
          >
            Opp Foul
          </button>
        </div>

        <p className="live-opp-unit-footnote">
          No individual Opp stats — team score, FG, FT, TO, PF only
        </p>
      </div>
    </div>
  );
}
