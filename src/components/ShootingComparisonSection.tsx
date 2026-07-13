import React from 'react';
import type { ShootingComparisonRow } from '../utils/gameComparisonVisualModel';

const HOME_RING = '#2563eb';
const AWAY_RING = '#f59e0b';
const RING_TRACK = '#e5e7eb';

interface DonutRingProps {
  pct: number | null;
  color: string;
}

function DonutRing({ pct, color }: DonutRingProps) {
  const size = 48;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = pct == null ? 0 : (pct / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={RING_TRACK}
          strokeWidth={stroke}
        />
        {pct != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {pct == null ? '—' : `${pct}%`}
      </div>
    </div>
  );
}

interface ShootingComparisonSectionProps {
  rows: ShootingComparisonRow[];
  homeAbbr: string;
  awayAbbr: string;
}

export function ShootingComparisonSection({
  rows,
  homeAbbr,
  awayAbbr,
}: ShootingComparisonSectionProps) {
  return (
    <div className="mx-auto w-full space-y-2">
      <div className="flex items-center justify-center gap-2 px-2 text-sm font-semibold uppercase tracking-wide">
        <div className="relative flex items-center gap-2">
          <div className="w-11 shrink-0" aria-hidden />
          <div className="w-12 shrink-0" aria-hidden />
          <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-blue-600 dark:text-blue-400">
            {homeAbbr}
          </span>
        </div>
        <div className="w-24 shrink-0" aria-hidden />
        <div className="relative flex items-center gap-2">
          <div className="w-12 shrink-0" aria-hidden />
          <div className="w-11 shrink-0" aria-hidden />
          <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-amber-600 dark:text-amber-400">
            {awayAbbr}
          </span>
        </div>
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5"
        >
          <div className="w-11 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {row.home.line}
          </div>
          <div className="flex w-12 shrink-0 justify-center">
            <DonutRing pct={row.home.pct} color={HOME_RING} />
          </div>
          <div className="w-24 shrink-0 text-center text-sm font-medium">
            {row.label}
          </div>
          <div className="flex w-12 shrink-0 justify-center">
            <DonutRing pct={row.away.pct} color={AWAY_RING} />
          </div>
          <div className="w-11 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {row.away.line}
          </div>
        </div>
      ))}
    </div>
  );
}
