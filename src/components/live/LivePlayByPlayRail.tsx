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

type PbpRow =
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
      const blockedBy = event.details.blockedBy as string | undefined;
      const assistedBy = event.details.assistedBy as string | undefined;
      const detailParts = [player];
      if (made && assistedBy) {
        detailParts.push(`AST ${getPlayerDisplayName(assistedBy, homeTeam, awayTeam)}`);
      }
      return {
        label: blockedBy ? 'BLOCKED' : `${pts}PT ${made ? 'MAKE' : 'MISS'}`,
        color: made ? LIVE_SEMANTIC.success : LIVE_SEMANTIC.destructive,
        detail: blockedBy
          ? getPlayerDisplayName(blockedBy, homeTeam, awayTeam)
          : detailParts.join(' · '),
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
        label: formatReboundLabel((event.details.reboundType as string) ?? 'reb'),
        color: LIVE_SEMANTIC.muted,
        detail: player,
      };
    case 'foul': {
      const foulType = (event.details.foulType as string) ?? 'normal';
      const category = (event.details.foulCategory as string) ?? 'personal';
      let label = 'FOUL';
      if (category === 'technical' || foulType === 'technical') label = 'TECH';
      else if (category === 'unsportsmanlike' || foulType === 'unsportsmanlike') label = 'UNS';
      else if (category === 'double' || foulType === 'double') label = 'DBL FOUL';
      const drawnBy = event.details.drawnBy as string | undefined;
      const detailParts = [player];
      if (drawnBy) {
        detailParts.push(`FD ${getPlayerDisplayName(drawnBy, homeTeam, awayTeam)}`);
      }
      if (event.details.isCoachFoul) detailParts.push('Coach');
      if (event.details.isTeamFoul) detailParts.push('Team');
      return {
        label,
        color: 'var(--live-away)',
        detail: detailParts.join(' · '),
      };
    }
    case 'turnover':
      return {
        label: 'TURNOVER',
        color: LIVE_SEMANTIC.destructive,
        detail: player,
      };
    case 'jump_ball': {
      const kind = event.details.kind as string;
      if (kind === 'opening') {
        const winnerId = event.details.winnerTeamId as string;
        const abbrev =
          winnerId === homeTeam.id ? homeTeam.abbreviation : awayTeam.abbreviation;
        return {
          label: 'OPENING TIP',
          color: LIVE_SEMANTIC.muted,
          detail: abbrev,
        };
      }
      const awardedId = event.details.awardedTeamId as string;
      const abbrev =
        awardedId === homeTeam.id ? homeTeam.abbreviation : awayTeam.abbreviation;
      const stealId = event.details.stealPlayerId as string | undefined;
      return {
        label: 'JUMP BALL',
        color: LIVE_SEMANTIC.muted,
        detail: stealId
          ? `${abbrev} · TO ${player} · STL ${getPlayerDisplayName(stealId, homeTeam, awayTeam)}`
          : `${abbrev} · arrow flip`,
      };
    }
    case 'substitution': {
      const clock = (event.details.clockTime as string) ?? event.gameTime;
      return {
        label: 'SUB',
        color: LIVE_SEMANTIC.muted,
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
        label,
        color: LIVE_SEMANTIC.muted,
        detail: possessionAbbr ? `${possessionAbbr} ball` : undefined,
      };
    }
    case 'period_end': {
      const p = (event.details.period as number) ?? event.period;
      const label = p <= 4 ? `END Q${p}` : `END OT${p - 4}`;
      return { label, color: LIVE_SEMANTIC.muted, detail: undefined };
    }
    default:
      return {
        label: event.type.toUpperCase().replace(/_/g, ' '),
        color: LIVE_SEMANTIC.muted,
        detail: player,
      };
  }
}

function LogCard({
  row,
  homeTeam,
  awayTeam,
  onDoubleClick,
}: {
  row: PbpRow;
  homeTeam: Team;
  awayTeam: Team;
  onDoubleClick?: () => void;
}) {
  const event = pbpRowSourceEvent(row);
  const teamId =
    row.kind === 'block'
      ? row.blockerTeamId
      : row.kind === 'double_foul_partner'
        ? row.partnerTeamId
        : row.event.teamId;
  const playerId =
    row.kind === 'block'
      ? row.blockerId
      : row.kind === 'double_foul_partner'
        ? row.partnerId
        : row.event.playerId;

  const isHome = teamId === homeTeam.id;
  const color = getLiveTeamColor(isHome ? 'home' : 'away');
  const abbr = isHome ? homeTeam.abbreviation : awayTeam.abbreviation;
  const action =
    row.kind === 'block'
      ? {
          label: 'BLOCK',
          color,
          detail: getPlayerDisplayName(event.playerId, homeTeam, awayTeam),
        }
      : row.kind === 'double_foul_partner'
        ? {
            label: 'DBL FOUL',
            color: 'var(--live-away)',
            detail: getPlayerDisplayName(row.foulEvent.playerId, homeTeam, awayTeam),
          }
        : formatEventAction(row.event, homeTeam, awayTeam);
  const playerName = getPlayerDisplayName(playerId, homeTeam, awayTeam);

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
  const displayRows = buildPbpRows(events.slice(-maxEvents), homeTeam, awayTeam).reverse();

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
              onDoubleClick={() => onEventDoubleClick?.(pbpRowSourceEvent(row))}
            />
          ))
        )}
      </div>
    </div>
  );
}
