import React, { useRef, useEffect, useMemo } from 'react';
import type { GameEvent, Team } from '../../App';
import { getLiveTeamColor, liveTeamTint, LIVE_SEMANTIC } from './liveEntryTheme';
import {
  buildFirstNameLabels,
  buildPbpRows,
  buildPbpStatSnapshots,
  formatPbpAction,
  pbpRowSourceEvent,
  type PbpRow,
} from '../../liveEntry/pbpDisplay';

export { buildPbpRows, pbpRowSourceEvent } from '../../liveEntry/pbpDisplay';

interface LivePlayByPlayRailProps {
  events: GameEvent[];
  homeTeam: Team;
  awayTeam: Team;
  maxEvents?: number;
  onEventDoubleClick?: (event: GameEvent) => void;
}

function LogCard({
  row,
  homeTeam,
  awayTeam,
  labels,
  snapshots,
  onDoubleClick,
}: {
  row: PbpRow;
  homeTeam: Team;
  awayTeam: Team;
  labels: Map<string, string>;
  snapshots: Map<string, import('../../liveEntry/pbpDisplay').PbpEventSnapshot>;
  onDoubleClick?: () => void;
}) {
  const event = pbpRowSourceEvent(row);
  const teamId =
    row.kind === 'block'
      ? row.blockerTeamId
      : row.kind === 'double_foul_partner'
        ? row.partnerTeamId
        : row.event.teamId;

  const isHome = teamId === homeTeam.id;
  const color = getLiveTeamColor(isHome ? 'home' : 'away');
  const abbr = isHome ? homeTeam.abbreviation : awayTeam.abbreviation;
  const snap = snapshots.get(event.id);

  const action = formatPbpAction(row, snap, homeTeam, awayTeam, labels, {
    success: LIVE_SEMANTIC.success,
    destructive: LIVE_SEMANTIC.destructive,
    muted: LIVE_SEMANTIC.muted,
    away: 'var(--live-away)',
  });

  const labelColor =
    row.kind === 'block' || row.kind === 'double_foul_partner'
      ? color
      : action.color;

  return (
    <button
      type="button"
      onDoubleClick={onDoubleClick}
      className="live-pbp-card"
      style={{
        background: liveTeamTint(isHome ? 'home' : 'away', '0d'),
        borderColor: liveTeamTint(isHome ? 'home' : 'away', '30'),
      }}
    >
      <div className="live-pbp-card-top">
        <span className="live-font-mono live-pbp-meta">
          {(event.period <= 4 ? `Q${event.period}` : `OT${event.period - 4}`)} · {event.gameTime}
        </span>
      </div>
      <div
        className="live-font-mono live-pbp-team-badge"
        style={{ background: liveTeamTint(isHome ? 'home' : 'away', '20'), color }}
      >
        {abbr}
      </div>
      <div className="live-pbp-card-content">
        <div className="live-pbp-player">{action.playerLine}</div>
        <div className="live-font-condensed live-pbp-action" style={{ color: labelColor }}>
          {action.label}
        </div>
        {action.detail && (
          <div className="live-font-mono live-pbp-detail">{action.detail}</div>
        )}
      </div>
      <div className="live-pbp-edit-hint">dbl-click to edit</div>
    </button>
  );
}

export function LivePlayByPlayRail({
  events,
  homeTeam,
  awayTeam,
  maxEvents = 40,
  onEventDoubleClick,
}: LivePlayByPlayRailProps) {
  const logRef = useRef<HTMLDivElement>(null);

  const labels = useMemo(
    () => buildFirstNameLabels(homeTeam, awayTeam),
    [homeTeam, awayTeam]
  );

  const snapshots = useMemo(
    () => buildPbpStatSnapshots(homeTeam, awayTeam, events),
    [events, homeTeam, awayTeam]
  );

  const displayRows = useMemo(
    () => buildPbpRows(events.slice(-maxEvents), homeTeam, awayTeam).reverse(),
    [events, homeTeam, awayTeam, maxEvents]
  );

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollLeft = 0;
    }
  }, [events.length]);

  return (
    <div className="live-pbp-rail shrink-0">
      <div className="live-pbp-rail-header">
        <div className="flex items-center gap-1.5">
          <div className="live-pbp-live-dot" />
          <span className="live-font-mono live-pbp-rail-title">Live Play-by-Play</span>
        </div>
        <span className="live-font-mono live-pbp-rail-sub">
          {events.length} events · newest left · double-click any card to edit
        </span>
      </div>
      <div ref={logRef} className="live-pbp-scroll">
        {displayRows.length === 0 ? (
          <div className="live-font-mono live-pbp-empty">
            No events yet — select a player and tap the court to log a shot
          </div>
        ) : (
          displayRows.map((row) => (
            <LogCard
              key={row.key}
              row={row}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              labels={labels}
              snapshots={snapshots}
              onDoubleClick={() => onEventDoubleClick?.(pbpRowSourceEvent(row))}
            />
          ))
        )}
      </div>
    </div>
  );
}
