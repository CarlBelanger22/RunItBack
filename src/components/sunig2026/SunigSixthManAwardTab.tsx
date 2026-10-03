// TEMP — delete after Sunig 2026 awards gag (target: after 4 Oct 2026).
// Remove this file + Awards tab wiring in tabs.ts + TournamentPage.

import React, { useEffect, useMemo, useState } from 'react';
import type { Game, Team } from '../../App';
import { TeamBadge } from '../TeamBadge';
import { isGameCompleted } from '../../utils/scheduledGames';

export const SUNIG_2026_TOURNAMENT_ID = 'tournament-1786255606272';
export const JEREMY_CHEW_PLAYER_ID = 'player-sunig-ntu-10';
export const NTU_SUNIG_TEAM_ID = 'team-sunig-ntu';

/** NBL Div 2 2024 averages (11 games) — real DB line, not a rounded memory. */
const DIV2_BEFORE = {
  label: 'NBL Div 2 2024',
  games: 11,
  pts: 4.8,
  reb: 2.2,
  ast: 2.6,
  stl: 1.4,
  min: 24.0,
} as const;

type GameLine = {
  gameId: string;
  date: string;
  opponentLabel: string;
  min: number;
  pts: number;
  orb: number;
  drb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fd: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  plusMinus: number;
  offBench: boolean;
};

function fmt1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function pct(made: number, att: number): string {
  if (att <= 0) return '—';
  return `${((made / att) * 100).toFixed(1)}%`;
}

function buildJeremyLines(games: Game[], ntuTeamId: string, teams: Team[]): GameLine[] {
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? 'Opponent';
  const lines: GameLine[] = [];
  for (const game of games) {
    if (!isGameCompleted(game)) continue;
    const row = (game.gameStats ?? []).find((s) => s.playerId === JEREMY_CHEW_PLAYER_ID);
    if (!row) continue;
    const isHome = game.homeTeamId === ntuTeamId;
    const oppId = isHome ? game.awayTeamId : game.homeTeamId;
    const starters = isHome ? game.homeStarters ?? [] : game.awayStarters ?? [];
    lines.push({
      gameId: game.id,
      date: game.date,
      opponentLabel: teamName(oppId),
      min: Number(row.minutes_played) || 0,
      pts: row.points || 0,
      orb: row.orb || 0,
      drb: row.drb || 0,
      reb: (row.orb || 0) + (row.drb || 0),
      ast: row.assists || 0,
      stl: row.steals || 0,
      blk: row.blocks || 0,
      tov: row.turnovers || 0,
      pf: row.fouls || 0,
      fd: row.fouls_drawn || 0,
      fgm: row.fg_made || 0,
      fga: row.fg_attempted || 0,
      tpm: row.three_made || 0,
      tpa: row.three_attempted || 0,
      ftm: row.ft_made || 0,
      fta: row.ft_attempted || 0,
      plusMinus: row.plus_minus || 0,
      offBench: !starters.includes(JEREMY_CHEW_PLAYER_ID),
    });
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date));
}

function CountUp({ value, decimals = 1, delayMs = 0 }: { value: number; decimals?: number; delayMs?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const startAt = performance.now() + delayMs;
    const duration = 900;
    const tick = (now: number) => {
      if (now < startAt) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delayMs]);
  return <>{shown.toFixed(decimals)}</>;
}

interface SunigSixthManAwardTabProps {
  games: Game[];
  teams: Team[];
  onNavigateToPlayer?: (playerId: string, teamId?: string) => void;
}

export function SunigSixthManAwardTab({
  games,
  teams,
  onNavigateToPlayer,
}: SunigSixthManAwardTabProps) {
  const ntu = teams.find((t) => t.id === NTU_SUNIG_TEAM_ID);
  const lines = useMemo(
    () => buildJeremyLines(games, NTU_SUNIG_TEAM_ID, teams),
    [games, teams],
  );
  const n = lines.length || 1;
  const totals = useMemo(() => {
    const sum = (k: keyof GameLine) => lines.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    return {
      games: lines.length,
      min: sum('min'),
      pts: sum('pts'),
      reb: sum('reb'),
      orb: sum('orb'),
      drb: sum('drb'),
      ast: sum('ast'),
      stl: sum('stl'),
      blk: sum('blk'),
      tov: sum('tov'),
      pf: sum('pf'),
      fd: sum('fd'),
      fgm: sum('fgm'),
      fga: sum('fga'),
      tpm: sum('tpm'),
      tpa: sum('tpa'),
      ftm: sum('ftm'),
      fta: sum('fta'),
      plusMinus: sum('plusMinus'),
      offBenchEveryGame: lines.length > 0 && lines.every((l) => l.offBench),
    };
  }, [lines]);

  const avg = {
    pts: totals.pts / n,
    reb: totals.reb / n,
    ast: totals.ast / n,
    stl: totals.stl / n,
    min: totals.min / n,
    tpm: totals.tpm / n,
  };

  return (
    <div className="sunig-sixth-man relative overflow-hidden rounded-none">
      <style>{`
        @keyframes sunig-stamp {
          0% { transform: scale(2.4) rotate(-12deg); opacity: 0; }
          55% { transform: scale(0.92) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(-3deg); opacity: 1; }
        }
        @keyframes sunig-shine {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes sunig-rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sunig-pulse-gold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.35); }
          50% { box-shadow: 0 0 36px 8px rgba(234, 179, 8, 0.45); }
        }
        .sunig-sixth-man {
          --sm-ink: #1a1205;
          --sm-gold: #f5c518;
          --sm-gold-deep: #b8860b;
          --sm-cream: #fff8e7;
          --sm-red: #c8102e;
          background:
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245, 197, 24, 0.55), transparent 55%),
            radial-gradient(ellipse 60% 40% at 100% 100%, rgba(200, 16, 46, 0.18), transparent 50%),
            linear-gradient(165deg, #1a1205 0%, #3d2a0a 40%, #1a1205 100%);
          color: var(--sm-cream);
          padding: 1.25rem 1rem 2.5rem;
        }
        .sunig-stamp {
          animation: sunig-stamp 0.75s cubic-bezier(0.2, 1.4, 0.3, 1) both;
        }
        .sunig-rise {
          animation: sunig-rise 0.7s ease-out both;
        }
        .sunig-rise-delay-1 { animation-delay: 0.12s; }
        .sunig-rise-delay-2 { animation-delay: 0.24s; }
        .sunig-rise-delay-3 { animation-delay: 0.36s; }
        .sunig-gold-text {
          background: linear-gradient(110deg, #fff3b0 0%, #f5c518 35%, #fff8d0 50%, #b8860b 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: sunig-shine 2.8s linear infinite alternate;
        }
        .sunig-medal {
          animation: sunig-pulse-gold 2.2s ease-in-out infinite;
        }
        .sunig-stat-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.65rem;
        }
        @media (min-width: 640px) {
          .sunig-stat-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
        }
      `}</style>

      {/* Hero */}
      <section className="relative mx-auto max-w-4xl text-center pt-4 pb-8">
        <p className="sunig-rise text-[11px] tracking-[0.35em] uppercase text-amber-200/80 mb-3">
          Sunig 2026 · Temporary Award · Off the Bench
        </p>
        <div className="sunig-stamp sunig-medal inline-flex items-center justify-center rounded-full border-4 border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-5 py-2 mb-5">
          <span className="text-xs sm:text-sm font-black tracking-[0.2em] uppercase text-[#1a1205]">
            ★ Sixth Man of the Tournament ★
          </span>
        </div>
        <h1 className="sunig-rise sunig-rise-delay-1 sunig-gold-text text-5xl sm:text-7xl font-black tracking-tight leading-[0.95] mb-3">
          JEREMY CHEW
        </h1>
        <button
          type="button"
          className="sunig-rise sunig-rise-delay-2 inline-flex items-center gap-3 mx-auto mb-4 rounded-full border border-amber-400/40 bg-black/25 px-4 py-2"
          onClick={() => onNavigateToPlayer?.(JEREMY_CHEW_PLAYER_ID, NTU_SUNIG_TEAM_ID)}
        >
          {ntu ? <TeamBadge team={ntu} teamId={ntu.id} size="lg" /> : null}
          <span className="text-left">
            <span className="block text-lg font-bold text-amber-100">NTU · #{ntu?.players?.find((p) => p.id === JEREMY_CHEW_PLAYER_ID)?.number ?? '8'}</span>
            <span className="block text-xs text-amber-100/70">
              {totals.offBenchEveryGame
                ? `Came off the bench in all ${totals.games} Sunig games`
                : `${totals.games} Sunig games`}
            </span>
          </span>
        </button>
        <p className="sunig-rise sunig-rise-delay-3 mx-auto max-w-xl text-base sm:text-lg text-amber-50/90 font-medium leading-snug">
          From a quiet NBL Div 2 line of{' '}
          <span className="text-amber-200 font-black">{fmt1(DIV2_BEFORE.pts)}/{fmt1(DIV2_BEFORE.reb)}/{fmt1(DIV2_BEFORE.ast)}</span>
          {' '}to a steal-hunting, three-spotting sixth man who refused to stay quiet.
        </p>
      </section>

      {/* Before / After */}
      <section className="sunig-rise sunig-rise-delay-2 mx-auto max-w-4xl mb-8">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] items-stretch">
          <div className="rounded-xl border border-white/10 bg-black/35 p-4 text-left">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-1">Then</p>
            <p className="text-sm font-semibold text-white/80 mb-3">{DIV2_BEFORE.label} · {DIV2_BEFORE.games}g</p>
            <p className="text-3xl sm:text-4xl font-black text-white/70 tabular-nums">
              {fmt1(DIV2_BEFORE.pts)}/{fmt1(DIV2_BEFORE.reb)}/{fmt1(DIV2_BEFORE.ast)}
            </p>
            <p className="mt-2 text-xs text-white/45">
              PPG / RPG / APG · {fmt1(DIV2_BEFORE.stl)} SPG · {fmt1(DIV2_BEFORE.min)} MPG
            </p>
          </div>
          <div className="flex items-center justify-center text-3xl font-black text-amber-300 px-2">
            →
          </div>
          <div className="rounded-xl border-2 border-amber-400/70 bg-amber-500/15 p-4 text-left">
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber-200/80 mb-1">Now · Sunig</p>
            <p className="text-sm font-semibold text-amber-100 mb-3">{totals.games}g · all off the bench</p>
            <p className="text-3xl sm:text-4xl font-black text-amber-300 tabular-nums">
              <CountUp value={avg.pts} />/<CountUp value={avg.reb} delayMs={80} />/<CountUp value={avg.ast} delayMs={160} />
            </p>
            <p className="mt-2 text-xs text-amber-100/80">
              PPG / RPG / APG · <span className="font-black text-amber-200">{fmt1(avg.stl)} SPG</span> · {fmt1(avg.min)} MPG
            </p>
          </div>
        </div>
      </section>

      {/* Obnoxious stat dump */}
      <section className="sunig-rise sunig-rise-delay-3 mx-auto max-w-4xl mb-8">
        <h2 className="text-center text-xs uppercase tracking-[0.3em] text-amber-200/70 mb-3">
          Every. Single. Stat.
        </h2>
        <div className="sunig-stat-grid">
          {[
            { label: 'PTS', value: totals.pts, sub: `${fmt1(avg.pts)}/g` },
            { label: 'REB', value: totals.reb, sub: `${totals.orb} OR / ${totals.drb} DR` },
            { label: 'AST', value: totals.ast, sub: `${fmt1(avg.ast)}/g` },
            { label: 'STL', value: totals.stl, sub: `${fmt1(avg.stl)}/g ★` },
            { label: '3PM', value: totals.tpm, sub: pct(totals.tpm, totals.tpa) },
            { label: 'MIN', value: Math.round(totals.min), sub: `${fmt1(avg.min)}/g` },
            { label: 'FG', value: `${totals.fgm}/${totals.fga}`, sub: pct(totals.fgm, totals.fga) },
            { label: '3P', value: `${totals.tpm}/${totals.tpa}`, sub: pct(totals.tpm, totals.tpa) },
            { label: 'FT', value: `${totals.ftm}/${totals.fta}`, sub: pct(totals.ftm, totals.fta) },
            { label: 'BLK', value: totals.blk, sub: 'total' },
            { label: 'TO', value: totals.tov, sub: 'total' },
            { label: '+/-', value: totals.plusMinus >= 0 ? `+${totals.plusMinus}` : `${totals.plusMinus}`, sub: 'sum' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-amber-400/25 bg-black/40 px-2 py-3 text-center"
            >
              <div className="text-[10px] uppercase tracking-wider text-amber-200/60">{s.label}</div>
              <div className="text-xl sm:text-2xl font-black tabular-nums text-amber-100">{s.value}</div>
              <div className="text-[10px] text-white/45">{s.sub}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-sm text-amber-100/80 font-semibold">
          Steal rate leap: {fmt1(DIV2_BEFORE.stl)} → {fmt1(avg.stl)} SPG · threes: {totals.tpm} makes in {totals.games} games
        </p>
      </section>

      {/* Game log */}
      <section className="mx-auto max-w-4xl">
        <h2 className="text-center text-xs uppercase tracking-[0.3em] text-amber-200/70 mb-3">
          Game-by-game evidence
        </h2>
        <div className="space-y-3">
          {lines.map((line) => (
            <div
              key={line.gameId}
              className="rounded-xl border border-white/10 bg-black/40 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <p className="font-bold text-amber-100">
                  vs {line.opponentLabel}
                  {line.offBench ? (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300/80 border border-amber-400/40 rounded px-1.5 py-0.5">
                      Bench
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-white/45">{line.date}</p>
              </div>
              <p className="text-2xl font-black tabular-nums text-white mb-1">
                {line.pts} PTS · {line.reb} REB · {line.ast} AST · {line.stl} STL
              </p>
              <p className="text-xs text-white/55 tabular-nums">
                {fmt1(line.min)} MIN · FG {line.fgm}/{line.fga} · 3P {line.tpm}/{line.tpa} · FT {line.ftm}/{line.fta}
                {' · '}ORB/DRB {line.orb}/{line.drb} · BLK {line.blk} · TO {line.tov} · PF {line.pf} · FD {line.fd}
                {' · '}
                {line.plusMinus >= 0 ? `+${line.plusMinus}` : line.plusMinus}
              </p>
            </div>
          ))}
          {lines.length === 0 ? (
            <p className="text-center text-white/50 text-sm">No completed Sunig games found for Jeremy yet.</p>
          ) : null}
        </div>
        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.25em] text-white/30">
          TEMP page — delete sunig2026/ after today
        </p>
      </section>
    </div>
  );
}
