import React from 'react';
import { cn } from './ui/utils';
import {
  minorBarPercents,
  type GameFlowTableRow,
  type GameFlowTeamTableRow,
  type GameFlowSharedTableRow,
} from '../utils/gameComparisonVisualModel';

interface GameFlowTableSectionProps {
  rows: GameFlowTableRow[];
}

function getLeadingSide(
  home: number | null,
  away: number | null
): 'home' | 'away' | 'tie' | null {
  if (home == null || away == null) return null;
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'tie';
}

function GameFlowTeamBarRow({ row }: { row: GameFlowTeamTableRow }) {
  const { homePct, awayPct } = minorBarPercents(row.home.value, row.away.value);
  const leading = getLeadingSide(row.home.value, row.away.value);
  const homeVal = row.home.value ?? 0;
  const awayVal = row.away.value ?? 0;

  return (
    <div className="game-compare-row game-compare-row--minor">
      <div className="game-compare-label">{row.label}</div>
      <div className="game-compare-body game-compare-body--game-flow">
        <span
          className={cn(
            'game-compare-value game-compare-value--home game-compare-value--side-home',
            leading === 'home' && 'game-compare-value--leading',
            leading === 'away' && 'game-compare-value--trailing-soft'
          )}
        >
          {row.home.display}
        </span>
        <div className="game-compare-track">
          <div className="game-compare-half game-compare-half--home">
            {homeVal > 0 && (
              <div
                className="game-compare-fill-slot"
                style={{ width: `${homePct}%` }}
              >
                <div className="game-compare-fill game-compare-fill--home" />
              </div>
            )}
          </div>
          <div className="game-compare-half game-compare-half--away">
            {awayVal > 0 && (
              <div
                className="game-compare-fill-slot"
                style={{ width: `${awayPct}%` }}
              >
                <div className="game-compare-fill game-compare-fill--away" />
              </div>
            )}
          </div>
        </div>
        <span
          className={cn(
            'game-compare-value game-compare-value--away game-compare-value--side-away',
            leading === 'away' && 'game-compare-value--leading',
            leading === 'home' && 'game-compare-value--trailing-soft'
          )}
        >
          {row.away.display}
        </span>
      </div>
    </div>
  );
}

function GameFlowSharedStatRow({ row }: { row: GameFlowSharedTableRow }) {
  return (
    <div className="game-compare-row game-compare-row--shared">
      <div className="game-compare-label">{row.label}</div>
      <div className="game-compare-shared-value">{row.display}</div>
    </div>
  );
}

export function GameFlowTableSection({ rows }: GameFlowTableSectionProps) {
  if (rows.length === 0) return null;

  return (
    <div className="game-compare mt-2">
      <div className="game-compare-section">Game flow</div>
      {rows.map((row) =>
        row.kind === 'shared' ? (
          <GameFlowSharedStatRow key={row.key} row={row} />
        ) : (
          <GameFlowTeamBarRow key={row.key} row={row} />
        )
      )}
    </div>
  );
}
