import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { FibaCourtSvg, LIVE_COURT_COLORS, type CourtMarker } from '../../lib/fibaCourtSvg';
import {
  clickToCourtPointMHoopBottom,
  percentToCourtPointM,
  type CourtPointM,
} from '../../lib/fibaCourtGeometry';
import type { CourtMarker as SessionMarker } from '../../liveEntry/liveEntryStateMachine';
import type { Shot } from '../../App';
import { cn } from '../ui/utils';

const HALF_COURT_ASPECT = 15 / 14;

/** Largest 15:14 rect that fits inside width × height (contain). */
function fitHalfCourtDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };

  const heightFirst = { width: height * HALF_COURT_ASPECT, height };
  if (heightFirst.width <= width) return heightFirst;

  return { width, height: width / HALF_COURT_ASPECT };
}

interface HalfCourtCanvasProps {
  onPointClick: (point: CourtPointM) => void;
  sessionMarkers?: SessionMarker[];
  shots?: Shot[];
  showZones?: boolean;
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function HalfCourtCanvas({
  onPointClick,
  sessionMarkers = [],
  shots = [],
  showZones = false,
  interactive = true,
  className,
  children,
}: HalfCourtCanvasProps) {
  const clickRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const [courtSize, setCourtSize] = useState<{ width: number; height: number } | null>(
    null
  );

  useEffect(() => {
    const fitEl = fitRef.current;
    if (!fitEl) return;

    const update = () => {
      const { width, height } = fitEl.getBoundingClientRect();
      setCourtSize(fitHalfCourtDimensions(width, height));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(fitEl);
    return () => observer.disconnect();
  }, []);

  const markers = useMemo((): CourtMarker[] => {
    const shotMarkers = shots.map((s) => ({
      point: percentToCourtPointM(s.x, s.y),
      color: s.made ? ('green' as const) : ('red' as const),
    }));
    const liveMarkers = sessionMarkers.map((m) => ({
      point: m.point,
      color: m.color,
    }));
    return [...shotMarkers, ...liveMarkers];
  }, [sessionMarkers, shots]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive || !clickRef.current) return;
      const rect = clickRef.current.getBoundingClientRect();
      onPointClick(clickToCourtPointMHoopBottom(e.clientX, e.clientY, rect));
    },
    [interactive, onPointClick]
  );

  return (
    <div ref={fitRef} className={cn('w-full h-full min-h-0', className)}>
      <div className="w-full h-full flex items-center justify-center">
        <div
          ref={clickRef}
          style={{
            ...(courtSize
              ? { width: courtSize.width, height: courtSize.height }
              : { width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }),
            backgroundColor: LIVE_COURT_COLORS.surface,
          }}
          className={cn('relative overflow-hidden', interactive && 'cursor-crosshair')}
          onClick={handleClick}
        >
          <FibaCourtSvg variant="live" hoopBottom showZones={showZones} markers={markers} />
          {children}
        </div>
      </div>
    </div>
  );
}
