import React from 'react';
import { cn } from './ui/utils';

interface ComparisonStatRowProps {
  homeDisplay: string;
  label: string;
  awayDisplay: string;
  emphasized?: boolean;
  labelWidth?: 'compact' | 'wide';
}

export function ComparisonStatRow({
  homeDisplay,
  label,
  awayDisplay,
  emphasized = false,
  labelWidth = 'compact',
}: ComparisonStatRowProps) {
  const wide = labelWidth === 'wide';
  const valueWidth = wide ? 'w-12' : 'w-10';
  const labelClass = wide ? 'w-32' : 'w-12';

  return (
    <div className="flex items-center justify-center gap-3">
      <span
        className={cn(
          valueWidth,
          'shrink-0 text-right font-mono text-sm tabular-nums',
          emphasized && 'font-medium'
        )}
      >
        {homeDisplay}
      </span>
      <span
        className={cn(
          labelClass,
          'shrink-0 text-center text-sm font-medium tracking-wide text-muted-foreground'
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          valueWidth,
          'shrink-0 font-mono text-sm tabular-nums',
          emphasized && 'font-medium'
        )}
      >
        {awayDisplay}
      </span>
    </div>
  );
}
