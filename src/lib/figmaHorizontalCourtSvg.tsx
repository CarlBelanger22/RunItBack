import React, { useId } from 'react';
import { cn } from '../components/ui/utils';

/** Figma horizontal full-court viewBox (landscape). */
export const HORIZONTAL_COURT_VW = 188;
export const HORIZONTAL_COURT_VH = 100;
export const HORIZONTAL_INSET = 1.5;
export const HORIZONTAL_COURT_ASPECT = HORIZONTAL_COURT_VW / HORIZONTAL_COURT_VH;

export const LIVE_HORIZONTAL_COURT_COLORS = {
  /** Court label / key paint tints only — UI chrome uses liveEntryTheme.ts */
  home: '#1a7eff',
  away: '#ff6b35',
  floorDark: '#b8841e',
  floor: '#cc9930',
  floorStroke: '#8b6812',
  line: '#ffffff',
  rim: '#e07820',
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
  const keyW = 33;
  const keyD = 39;
  const basketX = 10.5;
  const lBX = HORIZONTAL_INSET + basketX;
  const rBX = VW - HORIZONTAL_INSET - basketX;
  const bY = VH / 2;
  const arc3R = 45;
  const c3Y = 9;
  const { home, away, floorDark, floor, floorStroke, line, rim } = LIVE_HORIZONTAL_COURT_COLORS;

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
          x1={HORIZONTAL_INSET + 4.5}
          y1={bY - 9}
          x2={HORIZONTAL_INSET + 4.5}
          y2={bY + 9}
          stroke={line}
          strokeWidth={0.9}
        />
        <circle cx={lBX} cy={bY} r={2.6} fill="none" stroke={rim} strokeWidth={0.65} />
        <circle cx={lBX} cy={bY} r={0.65} fill={rim} />
        <path
          d={`M ${lBX} ${bY - 4.2} A 4.2 4.2 0 0 1 ${lBX} ${bY + 4.2}`}
          fill="none"
          stroke={line}
          strokeWidth={0.35}
        />
        <path
          d={`M ${HORIZONTAL_INSET} ${c3Y} L ${HORIZONTAL_INSET + 14.5} ${c3Y} A ${arc3R} ${arc3R} 0 0 1 ${HORIZONTAL_INSET + 14.5} ${VH - c3Y} L ${HORIZONTAL_INSET} ${VH - c3Y}`}
          fill="none"
          stroke={line}
          strokeWidth={0.4}
          clipPath={`url(#${courtClipId})`}
        />
        <line
          x1={HORIZONTAL_INSET}
          y1={c3Y}
          x2={HORIZONTAL_INSET + 14.5}
          y2={c3Y}
          stroke={line}
          strokeWidth={0.4}
        />
        <line
          x1={HORIZONTAL_INSET}
          y1={VH - c3Y}
          x2={HORIZONTAL_INSET + 14.5}
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
          x1={VW - HORIZONTAL_INSET - 4.5}
          y1={bY - 9}
          x2={VW - HORIZONTAL_INSET - 4.5}
          y2={bY + 9}
          stroke={line}
          strokeWidth={0.9}
        />
        <circle cx={rBX} cy={bY} r={2.6} fill="none" stroke={rim} strokeWidth={0.65} />
        <circle cx={rBX} cy={bY} r={0.65} fill={rim} />
        <path
          d={`M ${rBX} ${bY - 4.2} A 4.2 4.2 0 0 0 ${rBX} ${bY + 4.2}`}
          fill="none"
          stroke={line}
          strokeWidth={0.35}
        />
        <path
          d={`M ${VW - HORIZONTAL_INSET} ${c3Y} L ${VW - HORIZONTAL_INSET - 14.5} ${c3Y} A ${arc3R} ${arc3R} 0 0 0 ${VW - HORIZONTAL_INSET - 14.5} ${VH - c3Y} L ${VW - HORIZONTAL_INSET} ${VH - c3Y}`}
          fill="none"
          stroke={line}
          strokeWidth={0.4}
          clipPath={`url(#${courtClipId})`}
        />
        <line
          x1={VW - HORIZONTAL_INSET}
          y1={c3Y}
          x2={VW - HORIZONTAL_INSET - 14.5}
          y2={c3Y}
          stroke={line}
          strokeWidth={0.4}
        />
        <line
          x1={VW - HORIZONTAL_INSET}
          y1={VH - c3Y}
          x2={VW - HORIZONTAL_INSET - 14.5}
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
