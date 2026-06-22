import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from './ui/utils';

interface HorizontalBadgeRailProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function HorizontalBadgeRail({
  label,
  children,
  className,
}: HorizontalBadgeRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeRight, setFadeRight] = useState(false);
  const [fadeLeft, setFadeLeft] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    setFadeLeft(hasOverflow && el.scrollLeft > 1);
    setFadeRight(
      hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    );
  }, []);

  useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(updateFades);
    observer.observe(el);

    el.addEventListener('scroll', updateFades, { passive: true });
    window.addEventListener('resize', updateFades);

    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateFades);
      window.removeEventListener('resize', updateFades);
    };
  }, [updateFades, children]);

  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="relative min-w-0 overflow-hidden">
        <div
          ref={scrollRef}
          className="scrollbar-none -mb-1 overflow-x-auto overflow-y-hidden pb-1"
        >
          {children}
        </div>
        {fadeLeft && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-6 bg-gradient-to-r from-card to-transparent"
            aria-hidden
          />
        )}
        {fadeRight && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-card to-transparent"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
