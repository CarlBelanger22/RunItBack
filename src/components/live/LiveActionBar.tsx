import React from 'react';
import { Undo } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

interface LiveActionBarProps {
  onFoul: () => void;
  onTurnover: () => void;
  onJumpBall: () => void;
  onUndo: () => void;
  canUndo?: boolean;
  disabled?: boolean;
  jumpBallDisabled?: boolean;
  variant?: 'light' | 'dark';
}

export function LiveActionBar({
  onFoul,
  onTurnover,
  onJumpBall,
  onUndo,
  canUndo = false,
  disabled = false,
  jumpBallDisabled = false,
  variant = 'light',
}: LiveActionBarProps) {
  const dark = variant === 'dark';

  return (
    <div
      className={cn(
        'live-action-bar flex shrink-0 items-center justify-center gap-2 border-t px-3 py-2',
        dark ? 'border-border bg-card' : 'border-border/60 bg-background'
      )}
    >
      <Button
        variant="outline"
        size="default"
        className={cn('live-action-undo min-w-[100px] font-semibold', dark && 'bg-card')}
        onClick={onUndo}
        disabled={!canUndo}
      >
        <Undo className="mr-1.5 h-4 w-4" />
        Undo
      </Button>
      <Button
        variant="outline"
        size="default"
        className={cn('live-action-foul min-w-[88px] font-semibold', dark && 'bg-card')}
        onClick={onFoul}
        disabled={disabled}
      >
        FOUL
      </Button>
      <Button
        variant="outline"
        size="default"
        className={cn('live-action-to min-w-[120px] font-semibold', dark && 'bg-card')}
        onClick={onTurnover}
        disabled={disabled}
      >
        TURNOVER
      </Button>
      <Button
        variant="outline"
        size="default"
        className={cn('live-action-jumpball min-w-[120px] font-semibold', dark && 'bg-card')}
        onClick={onJumpBall}
        disabled={disabled || jumpBallDisabled}
      >
        JUMP BALL
      </Button>
    </div>
  );
}
