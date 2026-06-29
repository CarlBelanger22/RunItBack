import React, { useRef, useEffect } from 'react';
import type { GameEvent, Team } from '../../App';
import { getLiveTeamColor, liveTeamTint, LIVE_SEMANTIC } from './liveEntryTheme';

interface LivePlayByPlayRailProps {
  events: GameEvent[];
  homeTeam: Team;
  awayTeam: Team;
  maxEvents?: number;
  onEventDoubleClick?: (event: GameEvent) => void;
}

type ActionStyle = { label: string; color: string; detail?: string };

function formatPeriodLabel(period: number): string {
  return period <= 4 ? `Q${period}` : `OT${period - 4}`;
}

function getPlayerDisplayName(
  playerId: string | undefined,
  homeTeam: Team,
  awayTeam: Team
): string {
  if (!playerId) return '—';
  const player = [...homeTeam.players, ...awayTeam.players].find((p) => p.id === playerId);
  if (!player) return 'Unknown';
  const parts = player.name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : player.name;
}

function formatEventAction(event: GameEvent, homeTeam: Team, awayTeam: Team): ActionStyle {
  const player = getPlayerDisplayName(event.playerId, homeTeam, awayTeam);

  switch (event.type) {
    case 'shot_attempt': {
      const pts = event.details.isThree ? 3 : 2;
      const made = event.details.made;
      const blocked = event.details.blockedBy;
      return {
        label: blocked ? 'BLOCKED' : `${pts}PT ${made ? 'MAKE' : 'MISS'}`,
        color: made ? LIVE_SEMANTIC.success : LIVE_SEMANTIC.destructive,
        detail: player,
      };
    }
    case 'free_throw':
      return {
        label: `FT ${event.details.made ? 'MAKE' : 'MISS'}`,
        color: event.details.made ? LIVE_SEMANTIC.success : LIVE_SEMANTIC.destructive,
        detail: player,
      };
    case 'rebound':
      return {
        label: `${(event.details.reboundType as string)?.toUpperCase() ?? 'REB'}`,
        color: LIVE_SEMANTIC.muted,
        detail: player,
      };
    case 'foul':
      return {
        label: 'FOUL',
        color: 'var(--live-away)',
        detail: `${player} · ${event.details.foulType ?? 'Personal'}`,
      };
    case 'turnover':
      return {
        label: 'TURNOVER',
        color: LIVE_SEMANTIC.destructive,
        detail: player,
      };
    case 'substitution':
      return {
        label: 'SUBSTITUTION',
        color: '#a855f7',
        detail: undefined,
      };
    default:
      return {
        label: event.type.toUpperCase().replace(/_/g, ' '),
        color: LIVE_SEMANTIC.muted,
        detail: player,
      };
  }
}

function LogCard({
  event,
  homeTeam,
  awayTeam,
  onDoubleClick,
}: {
  event: GameEvent;
  homeTeam: Team;
  awayTeam: Team;
  onDoubleClick?: () => void;
}) {
  const isHome = event.teamId === homeTeam.id;
  const color = getLiveTeamColor(isHome ? 'home' : 'away');
  const abbr = isHome ? homeTeam.abbreviation : awayTeam.abbreviation;
  const action = formatEventAction(event, homeTeam, awayTeam);
  const playerName = getPlayerDisplayName(event.playerId, homeTeam, awayTeam);

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
          {formatPeriodLabel(event.period)} · {event.gameTime}
        </span>
      </div>
      <div
        className="live-font-mono live-pbp-team-badge"
        style={{ background: liveTeamTint(isHome ? 'home' : 'away', '20'), color }}
      >
        {abbr}
      </div>
      <div className="live-pbp-player">{playerName}</div>
      <div className="live-font-condensed live-pbp-action" style={{ color: action.color }}>
        {action.label}
      </div>
      {action.detail && action.detail !== playerName && (
        <div className="live-font-mono live-pbp-detail">{action.detail}</div>
      )}
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
  const displayEvents = [...events].slice(-maxEvents).reverse();

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
        {displayEvents.length === 0 ? (
          <div className="live-font-mono live-pbp-empty">
            No events yet — select a player and tap the court to log a shot
          </div>
        ) : (
          displayEvents.map((event) => (
            <LogCard
              key={event.id}
              event={event}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              onDoubleClick={() => onEventDoubleClick?.(event)}
            />
          ))
        )}
      </div>
    </div>
  );
}
