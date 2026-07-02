import React from 'react';
import {
  COURT_WIDTH_M,
  HALF_COURT_LENGTH_M,
  HOOP_X_M,
  PAINT_DEPTH_M,
  PAINT_LEFT_M,
  PAINT_RIGHT_M,
  THREE_ARC_BREAK_Y_M,
  THREE_ARC_RADIUS_M,
  THREE_CORNER_LEFT_M,
  THREE_CORNER_RIGHT_M,
  type CourtPointM,
} from './fibaCourtGeometry';
import { FULL_COURT_LENGTH_M } from './fullCourtClick';
import { cn } from '../components/ui/utils';

const RESTRICTED_RADIUS_M = 1.25;
const FT_CIRCLE_RADIUS_M = 1.8;
const RIM_RADIUS_M = 0.225;

const COURT_COLORS = {
  light: {
    surface: '#eab676',
    line: '#334155',
    inactiveOverlay: 'rgba(15, 23, 42, 0.28)',
    activeTint: 'rgba(16, 185, 129, 0.12)',
    activeBorder: 'rgba(5, 150, 105, 0.45)',
    paintZone: 'rgba(59, 130, 246, 0.28)',
  },
  dark: {
    surface: '#a08060',
    line: '#f1f5f9',
    inactiveOverlay: 'rgba(0, 0, 0, 0.25)',
    activeTint: 'rgba(52, 211, 153, 0.15)',
    activeBorder: 'rgba(110, 231, 183, 0.5)',
    paintZone: 'rgba(96, 165, 250, 0.35)',
  },
} as const;

export interface FullCourtMarker {
  point: CourtPointM;
  color: 'green' | 'red' | 'orange';
}

interface FibaFullCourtSvgProps {
  className?: string;
  showZones?: boolean;
  markers?: FullCourtMarker[];
  activeHalf: 'top' | 'bottom';
  isDark?: boolean;
}

function HalfBasketEnd({
  yBase,
  flip,
  lineColor,
}: {
  yBase: number;
  flip: boolean;
  lineColor: string;
}) {
  const transform = flip
    ? `translate(${COURT_WIDTH_M / 2}, ${yBase + HALF_COURT_LENGTH_M / 2}) scale(1,-1) translate(${-COURT_WIDTH_M / 2}, ${-(yBase + HALF_COURT_LENGTH_M / 2)})`
    : undefined;

  return (
    <g transform={transform} stroke={lineColor} fill="none">
      <rect
        x={0}
        y={yBase}
        width={COURT_WIDTH_M}
        height={HALF_COURT_LENGTH_M}
        strokeWidth={0.1}
      />
      <rect
        x={PAINT_LEFT_M}
        y={yBase}
        width={PAINT_RIGHT_M - PAINT_LEFT_M}
        height={PAINT_DEPTH_M}
        strokeWidth={0.08}
      />
      <path
        d={`M ${HOOP_X_M - FT_CIRCLE_RADIUS_M} ${yBase + PAINT_DEPTH_M} A ${FT_CIRCLE_RADIUS_M} ${FT_CIRCLE_RADIUS_M} 0 0 ${flip ? 0 : 1} ${HOOP_X_M + FT_CIRCLE_RADIUS_M} ${yBase + PAINT_DEPTH_M}`}
        strokeWidth={0.07}
      />
      <path
        d={`M ${HOOP_X_M - RESTRICTED_RADIUS_M} ${yBase} A ${RESTRICTED_RADIUS_M} ${RESTRICTED_RADIUS_M} 0 0 ${flip ? 1 : 0} ${HOOP_X_M + RESTRICTED_RADIUS_M} ${yBase}`}
        strokeWidth={0.07}
      />
      <line
        x1={THREE_CORNER_LEFT_M}
        y1={yBase}
        x2={THREE_CORNER_LEFT_M}
        y2={yBase + THREE_ARC_BREAK_Y_M}
        strokeWidth={0.08}
      />
      <line
        x1={THREE_CORNER_RIGHT_M}
        y1={yBase}
        x2={THREE_CORNER_RIGHT_M}
        y2={yBase + THREE_ARC_BREAK_Y_M}
        strokeWidth={0.08}
      />
      <path
        d={`M ${THREE_CORNER_LEFT_M} ${yBase + THREE_ARC_BREAK_Y_M} A ${THREE_ARC_RADIUS_M} ${THREE_ARC_RADIUS_M} 0 0 ${flip ? 0 : 1} ${THREE_CORNER_RIGHT_M} ${yBase + THREE_ARC_BREAK_Y_M}`}
        strokeWidth={0.08}
      />
      <circle cx={HOOP_X_M} cy={yBase} r={RIM_RADIUS_M} strokeWidth={0.09} />
    </g>
  );
}

export function FibaFullCourtSvg({
  className,
  showZones = false,
  markers = [],
  activeHalf,
  isDark = false,
}: FibaFullCourtSvgProps) {
  const colors = isDark ? COURT_COLORS.dark : COURT_COLORS.light;
  const inactiveY = activeHalf === 'top' ? HALF_COURT_LENGTH_M : 0;
  const activeY = activeHalf === 'top' ? 0 : HALF_COURT_LENGTH_M;

  return (
    <svg
      viewBox={`0 0 ${COURT_WIDTH_M} ${FULL_COURT_LENGTH_M}`}
      className={cn('w-full h-full block', className)}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect
        x={0}
        y={0}
        width={COURT_WIDTH_M}
        height={FULL_COURT_LENGTH_M}
        fill={colors.surface}
      />

      <rect
        x={0}
        y={inactiveY}
        width={COURT_WIDTH_M}
        height={HALF_COURT_LENGTH_M}
        fill={colors.inactiveOverlay}
      />

      <rect
        x={0}
        y={activeY}
        width={COURT_WIDTH_M}
        height={HALF_COURT_LENGTH_M}
        fill={colors.activeTint}
        stroke={colors.activeBorder}
        strokeWidth={0.12}
      />

      <line
        x1={0}
        y1={HALF_COURT_LENGTH_M}
        x2={COURT_WIDTH_M}
        y2={HALF_COURT_LENGTH_M}
        stroke={colors.line}
        strokeWidth={0.12}
      />

      <circle
        cx={HOOP_X_M}
        cy={HALF_COURT_LENGTH_M}
        r={0.6}
        fill="none"
        stroke={colors.line}
        strokeWidth={0.08}
      />

      <HalfBasketEnd yBase={0} flip={false} lineColor={colors.line} />
      <HalfBasketEnd yBase={HALF_COURT_LENGTH_M} flip={true} lineColor={colors.line} />

      {showZones && activeHalf === 'top' && (
        <rect
          x={PAINT_LEFT_M}
          y={0}
          width={PAINT_RIGHT_M - PAINT_LEFT_M}
          height={PAINT_DEPTH_M}
          fill={colors.paintZone}
        />
      )}
      {showZones && activeHalf === 'bottom' && (
        <rect
          x={PAINT_LEFT_M}
          y={FULL_COURT_LENGTH_M - PAINT_DEPTH_M}
          width={PAINT_RIGHT_M - PAINT_LEFT_M}
          height={PAINT_DEPTH_M}
          fill={colors.paintZone}
        />
      )}

      {markers.map((m, i) => {
        const fill =
          m.color === 'green'
            ? '#22c55e'
            : m.color === 'red'
              ? '#ef4444'
              : '#f97316';
        return (
          <circle
            key={i}
            cx={m.point.xM}
            cy={m.point.yM}
            r={0.28}
            fill={fill}
            stroke="#fff"
            strokeWidth={0.07}
          />
        );
      })}
    </svg>
  );
}

/** Hook: track html.dark class for court palette. */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = React.useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false
  );

  React.useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

const COURT_ASPECT = 15 / 28;

/** Largest 15:28 rect that fits inside width × height. */
export function fitCourtDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  if (width / height > COURT_ASPECT) {
    return { width: height * COURT_ASPECT, height };
  }
  return { width, height: width / COURT_ASPECT };
}
