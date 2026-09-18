import React, { useMemo, useState } from 'react';
import type { Game } from '../App';
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
import {
  deriveAggregatedLineupUnits,
  filterAggregatedLineupUnits,
  toLineupUnitViews,
} from '../utils/lineupUnits';

interface GameLineupsTabProps {
  game: Game;
}

type TeamFilter = 'both' | 'home' | 'away';

export function GameLineupsTab({ game }: GameLineupsTabProps) {
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('both');
  const [playerId, setPlayerId] = useState<string>('all');

  const allUnits = useMemo(() => deriveAggregatedLineupUnits(game), [game]);

  const playerOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const u of allUnits) {
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
  }, [allUnits, game]);

  const views = useMemo(() => {
    const filtered = filterAggregatedLineupUnits(allUnits, {
      team: teamFilter,
      playerId: playerId === 'all' ? null : playerId,
    });
    return toLineupUnitViews(game, filtered);
  }, [allUnits, game, teamFilter, playerId]);

  const homeAbbr = game.homeTeam.abbreviation || game.homeTeam.name;
  const awayAbbr = game.awayTeam.abbreviation || game.awayTeam.name;

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
              Includes player
            </Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger id="lineup-player-filter">
                <SelectValue placeholder="All players" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All players</SelectItem>
                {playerOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    #{p.number} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <TableHead className="text-right w-20">Min</TableHead>
                <TableHead className="text-right w-20">+/-</TableHead>
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
