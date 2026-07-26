import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { Game } from '../../App';
import { getLiveTeamColor, liveTeamTint } from './liveEntryTheme';
import { LiveCourtOverlayShell, overlayClick } from './LiveCourtOverlayShell';
import { periodLabel, resolveGameClockSettings } from '../../utils/gameClock';

interface LiveQuarterLineupOverlayProps {
  game: Game;
  defaultHomeIds: string[];
  defaultAwayIds: string[];
  /** Players who have fouled out — excluded from selection and roster count. */
  fouledOutIds?: string[];
  /** Single-team live entry: only pick home lineup (away stays empty). */
  homeOnly?: boolean;
  onConfirm: (homeLineup: string[], awayLineup: string[]) => void;
  onCancel?: () => void;
}

function LineupPicker({
  side,
  teamName,
  abbrev,
  players,
  selected,
  max,
  lockedIds,
  onToggle,
}: {
  side: 'home' | 'away';
  teamName: string;
  abbrev: string;
  players: { id: string; name: string; number: number }[];
  selected: string[];
  max: number;
  lockedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const color = getLiveTeamColor(side);
  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <Label style={{ color }}>{abbrev} — {teamName}</Label>
        <span className="live-font-mono text-xs text-muted-foreground shrink-0">{selected.length}/{max}</span>
      </div>
      <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
        {players.map((p) => {
          if (lockedIds.has(p.id)) {
            return (
              <Button
                key={p.id}
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled
                style={{ opacity: 0.55, display: 'flex', justifyContent: 'space-between' }}
              >
                <span>#{p.number} {p.name}</span>
                <span style={{ color: '#ff3838', fontSize: '0.7rem', fontWeight: 600 }}>
                  Fouled out
                </span>
              </Button>
            );
          }
          const isSelected = selected.includes(p.id);
          return (
            <Button
              key={p.id}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className="w-full justify-start"
              style={
                isSelected
                  ? {
                      background: liveTeamTint(side, '30'),
                      borderColor: color,
                      color,
                    }
                  : undefined
              }
              onClick={overlayClick(() => onToggle(p.id))}
            >
              #{p.number} {p.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function toggleLineup(
  id: string,
  selected: string[],
  setSelected: (v: string[]) => void,
  max: number
) {
  if (selected.includes(id)) {
    setSelected(selected.filter((x) => x !== id));
    return;
  }
  if (selected.length >= max) return;
  setSelected([...selected, id]);
}

export function LiveQuarterLineupOverlay({
  game,
  defaultHomeIds,
  defaultAwayIds,
  fouledOutIds,
  homeOnly = false,
  onConfirm,
  onCancel,
}: LiveQuarterLineupOverlayProps) {
  const fouledOut = new Set(fouledOutIds ?? []);
  const eligibleHome = game.homeTeam.players.filter((p) => !fouledOut.has(p.id));
  const eligibleAway = homeOnly
    ? []
    : game.awayTeam.players.filter((p) => !fouledOut.has(p.id));
  // FIBA short-handed: a depleted team fields min(5, eligible players).
  const homeMax = Math.min(5, eligibleHome.length);
  const awayMax = homeOnly ? 0 : Math.min(5, eligibleAway.length);

  const [homeLineup, setHomeLineup] = useState<string[]>(() =>
    defaultHomeIds.filter((id) => !fouledOut.has(id)).slice(0, homeMax)
  );
  const [awayLineup, setAwayLineup] = useState<string[]>(() =>
    homeOnly
      ? []
      : defaultAwayIds.filter((id) => !fouledOut.has(id)).slice(0, awayMax)
  );

  const valid = homeLineup.length === homeMax && awayLineup.length === awayMax;
  const nextPeriod = game.currentPeriod + 1;
  const nextPeriodLabel = periodLabel(nextPeriod, resolveGameClockSettings(game));

  return (
    <LiveCourtOverlayShell>
      <Card
        className={
          homeOnly
            ? 'live-quarter-lineup-card live-quarter-lineup-card--home-only border-primary/50 shadow-xl'
            : 'live-quarter-lineup-card border-primary/50 shadow-xl'
        }
      >
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-center text-base">{nextPeriodLabel} — On-court lineups</CardTitle>
          <p className="text-center text-xs text-muted-foreground">
            {homeOnly
              ? 'Select your on-court players for the next period'
              : "Select each team's on-court players for the next period"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pb-4">
          <div
            className={
              homeOnly
                ? 'rounded-lg border border-border overflow-hidden'
                : 'grid grid-cols-2 gap-0 divide-x divide-border rounded-lg border border-border overflow-hidden'
            }
          >
            <div className="p-3 min-w-0" style={{ background: liveTeamTint('home', '08') }}>
              <LineupPicker
                side="home"
                teamName={game.homeTeam.name}
                abbrev={game.homeTeam.abbreviation}
                players={game.homeTeam.players}
                selected={homeLineup}
                max={homeMax}
                lockedIds={fouledOut}
                onToggle={(id) => toggleLineup(id, homeLineup, setHomeLineup, homeMax)}
              />
            </div>
            {homeOnly ? null : (
              <div className="p-3 min-w-0" style={{ background: liveTeamTint('away', '08') }}>
                <LineupPicker
                  side="away"
                  teamName={game.awayTeam.name}
                  abbrev={game.awayTeam.abbreviation}
                  players={game.awayTeam.players}
                  selected={awayLineup}
                  max={awayMax}
                  lockedIds={fouledOut}
                  onToggle={(id) => toggleLineup(id, awayLineup, setAwayLineup, awayMax)}
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!valid}
              onClick={overlayClick(() => onConfirm(homeLineup, awayLineup))}
            >
              Start {nextPeriodLabel}
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={overlayClick(onCancel)}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </LiveCourtOverlayShell>
  );
}

export function SubstitutionClockInput({
  currentClock,
  value,
  onChange,
  error,
}: {
  currentClock: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label>Clock when sub occurred (countdown)</Label>
      <p className="text-xs text-muted-foreground">
        Current scoreboard: <span className="live-font-mono">{currentClock}</span> — enter time
        remaining (must be ≤ current)
      </p>
      <Input
        className="live-font-mono"
        placeholder="M:SS"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
