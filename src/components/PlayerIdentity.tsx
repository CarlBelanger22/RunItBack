import React from 'react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';

interface PlayerIdentityProps {
  name: string;
  number?: number | string;
  position?: string;
  picture?: string;
  size?: 'sm' | 'md' | 'lg';
  showNumberBadge?: boolean;
  className?: string;
}

export function PlayerIdentity({
  name,
  number,
  position,
  picture,
  size = 'md',
  showNumberBadge = false,
  className,
}: PlayerIdentityProps) {
  const avatarSize = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }[size];

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Avatar className={avatarSize}>
        {picture ? (
          <img src={picture} alt={name} className="object-cover" />
        ) : (
          <AvatarFallback className={cn(size === 'sm' ? 'text-xs' : 'text-sm')}>
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium truncate', size === 'sm' ? 'text-xs' : 'text-sm')}>
            {name}
          </span>
          {showNumberBadge && number !== undefined && (
            <Badge variant="outline" className="text-[10px] px-1 h-4">
              #{number}
            </Badge>
          )}
        </div>
        {position && (
          <div className="text-xs text-muted-foreground truncate">
            {number !== undefined && !showNumberBadge && `#${number} • `}
            {position}
          </div>
        )}
      </div>
    </div>
  );
}

