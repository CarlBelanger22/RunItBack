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
        'absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px] rounded-xl z-10 pointer-events-auto',
        className
      )}
    >
      {children}
    </div>
  );
}

export function overlayClick(handler: () => void) {
  return (e: React.MouseEvent) => {
    e.stopPropagation();
    handler();
  };
}
