import React, { useEffect, useMemo, useState } from 'react';
import type { Game } from '../App';
import { ChevronsUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';
import {
  LINEUP_INCLUDES_PLAYER_MAX,
  deriveAggregatedLineupUnits,
  filterAggregatedLineupUnits,
  toLineupUnitViews,
} from '../utils/lineupUnits';

interface GameLineupsTabProps {
  game: Game;
}

type TeamFilter = 'both' | 'home' | 'away';
type SortKey = 'minutes' | 'plusMinus';
type SortDir = 'desc' | 'asc';

export function GameLineupsTab({ game }: GameLineupsTabProps) {
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('both');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('minutes');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const allUnits = useMemo(() => deriveAggregatedLineupUnits(game), [game]);

  const playerOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const u of allUnits) {
      if (teamFilter === 'home' && u.side !== 'home') continue;
      if (teamFilter === 'away' && u.side !== 'away') continue;
      for (const id of u.playerIds) ids.add(id);
    }
    const players = [...game.homeTeam.players, ...game.awayTeam.players].filter(
      (p) => ids.has(p.id)
    );
    return players.sort((a, b) => {
      const teamA = game.homeTeam.players.some((p) => p.id === a.id) ? 0 : 1;
      const teamB = game.homeTeam.players.some((p) => p.id === b.id) ? 0 : 1;
      if (teamA !== teamB) return teamA - teamB;
      return (a.number ?? 0) - (b.number ?? 0);
    });
  }, [allUnits, game, teamFilter]);

  // Keep selection in sync when team filter removes options.
  useEffect(() => {
    const allowed = new Set(playerOptions.map((p) => p.id));
    setSelectedPlayerIds((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [playerOptions]);

  const views = useMemo(() => {
    const filtered = filterAggregatedLineupUnits(allUnits, {
      team: teamFilter,
      playerIds: selectedPlayerIds,
    });
    const sorted = [...filtered].sort((a, b) => {
      const av = sortKey === 'minutes' ? a.minutes : a.plusMinus;
      const bv = sortKey === 'minutes' ? b.minutes : b.plusMinus;
      if (av !== bv) return sortDir === 'desc' ? bv - av : av - bv;
      const a2 = sortKey === 'minutes' ? a.plusMinus : a.minutes;
      const b2 = sortKey === 'minutes' ? b.plusMinus : b.minutes;
      if (a2 !== b2) return b2 - a2;
      return a.key.localeCompare(b.key);
    });
    return toLineupUnitViews(game, sorted);
  }, [allUnits, game, teamFilter, selectedPlayerIds, sortKey, sortDir]);

  const homeAbbr = game.homeTeam.abbreviation || game.homeTeam.name;
  const awayAbbr = game.awayTeam.abbreviation || game.awayTeam.name;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(key);
    setSortDir('desc');
  };

  const renderSortHead = (label: string, column: SortKey, className?: string) => {
    const active = sortKey === column;
    return (
      <TableHead
        className={cn(
          'cursor-pointer select-none hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
          className
        )}
        onClick={() => toggleSort(column)}
        aria-sort={
          active ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'
        }
      >
        {label}
        {active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
      </TableHead>
    );
  };

  const togglePlayer = (playerId: string, checked: boolean) => {
    setSelectedPlayerIds((prev) => {
      if (!checked) return prev.filter((id) => id !== playerId);
      if (prev.includes(playerId)) return prev;
      if (prev.length >= LINEUP_INCLUDES_PLAYER_MAX) return prev;
      return [...prev, playerId];
    });
  };

  const includesTriggerLabel = (() => {
    if (selectedPlayerIds.length === 0) return 'All players';
    const labels = selectedPlayerIds.map((id) => {
      const p = playerOptions.find((opt) => opt.id === id);
      return p ? `#${p.number} ${p.name}` : id;
    });
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
    return `${labels[0]} +${labels.length - 1} more`;
  })();

  const atMax = selectedPlayerIds.length >= LINEUP_INCLUDES_PLAYER_MAX;

  return (
    <Card className="shadow-lg rounded-2xl">
      <CardHeader className="pb-3 space-y-4">
        <CardTitle className="text-base">Lineups</CardTitle>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5 min-w-[10rem]">
            <Label htmlFor="lineup-team-filter" className="text-xs">
              Team
            </Label>
            <Select
              value={teamFilter}
              onValueChange={(v) => setTeamFilter(v as TeamFilter)}
            >
              <SelectTrigger id="lineup-team-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="home">{homeAbbr}</SelectItem>
                <SelectItem value="away">{awayAbbr}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[14rem] flex-1">
            <Label htmlFor="lineup-player-filter" className="text-xs">
              Includes players (all selected)
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="lineup-player-filter"
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="h-9 w-full min-w-0 justify-between bg-background font-normal shadow-sm"
                >
                  <span className="truncate">{includesTriggerLabel}</span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(100vw-2rem,20rem)] p-0" align="start">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedPlayerIds.length}/{LINEUP_INCLUDES_PLAYER_MAX} selected
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground hover:underline"
                    onClick={() => setSelectedPlayerIds([])}
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {playerOptions.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      No players
                    </p>
                  ) : (
                    playerOptions.map((p) => {
                      const itemId = `lineup-player-${p.id}`;
                      const checked = selectedPlayerIds.includes(p.id);
                      const disabled = !checked && atMax;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                          <Checkbox
                            id={itemId}
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(next) =>
                              togglePlayer(p.id, next === true)
                            }
                          />
                          <Label
                            htmlFor={itemId}
                            className={cn(
                              'cursor-pointer text-sm font-normal',
                              disabled && 'cursor-not-allowed opacity-50'
                            )}
                          >
                            #{p.number} {p.name}
                          </Label>
                        </div>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {views.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No lineups match these filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lineup</TableHead>
                <TableHead className="text-center w-16">Team</TableHead>
                {renderSortHead('Min', 'minutes', 'text-right w-24')}
                {renderSortHead('+/-', 'plusMinus', 'text-right w-24')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {views.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="text-sm leading-snug">
                    {row.playerLabels.join(', ')}
                  </TableCell>
                  <TableCell
                    className={`text-center text-sm font-medium ${
                      row.side === 'home'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {row.side === 'home' ? homeAbbr : awayAbbr}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {row.minutesDisplay}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {row.plusMinusDisplay}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
