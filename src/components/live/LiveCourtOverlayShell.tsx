import React from 'react';
import { cn } from '../ui/utils';

interface LiveCourtOverlayShellProps {
  children: React.ReactNode;
  className?: string;
}

export function LiveCourtOverlayShell({ children, className }: LiveCourtOverlayShellProps) {
  // pointer-events-auto only while mounted — parent must unmount on idle/error
  // so a stuck phase cannot leave an invisible click trap over the court.
  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center pointer-events-auto',
        className
      )}
      data-live-court-overlay="true"
      role="presentation"
    >
      <div
        className="absolute inset-0 rounded-xl bg-background/60 pointer-events-none"
        aria-hidden
      />
      {/*
        Full-width centering wrapper so child cards with w-[min(90%,320px)] resolve
        against the court, not a shrink-wrapped parent (which collapses to min-content
        and stacks overlay text one word per line).
      */}
      <div className="relative z-10 flex w-full items-center justify-center px-3 pointer-events-auto">
        {children}
      </div>
    </div>
  );
}

export function overlayClick(handler: () => void) {
  return (e: React.MouseEvent) => {
    e.stopPropagation();
    handler();
  };
}
