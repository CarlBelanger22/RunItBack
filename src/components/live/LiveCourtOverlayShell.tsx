import React from 'react';
import { cn } from '../ui/utils';

interface LiveCourtOverlayShellProps {
  children: React.ReactNode;
  className?: string;
}

export function LiveCourtOverlayShell({ children, className }: LiveCourtOverlayShellProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center pointer-events-auto',
        className
      )}
    >
      <div
        className="absolute inset-0 rounded-xl bg-background/60 pointer-events-none"
        aria-hidden
      />
      <div className="relative z-10 pointer-events-auto">{children}</div>
    </div>
  );
}

export function overlayClick(handler: () => void) {
  return (e: React.MouseEvent) => {
    e.stopPropagation();
    handler();
  };
}
