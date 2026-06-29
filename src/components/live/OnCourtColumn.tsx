import React from 'react';
import type { Player } from '../../App';
import { cn } from '../ui/utils';
import { getLiveTeamColor, liveTeamTint, LIVE_SEMANTIC } from './liveEntryTheme';
import { ON_COURT_SIDE_THEME, type OnCourtSide } from './onCourtSideTheme';

export type { OnCourtSide };

interface OnCourtPlayerCardProps {
  player: Player;
  side: OnCourtSide;
  pickMode?: boolean;
  selected?: boolean;
  onSelect?: (player: Player) => void;
}

export function OnCourtPlayerCard({
  player,
  side,
  pickMode = false,
  selected = false,
  onSelect,
}: OnCourtPlayerCardProps) {
  const theme = ON_COURT_SIDE_THEME[side];
  const teamColor = getLiveTeamColor(side);
  const interactive = pickMode && !!onSelect;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? () => onSelect(player) : undefined}
      style={{
        backgroundColor: selected ? liveTeamTint(side, '28') : liveTeamTint(side, '0a'),
        border: `1.5px solid ${selected ? teamColor : liveTeamTint(side, '30')}`,
        boxShadow: selected
          ? `0 0 10px ${liveTeamTint(side, '44')}, inset 0 0 0 1px ${liveTeamTint(side, '22')}`
          : undefined,
      }}
      className={cn(
        'flex h-full min-h-[48px] w-full items-center gap-2.5 rounded border-0 px-3 py-2.5 text-left transition-all duration-150',
        'disabled:opacity-100',
        interactive && 'cursor-pointer hover:brightness-110',
        !interactive && 'cursor-default'
      )}
    >
      <div
        className="live-font-condensed flex h-9 w-9 shrink-0 items-center justify-center rounded text-base font-black leading-none tabular-nums"
        style={{
          backgroundColor: selected ? teamColor : liveTeamTint(side, '22'),
          color: selected ? '#fff' : teamColor,
        }}
      >
        {player.number}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-xs font-semibold leading-tight"
          style={{
            color: selected ? 'var(--primary-foreground)' : 'var(--foreground)',
            fontFamily: "'Barlow', sans-serif",
          }}
        >
          {player.name}
        </div>
        {player.position && (
          <div
            className="live-font-mono mt-0.5 text-[9px] leading-tight"
            style={{ color: selected ? teamColor : LIVE_SEMANTIC.muted }}
          >
            {player.position}
          </div>
        )}
      </div>
    </button>
  );
}

interface OnCourtColumnProps {
  side: OnCourtSide;
  players: Player[];
  onCourtIds: string[];
  isOffense?: boolean;
  onSelect?: (player: Player) => void;
  selectedId?: string | null;
  excludeId?: string | null;
  pickMode?: boolean;
  className?: string;
}

export function OnCourtColumn({
  side,
  players,
  onCourtIds,
  isOffense = false,
  onSelect,
  selectedId,
  excludeId,
  pickMode = false,
  className,
}: OnCourtColumnProps) {
  const theme = ON_COURT_SIDE_THEME[side];
  const roster = players
    .filter((p) => onCourtIds.includes(p.id))
    .filter((p) => !excludeId || p.id !== excludeId);

  const headerLabel = side === 'home' ? 'HOME · On Court' : 'AWAY · On Court';

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden',
        isOffense && 'border-l-2 pl-2',
        className
      )}
      style={isOffense ? { borderLeftColor: theme.possessionAccent } : undefined}
    >
      <div
        className="live-font-mono shrink-0 px-1 text-[8px] font-medium uppercase tracking-widest"
        style={{ color: theme.header }}
      >
        {headerLabel}
      </div>

      <div
        className={cn(
          'min-h-0 flex-1',
          roster.length > 0 ? 'on-court-roster-grid' : 'grid grid-cols-1'
        )}
      >
        {roster.map((player) => (
          <OnCourtPlayerCard
            key={player.id}
            player={player}
            side={side}
            pickMode={pickMode}
            selected={selectedId === player.id}
            onSelect={onSelect}
          />
        ))}
        {roster.length === 0 && (
          <p className="col-span-1 py-4 text-center text-xs text-muted-foreground">
            No players on court
          </p>
        )}
      </div>
    </div>
  );
}
