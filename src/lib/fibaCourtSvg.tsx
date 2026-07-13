import React from 'react';
import {
  COURT_WIDTH_M,
  HALF_COURT_LENGTH_M,
  HOOP_X_M,
  HOOP_Y_M,
  PAINT_DEPTH_M,
  PAINT_LEFT_M,
  PAINT_RIGHT_M,
  THREE_ARC_BREAK_Y_M,
  THREE_ARC_RADIUS_M,
  THREE_CORNER_LEFT_M,
  THREE_CORNER_RIGHT_M,
  courtPointMToSvg,
  type CourtPointM,
} from './fibaCourtGeometry';
import { cn } from '../components/ui/utils';

const RESTRICTED_RADIUS_M = 1.25;
const FT_LINE_Y_M = PAINT_DEPTH_M;
const FT_CIRCLE_RADIUS_M = 1.8;
const RIM_RADIUS_M = 0.225;

/** Figma live-entry court palette — wood floor fixed; zone tints follow team accents. */
export const LIVE_COURT_COLORS = {
  surface: '#C9A66B',
  line: '#1E293B',
  paintZone: 'rgba(0, 210, 255, 0.22)',
  threeZone: 'rgba(255, 159, 0, 0.25)',
  markerMake: '#00E676',
  markerMiss: '#FF3838',
  markerOther: '#FF9F00',
} as const;

export interface CourtMarker {
  point: CourtPointM;
  color: 'green' | 'red' | 'orange';
}

export interface FibaCourtSvgProps {
  className?: string;
  showZones?: boolean;
  markers?: CourtMarker[];
  children?: React.ReactNode;
  /** Live entry: Figma tan floor + navy lines (explicit hex). */
  variant?: 'default' | 'live';
  /** Live entry: basket at bottom of the viewport (Figma orientation). */
  hoopBottom?: boolean;
  /** `labeled` — filled circle with ✓/× (game summary). Default `dot`. */
  markerStyle?: 'dot' | 'labeled';
}

export function buildThreePointArcPath(): string {
  const leftX = THREE_CORNER_LEFT_M;
  const rightX = THREE_CORNER_RIGHT_M;
  const breakY = THREE_ARC_BREAK_Y_M;
  return `M ${leftX} ${breakY} A ${THREE_ARC_RADIUS_M} ${THREE_ARC_RADIUS_M} 0 0 1 ${rightX} ${breakY}`;
}

function markerFill(color: CourtMarker['color']): string {
  if (color === 'green') return LIVE_COURT_COLORS.markerMake;
  if (color === 'red') return LIVE_COURT_COLORS.markerMiss;
  return LIVE_COURT_COLORS.markerOther;
}

function CourtShotMarker({
  x,
  y,
  color,
  markerStyle,
  counterFlip,
}: {
  x: number;
  y: number;
  color: CourtMarker['color'];
  markerStyle: 'dot' | 'labeled';
  counterFlip: boolean;
}) {
  const fill = markerFill(color);
  const radius = markerStyle === 'labeled' ? 0.28 : 0.22;

  if (markerStyle === 'dot') {
    return (
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={fill}
        stroke="#fff"
        strokeWidth={0.06}
      />
    );
  }

  const label = color === 'green' ? '✓' : color === 'red' ? '×' : '•';
  const textTransform = counterFlip ? `rotate(180 ${x} ${y})` : undefined;

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={fill}
        stroke="#fff"
        strokeWidth={0.07}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize={0.38}
        fontWeight={700}
        transform={textTransform}
      >
        {label}
      </text>
    </g>
  );
}

function CourtMarkings({
  live,
  stroke,
  strokeClass,
  strokeWidth,
  showZones,
}: {
  live: boolean;
  stroke: string;
  strokeClass?: string;
  strokeWidth: number;
  showZones: boolean;
}) {
  const palette = LIVE_COURT_COLORS;

  return (
    <>
      <rect
        x={0}
        y={0}
        width={COURT_WIDTH_M}
        height={HALF_COURT_LENGTH_M}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        className={strokeClass}
      />

      {!live && (
        <line
          x1={0}
          y1={HALF_COURT_LENGTH_M}
          x2={COURT_WIDTH_M}
          y2={HALF_COURT_LENGTH_M}
          stroke={stroke}
          strokeWidth={strokeWidth}
          className={strokeClass}
        />
      )}

      <rect
        x={PAINT_LEFT_M}
        y={HOOP_Y_M}
        width={PAINT_RIGHT_M - PAINT_LEFT_M}
        height={PAINT_DEPTH_M}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        className={strokeClass}
      />

      <path
        d={`M ${HOOP_X_M - FT_CIRCLE_RADIUS_M} ${FT_LINE_Y_M} A ${FT_CIRCLE_RADIUS_M} ${FT_CIRCLE_RADIUS_M} 0 0 1 ${HOOP_X_M + FT_CIRCLE_RADIUS_M} ${FT_LINE_Y_M}`}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth * 0.85}
        className={strokeClass}
      />

      <path
        d={`M ${HOOP_X_M - RESTRICTED_RADIUS_M} ${HOOP_Y_M} A ${RESTRICTED_RADIUS_M} ${RESTRICTED_RADIUS_M} 0 0 0 ${HOOP_X_M + RESTRICTED_RADIUS_M} ${HOOP_Y_M}`}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth * 0.85}
        className={strokeClass}
      />

      <line
        x1={THREE_CORNER_LEFT_M}
        y1={HOOP_Y_M}
        x2={THREE_CORNER_LEFT_M}
        y2={THREE_ARC_BREAK_Y_M}
        stroke={stroke}
        strokeWidth={strokeWidth}
        className={strokeClass}
      />
      <line
        x1={THREE_CORNER_RIGHT_M}
        y1={HOOP_Y_M}
        x2={THREE_CORNER_RIGHT_M}
        y2={THREE_ARC_BREAK_Y_M}
        stroke={stroke}
        strokeWidth={strokeWidth}
        className={strokeClass}
      />
      <path
        d={buildThreePointArcPath()}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        className={strokeClass}
      />

      <line
        x1={HOOP_X_M - 0.9}
        y1={HOOP_Y_M - 0.05}
        x2={HOOP_X_M + 0.9}
        y2={HOOP_Y_M - 0.05}
        stroke={stroke}
        strokeWidth={strokeWidth * 1.1}
        className={strokeClass}
      />
      <circle
        cx={HOOP_X_M}
        cy={HOOP_Y_M}
        r={RIM_RADIUS_M}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        className={strokeClass}
      />

      {showZones && (
        <>
          <rect
            x={PAINT_LEFT_M}
            y={HOOP_Y_M}
            width={PAINT_RIGHT_M - PAINT_LEFT_M}
            height={PAINT_DEPTH_M}
            fill={live ? palette.paintZone : 'rgb(59 130 246 / 0.15)'}
            stroke={live ? palette.line : 'rgb(59 130 246 / 0.4)'}
            strokeWidth={0.06}
            className={live ? undefined : strokeClass}
          />
          <path
            d={buildThreePointArcPath()}
            fill="none"
            stroke={live ? palette.threeZone : 'rgb(249 115 22 / 0.5)'}
            strokeWidth={live ? 0.1 : 0.12}
            className={live ? undefined : strokeClass}
          />
        </>
      )}
    </>
  );
}

export function FibaCourtSvg({
  className,
  showZones = false,
  markers = [],
  children,
  variant = 'default',
  hoopBottom = false,
  markerStyle = 'dot',
}: FibaCourtSvgProps) {
  const live = variant === 'live';
  const stroke = live ? LIVE_COURT_COLORS.line : 'currentColor';
  const strokeClass = live ? undefined : 'text-muted-foreground/40';
  const strokeWidth = live ? 0.1 : 0.08;
  const flipTransform = `translate(0, ${HALF_COURT_LENGTH_M}) scale(1, -1)`;

  return (
    <svg
      viewBox={`0 0 ${COURT_WIDTH_M} ${HALF_COURT_LENGTH_M}`}
      className={cn('w-full h-full block', !live && 'bg-muted/10', className)}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect
        x={0}
        y={0}
        width={COURT_WIDTH_M}
        height={HALF_COURT_LENGTH_M}
        fill={live ? LIVE_COURT_COLORS.surface : 'transparent'}
      />

      {live && hoopBottom ? (
        <g transform={flipTransform}>
          <CourtMarkings
            live={live}
            stroke={stroke}
            strokeClass={strokeClass}
            strokeWidth={strokeWidth}
            showZones={showZones}
          />
          {markers.map((m, i) => {
            const { x, y } = courtPointMToSvg(m.point);
            return (
              <CourtShotMarker
                key={i}
                x={x}
                y={y}
                color={m.color}
                markerStyle={markerStyle}
                counterFlip
              />
            );
          })}
        </g>
      ) : (
        <>
          <CourtMarkings
            live={live}
            stroke={stroke}
            strokeClass={strokeClass}
            strokeWidth={strokeWidth}
            showZones={showZones}
          />
          {markers.map((m, i) => {
            const { x, y } = courtPointMToSvg(m.point);
            return (
              <CourtShotMarker
                key={i}
                x={x}
                y={y}
                color={m.color}
                markerStyle={markerStyle}
                counterFlip={false}
              />
            );
          })}
        </>
      )}

      {live && hoopBottom && (
        <line
          x1={0}
          y1={0}
          x2={COURT_WIDTH_M}
          y2={0}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}

      {children}
    </svg>
  );
}
