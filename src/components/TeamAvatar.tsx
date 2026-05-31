import React from 'react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from './ui/utils';
import type { Team } from '../App';
import {
  getTeamAvatarLabel,
  getTeamAvatarLabelClass,
} from '../utils/teamAbbreviation';

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  header: 'w-12 h-12 text-sm',
  xl: 'w-24 h-24 text-2xl',
} as const;

interface TeamAvatarProps {
  team: Pick<Team, 'name' | 'abbreviation' | 'icon'>;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function TeamAvatar({ team, size = 'md', className }: TeamAvatarProps) {
  const label = getTeamAvatarLabel(team);
  const labelClass = getTeamAvatarLabelClass(label, size);

  return (
    <Avatar className={cn(sizeClasses[size], 'flex-shrink-0', className)}>
      <AvatarFallback
        className={cn(sizeClasses[size], 'font-semibold', labelClass)}
      >
        {label}
      </AvatarFallback>
    </Avatar>
  );
}
