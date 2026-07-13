import React from 'react';
import { cn } from './ui/utils';
import {
  minorBarPercents,
  type ComparisonSideValue,
  type MajorComparisonGroup,
  type MinorComparisonRow,
} from '../utils/gameComparisonVisualModel';

interface TeamStatsComparisonSectionProps {
  homeAbbr: string;
  awayAbbr: string;
  majorGroups: MajorComparisonGroup[];
  minorRows: MinorComparisonRow[];
  advancedRows: MinorComparisonRow[];
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

function ComparisonBarRow({
  home,
  away,
  label,
  major = false,
}: {
  home: ComparisonSideValue;
  away: ComparisonSideValue;
  label: string;
  major?: boolean;
}) {
  const { homePct, awayPct } = minorBarPercents(home.value, away.value);
  const leading = getLeadingSide(home.value, away.value);
  const homeVal = home.value ?? 0;
  const awayVal = away.value ?? 0;

  return (
    <div
      className={cn(
        'game-compare-row',
        major ? 'game-compare-row--major' : 'game-compare-row--minor'
      )}
    >
      <div className="game-compare-label">{label}</div>
      <div className="game-compare-body">
        <span
          className={cn(
            'game-compare-value game-compare-value--home',
            leading === 'home' && 'game-compare-value--leading-home',
            leading === 'away' && 'game-compare-value--trailing'
          )}
        >
          {home.display}
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
            'game-compare-value game-compare-value--away',
            leading === 'away' && 'game-compare-value--leading-away',
            leading === 'home' && 'game-compare-value--trailing'
          )}
        >
          {away.display}
        </span>
      </div>
    </div>
  );
}

export function TeamStatsComparisonSection({
  homeAbbr,
  awayAbbr,
  majorGroups,
  minorRows,
  advancedRows,
}: TeamStatsComparisonSectionProps) {
  return (
    <div className="game-compare">
      <div className="game-compare-headers">
        <span className="game-compare-header-home">{homeAbbr}</span>
        <span className="game-compare-header-away">{awayAbbr}</span>
      </div>

      {majorGroups.map((group) => (
        <React.Fragment key={group.key}>
          <ComparisonBarRow
            home={group.home}
            away={group.away}
            label={group.label}
            major
          />
          {group.minors.map((minor) => (
            <ComparisonBarRow
              key={minor.key}
              home={minor.home}
              away={minor.away}
              label={minor.label}
            />
          ))}
        </React.Fragment>
      ))}

      <div className="game-compare-gap" aria-hidden />

      {minorRows.map((row) => (
        <ComparisonBarRow
          key={row.key}
          home={row.home}
          away={row.away}
          label={row.label}
          major={row.major}
        />
      ))}

      <div className="game-compare-section">Advanced</div>

      {advancedRows.map((row) => (
        <ComparisonBarRow
          key={row.key}
          home={row.home}
          away={row.away}
          label={row.label}
        />
      ))}
    </div>
  );
}
