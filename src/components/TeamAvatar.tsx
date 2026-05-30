import React from 'react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from './ui/utils';
import type { Team } from '../App';

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
} as const;

interface TeamAvatarProps {
  team: Pick<Team, 'name' | 'abbreviation' | 'icon'>;
  size?: keyof typeof sizeClasses;
  className?: string;
}

function avatarLabel(team: Pick<Team, 'name' | 'abbreviation' | 'icon'>): string {
  if (team.icon && team.icon.length <= 3) {
    return team.icon.toUpperCase();
  }
  if (team.abbreviation) {
    return team.abbreviation.slice(0, 3).toUpperCase();
  }
  return team.name.substring(0, 2).toUpperCase();
}

export function TeamAvatar({ team, size = 'md', className }: TeamAvatarProps) {
  return (
    <Avatar className={cn(sizeClasses[size], 'flex-shrink-0', className)}>
      <AvatarFallback className={cn(sizeClasses[size], 'font-semibold')}>
        {avatarLabel(team)}
      </AvatarFallback>
    </Avatar>
  );
}
