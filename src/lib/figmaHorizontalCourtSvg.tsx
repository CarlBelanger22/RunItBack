import React, { useId } from 'react';
import { cn } from '../components/ui/utils';
import {
  HORIZONTAL_CORNER_Y_SVG,
  HORIZONTAL_COURT_ASPECT,
  HORIZONTAL_COURT_VH,
  HORIZONTAL_COURT_VW,
  HORIZONTAL_INSET,
  HORIZONTAL_PAINT_DEPTH_SVG,
  HORIZONTAL_PAINT_WIDTH_SVG,
  HORIZONTAL_THREE_ARC_RADIUS_SVG,
  horizontalBackboardLeftX,
  horizontalBackboardRightX,
  horizontalBasketLeftX,
  horizontalBasketRightX,
} from './horizontalCourtLayout';

export {
  HORIZONTAL_COURT_ASPECT,
  HORIZONTAL_COURT_VH,
  HORIZONTAL_COURT_VW,
  HORIZONTAL_INSET,
} from './horizontalCourtLayout';

export const LIVE_HORIZONTAL_COURT_COLORS = {
  /** Court label / key paint tints only — UI chrome uses liveEntryTheme.ts */
  home: '#1a7eff',
  away: '#ff6b35',
  floorDark: '#b8841e',
  floor: '#cc9930',
  floorStroke: '#8b6812',
  line: '#ffffff',
  rim: '#ff5500',
  rimRing: '#ffffff',
} as const;

export interface HorizontalCourtMarker {
  x: number;
  y: number;
  color: 'green' | 'red' | 'orange';
}

export interface FigmaHorizontalCourtSvgProps {
  className?: string;
  markers?: HorizontalCourtMarker[];
  homeLabel?: string;
  awayLabel?: string;
  shotMode?: boolean;
  shotModeColor?: string;
  children?: React.ReactNode;
}

export function fitHorizontalCourtDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };

  const widthFirst = { width, height: width / HORIZONTAL_COURT_ASPECT };
  if (widthFirst.height <= height) return widthFirst;

  return { width: height * HORIZONTAL_COURT_ASPECT, height };
}

/**
 * 3PT line from basket-centered radius (FIBA 6.75 m via horizontalCourtLayout scale).
 * `radiusFromBasket` is SVG distance from hoop center — must match HORIZONTAL_THREE_ARC_RADIUS_SVG.
 */
function buildHorizontalThreePointPath(
  basketX: number,
  basketY: number,
  baselineX: number,
  cornerY: number,
  viewHeight: number,
  radiusFromBasket: number,
  attacksRight: boolean
): { path: string; arcMeetX: number } {
  const dy = basketY - cornerY;
  const chordHalf = Math.sqrt(Math.max(0, radiusFromBasket ** 2 - dy ** 2));
  const arcMeetX = attacksRight ? basketX + chordHalf : basketX - chordHalf;
  const bottomY = viewHeight - cornerY;
  const sweep = attacksRight ? 1 : 0;

  const path = [
    `M ${baselineX} ${cornerY}`,
    `L ${arcMeetX} ${cornerY}`,
    `A ${radiusFromBasket} ${radiusFromBasket} 0 0 ${sweep} ${arcMeetX} ${bottomY}`,
    `L ${baselineX} ${bottomY}`,
  ].join(' ');

  return { path, arcMeetX };
}

export function FigmaHorizontalCourtSvg({
  className,
  markers = [],
  homeLabel = 'HOME',
  awayLabel = 'AWAY',
  shotMode = false,
  shotModeColor = LIVE_HORIZONTAL_COURT_COLORS.home,
  children,
}: FigmaHorizontalCourtSvgProps) {
  const uid = useId().replace(/:/g, '');
  const courtClipId = `court2-${uid}`;
  const lkeyClipId = `lkey2-${uid}`;
  const rkeyClipId = `rkey2-${uid}`;

  const VW = HORIZONTAL_COURT_VW;
  const VH = HORIZONTAL_COURT_VH;
  const keyW = HORIZONTAL_PAINT_WIDTH_SVG;
  const keyD = HORIZONTAL_PAINT_DEPTH_SVG;
  const lBX = horizontalBasketLeftX();
  const rBX = horizontalBasketRightX();
  const backboardLeftX = horizontalBackboardLeftX();
  const backboardRightX = horizontalBackboardRightX();
  const bY = VH / 2;
  const threeR = HORIZONTAL_THREE_ARC_RADIUS_SVG;
  const c3Y = HORIZONTAL_CORNER_Y_SVG;
  const leftThree = buildHorizontalThreePointPath(
    lBX,
    bY,
    HORIZONTAL_INSET,
    c3Y,
    VH,
    threeR,
    true
  );
  const rightThree = buildHorizontalThreePointPath(
    rBX,
    bY,
    VW - HORIZONTAL_INSET,
    c3Y,
    VH,
    threeR,
    false
  );
  const { home, away, floorDark, floor, floorStroke, line, rim, rimRing } =
    LIVE_HORIZONTAL_COURT_COLORS;

  return (
    <div
      className={cn('relative overflow-hidden rounded', className)}
      style={{
        outline: shotMode ? `2px solid ${shotModeColor}66` : undefined,
        outlineOffset: 2,
      }}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={courtClipId}>
            <rect x={HORIZONTAL_INSET} y={HORIZONTAL_INSET} width={VW - 3} height={VH - 3} />
          </clipPath>
          <clipPath id={lkeyClipId}>
            <rect x={HORIZONTAL_INSET} y={bY - keyW / 2} width={keyD} height={keyW} />
          </clipPath>
          <clipPath id={rkeyClipId}>
            <rect
              x={VW - HORIZONTAL_INSET - keyD}
              y={bY - keyW / 2}
              width={keyD}
              height={keyW}
            />
          </clipPath>
        </defs>

        <rect x={0} y={0} width={VW} height={VH} fill={floorDark} />
        <rect
          x={0.5}
          y={0.5}
          width={VW - 1}
          height={VH - 1}
          fill={floor}
          stroke={floorStroke}
          strokeWidth={0.2}
        />
        {Array.from({ length: 22 }).map((_, i) => (
          <line
            key={i}
            x1={0}
            y1={i * 4.8}
            x2={VW}
            y2={i * 4.8}
            stroke={floorDark}
            strokeWidth={0.1}
            opacity={0.5}
          />
        ))}

        <rect
          x={HORIZONTAL_INSET}
          y={HORIZONTAL_INSET}
          width={VW - 3}
          height={VH - 3}
          fill="none"
          stroke={line}
          strokeWidth={0.45}
        />
        <line
          x1={VW / 2}
          y1={HORIZONTAL_INSET}
          x2={VW / 2}
          y2={VH - HORIZONTAL_INSET}
          stroke={line}
          strokeWidth={0.4}
        />
        <circle cx={VW / 2} cy={bY} r={6} fill="none" stroke={line} strokeWidth={0.4} />
        <circle cx={VW / 2} cy={bY} r={0.7} fill={line} />

        <rect
          x={HORIZONTAL_INSET}
          y={bY - keyW / 2}
          width={keyD}
          height={keyW}
          fill="rgba(26,126,255,0.15)"
          stroke={line}
          strokeWidth={0.4}
        />
        <circle
          cx={HORIZONTAL_INSET + keyD}
          cy={bY}
          r={6}
          fill="none"
          stroke={line}
          strokeWidth={0.4}
          strokeDasharray="1.4 1.4"
          clipPath={`url(#${lkeyClipId})`}
        />
        <circle
          cx={HORIZONTAL_INSET + keyD}
          cy={bY}
          r={6}
          fill="none"
          stroke={line}
          strokeWidth={0.4}
          clipPath={`url(#${courtClipId})`}
        />
        <line
          x1={backboardLeftX}
          y1={bY - 9}
          x2={backboardLeftX}
          y2={bY + 9}
          stroke={line}
          strokeWidth={0.9}
        />
        <circle cx={lBX} cy={bY} r={2.6} fill="none" stroke={rimRing} strokeWidth={0.5} />
        <circle cx={lBX} cy={bY} r={2.2} fill="none" stroke={rim} strokeWidth={0.85} />
        <circle cx={lBX} cy={bY} r={0.65} fill={rim} />
        <path
          d={`M ${lBX} ${bY - 4.2} A 4.2 4.2 0 0 1 ${lBX} ${bY + 4.2}`}
          fill="none"
          stroke={line}
          strokeWidth={0.35}
        />
        <path
          d={leftThree.path}
          fill="none"
          stroke={line}
          strokeWidth={0.4}
          clipPath={`url(#${courtClipId})`}
        />
        <line
          x1={HORIZONTAL_INSET}
          y1={c3Y}
          x2={leftThree.arcMeetX}
          y2={c3Y}
          stroke={line}
          strokeWidth={0.4}
        />
        <line
          x1={HORIZONTAL_INSET}
          y1={VH - c3Y}
          x2={leftThree.arcMeetX}
          y2={VH - c3Y}
          stroke={line}
          strokeWidth={0.4}
        />

        <rect
          x={VW - HORIZONTAL_INSET - keyD}
          y={bY - keyW / 2}
          width={keyD}
          height={keyW}
          fill="rgba(255,107,53,0.12)"
          stroke={line}
          strokeWidth={0.4}
        />
        <circle
          cx={VW - HORIZONTAL_INSET - keyD}
          cy={bY}
          r={6}
          fill="none"
          stroke={line}
          strokeWidth={0.4}
          strokeDasharray="1.4 1.4"
          clipPath={`url(#${rkeyClipId})`}
        />
        <circle
          cx={VW - HORIZONTAL_INSET - keyD}
          cy={bY}
          r={6}
          fill="none"
          stroke={line}
          strokeWidth={0.4}
          clipPath={`url(#${courtClipId})`}
        />
        <line
          x1={backboardRightX}
          y1={bY - 9}
          x2={backboardRightX}
          y2={bY + 9}
          stroke={line}
          strokeWidth={0.9}
        />
        <circle cx={rBX} cy={bY} r={2.6} fill="none" stroke={rimRing} strokeWidth={0.5} />
        <circle cx={rBX} cy={bY} r={2.2} fill="none" stroke={rim} strokeWidth={0.85} />
        <circle cx={rBX} cy={bY} r={0.65} fill={rim} />
        <path
          d={`M ${rBX} ${bY - 4.2} A 4.2 4.2 0 0 0 ${rBX} ${bY + 4.2}`}
          fill="none"
          stroke={line}
          strokeWidth={0.35}
        />
        <path
          d={rightThree.path}
          fill="none"
          stroke={line}
          strokeWidth={0.4}
          clipPath={`url(#${courtClipId})`}
        />
        <line
          x1={VW - HORIZONTAL_INSET}
          y1={c3Y}
          x2={rightThree.arcMeetX}
          y2={c3Y}
          stroke={line}
          strokeWidth={0.4}
        />
        <line
          x1={VW - HORIZONTAL_INSET}
          y1={VH - c3Y}
          x2={rightThree.arcMeetX}
          y2={VH - c3Y}
          stroke={line}
          strokeWidth={0.4}
        />

        {markers.map((m, i) => {
          const fill =
            m.color === 'green' ? '#22c55e' : m.color === 'red' ? '#ef4444' : '#f97316';
          return m.color === 'red' ? (
            <g key={i} opacity={0.85}>
              <line
                x1={m.x - 1.4}
                y1={m.y - 1.4}
                x2={m.x + 1.4}
                y2={m.y + 1.4}
                stroke={fill}
                strokeWidth={0.6}
              />
              <line
                x1={m.x + 1.4}
                y1={m.y - 1.4}
                x2={m.x - 1.4}
                y2={m.y + 1.4}
                stroke={fill}
                strokeWidth={0.6}
              />
            </g>
          ) : (
            <circle
              key={i}
              cx={m.x}
              cy={m.y}
              r={1.5}
              fill={fill}
              stroke="#fff"
              strokeWidth={0.3}
              opacity={0.93}
            />
          );
        })}

        <text
          x={VW * 0.25}
          y={bY + 20}
          textAnchor="middle"
          fill="rgba(255,255,255,0.10)"
          fontSize={4.5}
          fontFamily="JetBrains Mono, monospace"
          letterSpacing={1.5}
        >
          {homeLabel}
        </text>
        <text
          x={VW * 0.75}
          y={bY + 20}
          textAnchor="middle"
          fill="rgba(255,255,255,0.10)"
          fontSize={4.5}
          fontFamily="JetBrains Mono, monospace"
          letterSpacing={1.5}
        >
          {awayLabel}
        </text>
      </svg>

      <div className="pointer-events-none absolute bottom-1 left-0 right-0 flex justify-between px-2">
        <span
          className="live-font-mono text-[8px]"
          style={{ color: `${home}66` }}
        >
          ◀ HOME
        </span>
        <span
          className="live-font-mono text-[8px]"
          style={{ color: `${away}66` }}
        >
          AWAY ▶
        </span>
      </div>

      {children}
    </div>
  );
}
