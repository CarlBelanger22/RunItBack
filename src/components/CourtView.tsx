import React, { useMemo } from 'react';
import { Shot } from '../App';
import {
  FigmaHorizontalCourtSvg,
  HORIZONTAL_HALF_COURT_PORTRAIT_ASPECT,
} from '../lib/figmaHorizontalCourtSvg';
import { shotsToHorizontalHalfCourtMarkers } from '../utils/shotChartDisplay';
import { cn } from './ui/utils';

interface CourtViewProps {
  shots?: Shot[];
  onCourtClick?: (x: number, y: number) => void;
  showZones?: boolean;
  interactive?: boolean;
  className?: string;
  heatmap?: boolean;
  /** @deprecated Always uses live-entry wooden half court. */
  useSvgBackground?: boolean;
}

export function CourtView({ shots = [], className }: CourtViewProps) {
  const markers = useMemo(
    () => shotsToHorizontalHalfCourtMarkers(shots),
    [shots]
  );

  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-border shadow-sm',
        className
      )}
      style={{ aspectRatio: String(HORIZONTAL_HALF_COURT_PORTRAIT_ASPECT) }}
    >
      <FigmaHorizontalCourtSvg
        className="h-full w-full"
        half="left"
        orientation="bottom"
        markers={markers}
      />
    </div>
  );
}
