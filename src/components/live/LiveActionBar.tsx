import React from 'react';
import { Button } from '../ui/button';
import { Users } from 'lucide-react';
import { cn } from '../ui/utils';

interface LiveActionBarProps {
  onFoul: () => void;
  onTurnover: () => void;
  onSubstitution: () => void;
  disabled?: boolean;
  variant?: 'light' | 'dark';
}

export function LiveActionBar({
  onFoul,
  onTurnover,
  onSubstitution,
  disabled = false,
  variant = 'light',
}: LiveActionBarProps) {
  const dark = variant === 'dark';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center gap-2 border-t py-2',
        dark ? 'border-border bg-card' : 'border-border/60 bg-background'
      )}
    >
      <Button
        variant="outline"
        size="default"
        className={cn(
          'min-w-[88px] font-semibold border-destructive/40 text-destructive hover:bg-destructive/10',
          dark && 'bg-card'
        )}
        onClick={onFoul}
        disabled={disabled}
      >
        FOUL
      </Button>
      <Button
        variant="outline"
        size="default"
        className={cn(
          'min-w-[88px] font-semibold border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400',
          dark && 'bg-card'
        )}
        onClick={onTurnover}
        disabled={disabled}
      >
        TO
      </Button>
      <Button
        variant="outline"
        size="default"
        className={cn('min-w-[88px] font-semibold', dark && 'bg-card')}
        onClick={onSubstitution}
        disabled={disabled}
      >
        <Users className="w-4 h-4 mr-1.5" />
        SUB
      </Button>
    </div>
  );
}
