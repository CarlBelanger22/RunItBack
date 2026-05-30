import React, { useRef, useState, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { MetricsCalculator } from './MetricsCalculator';
import {
  defaultSortOrderForField,
  sortPlayerSeasonRows,
  type PlayerSeasonRow,
  type PlayerStatsSortField,
} from '../utils/playerSeasonStats';

interface PlayerStatsTableProps {
  rows: PlayerSeasonRow[];
  showTeamColumn?: boolean;
  onNavigateToPlayer: (playerId: string, teamId: string) => void;
}

function SortIcon({
  field,
  sortField,
  sortOrder,
}: {
  field: PlayerStatsSortField;
  sortField: PlayerStatsSortField;
  sortOrder: 'asc' | 'desc';
}) {
  if (sortField !== field) {
    return <ChevronsUpDown className="w-3 h-3 text-muted-foreground shrink-0" />;
  }
  return sortOrder === 'asc' ? (
    <ChevronUp className="w-3 h-3 shrink-0" />
  ) : (
    <ChevronDown className="w-3 h-3 shrink-0" />
  );
}

function SortableHead({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
  className = '',
  center = false,
}: {
  label: string;
  field: PlayerStatsSortField;
  sortField: PlayerStatsSortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: PlayerStatsSortField) => void;
  className?: string;
  center?: boolean;
}) {
  const active = sortField === field;
  return (
    <TableHead
      className={`cursor-pointer select-none ${active ? 'bg-muted/50' : ''} ${className}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${center ? 'justify-center' : ''}`}>
        {label}
        <SortIcon field={field} sortField={sortField} sortOrder={sortOrder} />
      </div>
    </TableHead>
  );
}

export function PlayerStatsTable({
  rows,
  showTeamColumn = true,
  onNavigateToPlayer,
}: PlayerStatsTableProps) {
  const [sortField, setSortField] = useState<PlayerStatsSortField>('PPG');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const sortedRows = useMemo(
    () => sortPlayerSeasonRows(rows, sortField, sortOrder),
    [rows, sortField, sortOrder]
  );

  const handleSort = (field: PlayerStatsSortField) => {
    const currentScrollLeft = tableContainerRef.current?.scrollLeft ?? 0;

    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(defaultSortOrderForField(field));
    }

    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollLeft = currentScrollLeft;
      }
    }, 0);
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div
          ref={tableContainerRef}
          className="overflow-x-auto max-h-[80vh] overflow-y-auto"
        >
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <SortableHead
                  label="Player"
                  field="Player"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
                {showTeamColumn && (
                  <SortableHead
                    label="Team"
                    field="Team"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    className="w-16"
                  />
                )}
                <SortableHead
                  label="Pos"
                  field="Position"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHead label="GP" field="GP" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="MPG" field="MPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="PPG" field="PPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="RPG" field="RPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="APG" field="APG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="SPG" field="SPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="BPG" field="BPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="FG%" field="FG%" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="FGM" field="FGM" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="FGA" field="FGA" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="3P%" field="3P%" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="3PM" field="3PM" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="3PA" field="3PA" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="FT%" field="FT%" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="FTM" field="FTM" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="FTA" field="FTA" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="ORPG" field="ORPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="TOPG" field="TOPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="FPG" field="FPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="FDPG" field="FDPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="+/-" field="+/-" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="GmSc" field="GmSc" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                <SortableHead label="EFF" field="EFF" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((playerData, index) => {
                const mpg =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.minutes_played / playerData.gamesPlayed
                    : 0;
                const ppg =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.points / playerData.gamesPlayed
                    : 0;
                const rpg =
                  playerData.gamesPlayed > 0
                    ? (playerData.totalStats.orb + playerData.totalStats.drb) /
                      playerData.gamesPlayed
                    : 0;
                const apg =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.assists / playerData.gamesPlayed
                    : 0;
                const spg =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.steals / playerData.gamesPlayed
                    : 0;
                const bpg =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.blocks / playerData.gamesPlayed
                    : 0;
                const fgPct =
                  playerData.totalStats.fg_attempted > 0
                    ? (playerData.totalStats.fg_made /
                        playerData.totalStats.fg_attempted) *
                      100
                    : 0;
                const fgm =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.fg_made / playerData.gamesPlayed
                    : 0;
                const fga =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.fg_attempted / playerData.gamesPlayed
                    : 0;
                const threePct =
                  playerData.totalStats.three_attempted > 0
                    ? (playerData.totalStats.three_made /
                        playerData.totalStats.three_attempted) *
                      100
                    : 0;
                const threePm =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.three_made / playerData.gamesPlayed
                    : 0;
                const threePa =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.three_attempted / playerData.gamesPlayed
                    : 0;
                const ftPct =
                  playerData.totalStats.ft_attempted > 0
                    ? (playerData.totalStats.ft_made /
                        playerData.totalStats.ft_attempted) *
                      100
                    : 0;
                const ftm =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.ft_made / playerData.gamesPlayed
                    : 0;
                const fta =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.ft_attempted / playerData.gamesPlayed
                    : 0;
                const orpg =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.orb / playerData.gamesPlayed
                    : 0;
                const topg =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.turnovers / playerData.gamesPlayed
                    : 0;
                const fpg =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.fouls / playerData.gamesPlayed
                    : 0;
                const fdpg =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.fouls_drawn / playerData.gamesPlayed
                    : 0;
                const plusMinus =
                  playerData.gamesPlayed > 0
                    ? playerData.totalStats.plus_minus / playerData.gamesPlayed
                    : 0;
                const eff = MetricsCalculator.calculateEfficiency(playerData.totalStats);
                const effPg =
                  playerData.gamesPlayed > 0 ? eff / playerData.gamesPlayed : 0;
                const gameSc = MetricsCalculator.calculateGameScore(playerData.totalStats);
                const gameScPg =
                  playerData.gamesPlayed > 0 ? gameSc / playerData.gamesPlayed : 0;

                const cellHighlight = (field: PlayerStatsSortField) =>
                  sortField === field ? 'bg-muted/50' : '';

                return (
                  <TableRow key={playerData.player.id} className="hover:bg-muted/50">
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell
                      className={`font-medium cursor-pointer hover:text-primary ${cellHighlight('Player')}`}
                      onClick={() =>
                        onNavigateToPlayer(playerData.player.id, playerData.team.id)
                      }
                    >
                      {playerData.player.name}
                    </TableCell>
                    {showTeamColumn && (
                      <TableCell className={cellHighlight('Team')}>
                        {playerData.team.abbreviation}
                      </TableCell>
                    )}
                    <TableCell className={cellHighlight('Position')}>
                      {playerData.player.position}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('GP')}`}>
                      {playerData.gamesPlayed}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('MPG')}`}>
                      {mpg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('PPG')}`}>
                      {ppg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('RPG')}`}>
                      {rpg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('APG')}`}>
                      {apg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('SPG')}`}>
                      {spg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('BPG')}`}>
                      {bpg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('FG%')}`}>
                      {fgPct.toFixed(1)}%
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('FGM')}`}>
                      {fgm.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('FGA')}`}>
                      {fga.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('3P%')}`}>
                      {threePct.toFixed(1)}%
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('3PM')}`}>
                      {threePm.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('3PA')}`}>
                      {threePa.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('FT%')}`}>
                      {ftPct.toFixed(1)}%
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('FTM')}`}>
                      {ftm.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('FTA')}`}>
                      {fta.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('ORPG')}`}>
                      {orpg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('TOPG')}`}>
                      {topg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('FPG')}`}>
                      {fpg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('FDPG')}`}>
                      {fdpg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('+/-')}`}>
                      <span
                        className={
                          plusMinus >= 0 ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {plusMinus >= 0 ? '+' : ''}
                        {plusMinus.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('GmSc')}`}>
                      {gameScPg.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center ${cellHighlight('EFF')}`}>
                      {effPg.toFixed(1)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
