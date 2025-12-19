import React from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { PlayerIdentity } from './PlayerIdentity';
import { cn } from './ui/utils';

interface PlayerCardProps {
  player: {
    id: string;
    name: string;
    number: number;
    position: string;
    picture?: string;
  };
  stats?: Array<{
    label: string;
    value: string | number;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  }>;
  onClick?: () => void;
  selected?: boolean;
  isStarter?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function PlayerCard({
  player,
  stats,
  onClick,
  selected = false,
  isStarter = false,
  className,
  children,
}: PlayerCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md h-full',
        selected && 'ring-2 ring-primary bg-primary/5',
        isStarter && 'border-primary/50',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <PlayerIdentity
          name={player.name}
          number={player.number}
          position={player.position}
          picture={player.picture}
          size="md"
        />
        
        {stats && stats.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {stats.map((stat, index) => (
              <Badge key={index} variant={stat.variant || 'secondary'} className="text-[10px] px-1.5 py-0">
                {stat.value}{stat.label}
              </Badge>
            ))}
          </div>
        )}
        
        {children && <div className="mt-3">{children}</div>}
      </CardContent>
    </Card>
  );
}

