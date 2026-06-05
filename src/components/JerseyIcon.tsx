import React from 'react';
import { cn } from './ui/utils';

interface JerseyIconProps {
  number: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const NUMBER_ANCHOR_X = 50;
const NUMBER_TOP_Y = 37;
const NUMBER_SCALE_X = 1.2;
const NUMBER_SCALE_Y = 1.6;
const NUMBER_MASK_X = 31;
const NUMBER_MASK_Y = 37;
const NUMBER_MASK_WIDTH = 38;
const NUMBER_MASK_HEIGHT = 27;

/**
 * Uses public/icons/jersey-icon-reference.png for the outline and overlays
 * a dynamic number (the PNG ships with "00" baked in).
 * Numbers scale +20% width / +60% height from a top anchor so they fill downward.
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
      {/* Mask over baked-in "00" � widened/tallened for scaled overlay digits */}
      <rect
        x={NUMBER_MASK_X}
        y={NUMBER_MASK_Y}
        width={NUMBER_MASK_WIDTH}
        height={NUMBER_MASK_HEIGHT}
        fill="#ffffff"
      />
      <g
        transform={`translate(${NUMBER_ANCHOR_X}, ${NUMBER_TOP_Y}) scale(${NUMBER_SCALE_X}, ${NUMBER_SCALE_Y}) translate(${-NUMBER_ANCHOR_X}, ${-NUMBER_TOP_Y})`}
      >
        <text
          x={NUMBER_ANCHOR_X}
          y={NUMBER_TOP_Y}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={fontSize}
          fontWeight="800"
          className="fill-foreground"
          style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}
        >
          {number}
        </text>
      </g>
    </svg>
  );
}
