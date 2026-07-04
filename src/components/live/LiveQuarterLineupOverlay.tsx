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
  onConfirm: (homeLineup: string[], awayLineup: string[]) => void;
  onCancel?: () => void;
}

function LineupPicker({
  side,
  teamName,
  abbrev,
  players,
  selected,
  onToggle,
}: {
  side: 'home' | 'away';
  teamName: string;
  abbrev: string;
  players: { id: string; name: string; number: number }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const color = getLiveTeamColor(side);
  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <Label style={{ color }}>{abbrev} — {teamName}</Label>
        <span className="live-font-mono text-xs text-muted-foreground shrink-0">{selected.length}/5</span>
      </div>
      <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
        {players.map((p) => {
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

function toggleLineup(id: string, selected: string[], setSelected: (v: string[]) => void) {
  if (selected.includes(id)) {
    setSelected(selected.filter((x) => x !== id));
    return;
  }
  if (selected.length >= 5) return;
  setSelected([...selected, id]);
}

export function LiveQuarterLineupOverlay({
  game,
  defaultHomeIds,
  defaultAwayIds,
  onConfirm,
  onCancel,
}: LiveQuarterLineupOverlayProps) {
  const [homeLineup, setHomeLineup] = useState<string[]>(() => defaultHomeIds.slice(0, 5));
  const [awayLineup, setAwayLineup] = useState<string[]>(() => defaultAwayIds.slice(0, 5));

  const valid = homeLineup.length === 5 && awayLineup.length === 5;
  const nextPeriod = game.currentPeriod + 1;
  const nextPeriodLabel = periodLabel(nextPeriod, resolveGameClockSettings(game));

  return (
    <LiveCourtOverlayShell>
      <Card className="border-primary/50 shadow-xl w-[min(96vw,920px)]">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-center text-base">{nextPeriodLabel} — On-court lineups</CardTitle>
          <p className="text-center text-xs text-muted-foreground">
            Select exactly 5 players per team for the next period
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pb-4">
          <div className="grid grid-cols-2 gap-0 divide-x divide-border rounded-lg border border-border overflow-hidden">
            <div className="p-3 min-w-0" style={{ background: liveTeamTint('home', '08') }}>
              <LineupPicker
                side="home"
                teamName={game.homeTeam.name}
                abbrev={game.homeTeam.abbreviation}
                players={game.homeTeam.players}
                selected={homeLineup}
                onToggle={(id) => toggleLineup(id, homeLineup, setHomeLineup)}
              />
            </div>
            <div className="p-3 min-w-0" style={{ background: liveTeamTint('away', '08') }}>
              <LineupPicker
                side="away"
                teamName={game.awayTeam.name}
                abbrev={game.awayTeam.abbreviation}
                players={game.awayTeam.players}
                selected={awayLineup}
                onToggle={(id) => toggleLineup(id, awayLineup, setAwayLineup)}
              />
            </div>
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
