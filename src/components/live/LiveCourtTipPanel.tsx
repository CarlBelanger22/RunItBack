import React from 'react';
import { cn } from '../ui/utils';

interface LiveCourtTipPanelProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  /** Border accent — default primary tip; orange for rebound tips. */
  tone?: 'primary' | 'orange';
}

/**
 * Fixed-width court tip — avoids shared Card/CardHeader (@container + grid)
 * which collapses to min-content in the live court overlay stack.
 */
export function LiveCourtTipPanel({
  title,
  description,
  children,
  className,
  tone = 'primary',
}: LiveCourtTipPanelProps) {
  return (
    <div
      className={cn(
        'box-border w-[300px] max-w-[calc(100%-1.5rem)] shrink-0 rounded-xl border bg-card p-4 text-center shadow-xl',
        tone === 'orange' ? 'border-orange-500/50' : 'border-primary/50',
        className
      )}
    >
      <div className="text-base font-semibold leading-snug text-card-foreground">
        {title}
      </div>
      {description ? (
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
