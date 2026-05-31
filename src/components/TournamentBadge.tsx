import React, { useState } from 'react';
import { cn } from './ui/utils';
import type { Tournament } from '../App';
import {
  getTournamentAvatarLabel,
  getTournamentAvatarLabelClass,
  resolveTournamentIconSrc,
} from '../utils/tournamentIcon';

/** Fixed square badge slots (w/h — size-* not in compiled CSS). */
const sizeBoxClasses = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
  hero: 'h-16 w-16',
  preview: 'h-16 w-16',
} as const;

const fallbackTextClasses = {
  xs: 'text-[8px]',
  sm: 'text-[9px]',
  md: 'text-[10px]',
  lg: 'text-xs',
  xl: 'text-sm',
  hero: 'text-base',
  preview: 'text-base',
} as const;

type TournamentBadgeSize = keyof typeof sizeBoxClasses;
type LabelSize = 'sm' | 'md' | 'lg' | 'header' | 'xl';

function toLabelSize(size: TournamentBadgeSize): LabelSize {
  if (size === 'xs' || size === 'sm') return 'sm';
  if (size === 'md') return 'md';
  if (size === 'lg') return 'lg';
  if (size === 'xl') return 'xl';
  return 'header';
}

interface TournamentBadgeProps {
  tournament: Pick<Tournament, 'name' | 'icon'>;
  tournamentId?: string;
  size?: TournamentBadgeSize;
  className?: string;
}

export function TournamentBadge({
  tournament,
  tournamentId,
  size = 'md',
  className,
}: TournamentBadgeProps) {
  const iconSrc = resolveTournamentIconSrc(tournament.icon, tournamentId);
  const label = getTournamentAvatarLabel(tournament);
  const labelClass = getTournamentAvatarLabelClass(label, toLabelSize(size));
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(iconSrc) && !imageFailed;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-transparent',
        sizeBoxClasses[size],
        className
      )}
      aria-label={showImage ? `${tournament.name} logo` : undefined}
    >
      {showImage ? (
        <img
          src={iconSrc}
          alt=""
          className="h-full w-full"
          style={{ objectFit: 'contain' }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center rounded-sm bg-muted font-semibold text-muted-foreground',
            fallbackTextClasses[size],
            labelClass
          )}
          aria-hidden
        >
          {label}
        </div>
      )}
    </div>
  );
}
