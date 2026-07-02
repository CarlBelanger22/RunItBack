import React from 'react';
import { Users } from 'lucide-react';
import type { Player } from '../../App';
import { cn } from '../ui/utils';
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
  const interactive = pickMode && !!onSelect;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? () => onSelect(player) : undefined}
      className={cn(
        'live-on-court-card',
        side === 'home' ? 'live-on-court-card--home' : 'live-on-court-card--away',
        selected && 'live-on-court-card--selected',
        interactive && 'live-on-court-card--interactive'
      )}
    >
      <div className="live-on-court-jersey">{player.number}</div>
      <div className="live-on-court-body">
        <div className="live-on-court-name">{player.name}</div>
        {player.position ? (
          <span className="live-on-court-pos">{player.position}</span>
        ) : null}
      </div>
    </button>
  );
}

interface OnCourtSubButtonProps {
  side: OnCourtSide;
  onClick?: () => void;
  disabled?: boolean;
}

function OnCourtSubButton({ side, onClick, disabled = false }: OnCourtSubButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={cn(
        'live-on-court-sub',
        side === 'home' ? 'live-on-court-sub--home' : 'live-on-court-sub--away'
      )}
    >
      <Users className="live-on-court-sub-icon" aria-hidden />
      Substitution
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
  onSubstitution?: () => void;
  subDisabled?: boolean;
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
  onSubstitution,
  subDisabled = false,
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
        side === 'home' ? 'live-on-court-card--home' : 'live-on-court-card--away',
        className
      )}
      style={isOffense ? { borderLeftColor: theme.possessionAccent } : undefined}
    >
      <div
        className="live-on-court-column-header"
        style={{ color: theme.header }}
      >
        <span className="live-on-court-column-header-dot" aria-hidden />
        {headerLabel}
      </div>

      <div className="on-court-roster-grid min-h-0 flex-1">
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
        <OnCourtSubButton
          side={side}
          onClick={onSubstitution}
          disabled={subDisabled || !onSubstitution}
        />
      </div>
    </div>
  );
}
