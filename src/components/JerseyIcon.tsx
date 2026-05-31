import React from 'react';
import { cn } from './ui/utils';

interface JerseyIconProps {
  number: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Uses public/icons/jersey-icon-reference.png for the outline and overlays
 * a dynamic number (the PNG ships with "00" baked in).
 */
export function JerseyIcon({ number, size = 'md', className }: JerseyIconProps) {
  const dim = size === 'sm' ? 40 : size === 'lg' ? 60 : 48;
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 19 : 17;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 100 100"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <image href="/icons/jersey-icon-reference.png" width="100" height="100" />
      {/* Tight mask over baked-in "00" only ù avoids clipping shoulder/armhole strokes */}
      <rect x="34" y="37" width="32" height="26" fill="#ffffff" />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight="800"
        className="fill-foreground"
        style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}
      >
        {number}
      </text>
    </svg>
  );
}
