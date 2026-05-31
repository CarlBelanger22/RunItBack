import React from 'react';
import { cn } from './ui/utils';

interface GameTeamLinkProps {
  teamId: string;
  teamName: string;
  onNavigateToTeam?: (teamId: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function GameTeamLink({
  teamId,
  teamName,
  onNavigateToTeam,
  className,
  children,
}: GameTeamLinkProps) {
  const label = children ?? teamName;

  if (!onNavigateToTeam) {
    return <span className={className}>{label}</span>;
  }

  return (
    <button
      type="button"
      className={cn(
        'hover:text-primary hover:underline cursor-pointer text-inherit font-inherit',
        className
      )}
      onClick={() => onNavigateToTeam(teamId)}
    >
      {label}
    </button>
  );
}
