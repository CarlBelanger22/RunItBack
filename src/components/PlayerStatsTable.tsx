import React, { useRef, useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, Target, TrendingUp } from 'lucide-react';
import { MetricsCalculator } from './MetricsCalculator';
import {
  defaultSortOrderForField,
  sortPlayerSeasonRows,
  type PlayerSeasonRow,
  type PlayerStatsSortField,
  type ShotDataCoverage,
  type FoulStatCoverage,
} from '../utils/playerSeasonStats';
import { formatDecimalMinutes } from '../utils/formatMinutes';
import { OptionalStatText, StatTooltipHead } from './StatDisplay';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type StatsView = 'standard' | 'advanced';

const COLUMN_TOOLTIPS: Record<string, string> = {
  '#': 'Row number for the current sort order',
  Tournament: 'Tournament name',
  Scope: 'Tournament or summary scope',
  Player: 'Player name',
  Team: 'Team abbreviation',
  Position: 'Primary position',
  GP: 'Games played',
  MPG: 'Minutes per game (MM:SS)',
  PPG: 'Points per game',
  RPG: 'Rebounds per game',
  APG: 'Assists per game',
  SPG: 'Steals per game',
  BPG: 'Blocks per game',
  'FG%': 'Field goal percentage',
  FGM: 'Field goals made per game',
  FGA: 'Field goal attempts per game',
  '3P%': 'Three-point percentage',
  '3PM': 'Three-pointers made per game',
  '3PA': 'Three-point attempts per game',
  'FT%': 'Free throw percentage',
  FTM: 'Free throws made per game',
  FTA: 'Free throw attempts per game',
  TOPG: 'Turnovers per game',
  FPG: 'Personal fouls per game',
  '+/-': 'Plus/minus per game',
  GmSc: 'Game score per game (Hollinger formula)',
  EFF: 'Efficiency rating per game',
  FG: 'Total field goals made/attempted (season)',
  '3PT': 'Total three-pointers made/attempted (season)',
  FT: 'Total free throws made/attempted (season)',
  ORPG: 'Offensive rebounds per game',
  FDPG: 'Fouls drawn per game',
  Paint: 'Points in the paint per game',
  FB: 'Fast break points per game',
  BlocksAgainst: 'Blocks against per game',
  TFPG: 'Technical fouls per game',
  UFPG: 'Unsportsmanlike fouls per game',
};

const STANDARD_SORT_FIELDS = new Set<PlayerStatsSortField>([
  'Scope',
  'Player',
  'Team',
  'Position',
  'GP',
  'MPG',
  'PPG',
  'RPG',
  'APG',
  'SPG',
  'BPG',
  'FG%',
  'FGM',
  'FGA',
  '3P%',
  '3PM',
  '3PA',
  'FT%',
  'FTM',
  'FTA',
  'TOPG',
  'FPG',
  '+/-',
  'GmSc',
  'EFF',
]);

const ADVANCED_SORT_FIELDS = new Set<PlayerStatsSortField>([
  'Scope',
  'Player',
  'Team',
  'Position',
  'GP',
  'MPG',
  'FG',
  '3PT',
  'FT',
  'ORPG',
  'FDPG',
  'Paint',
  'FB',
  'BlocksAgainst',
  'TFPG',
  'UFPG',
]);

interface PlayerStatsTableProps {
  rows: PlayerSeasonRow[];
  layout?: 'roster' | 'tournament-breakdown';
  showTeamColumn?: boolean;
  shotDataCoverage?: ShotDataCoverage;
  foulStatCoverage?: FoulStatCoverage;
  disableRowNavigation?: boolean;
  defaultSortField?: PlayerStatsSortField;
  defaultSortOrder?: 'asc' | 'desc';
  onNavigateToPlayer?: (playerId: string, teamId: string) => void;
  onNavigateToTournament?: (tournamentId: string) => void;
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
  tooltip,
  warningTooltip,
}: {
  label: React.ReactNode;
  field: PlayerStatsSortField;
  sortField: PlayerStatsSortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: PlayerStatsSortField) => void;
  className?: string;
  center?: boolean;
  tooltip?: string;
  warningTooltip?: string;
}) {
  const active = sortField === field;
  const hint = tooltip ?? COLUMN_TOOLTIPS[field];
  const labelNode =
    hint && typeof label === 'string' ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">{label}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{hint}</TooltipContent>
      </Tooltip>
    ) : (
      label
    );

  return (
    <TableHead
      className={`cursor-pointer select-none ${active ? 'bg-muted/50' : ''} ${className}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${center ? 'justify-center' : ''}`}>
        {labelNode}
        {warningTooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle
                className="w-3 h-3 text-amber-500 shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{warningTooltip}</TooltipContent>
          </Tooltip>
        )}
        <SortIcon field={field} sortField={sortField} sortOrder={sortOrder} />
      </div>
    </TableHead>
  );
}

function madeAttempted(made: number, attempted: number): string {
  return `${made}/${attempted}`;
}

export function PlayerStatsTable({
  rows,
  layout = 'roster',
  showTeamColumn = true,
  shotDataCoverage,
  foulStatCoverage,
  disableRowNavigation = false,
  defaultSortField,
  defaultSortOrder,
  onNavigateToPlayer,
  onNavigateToTournament,
}: PlayerStatsTableProps) {
  const isBreakdown = layout === 'tournament-breakdown';
  const initialSortField =
    defaultSortField ?? (isBreakdown ? 'Scope' : 'PPG');
  const initialSortOrder =
    defaultSortOrder ?? defaultSortOrderForField(initialSortField);

  const [view, setView] = useState<StatsView>('standard');
  const [sortField, setSortField] = useState<PlayerStatsSortField>(initialSortField);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const partialShotTooltip =
    shotDataCoverage?.isPartial
      ? `Averages use only games with shot chart data (${shotDataCoverage.gamesWithShotData} of ${shotDataCoverage.gamesTotal} games in this view).`
      : undefined;

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

  const switchView = useCallback(
    (next: StatsView) => {
      setView(next);
      const allowed = next === 'standard' ? STANDARD_SORT_FIELDS : ADVANCED_SORT_FIELDS;
      if (!allowed.has(sortField)) {
        setSortField(next === 'standard' ? (isBreakdown ? 'Scope' : 'PPG') : 'FG');
        setSortOrder('desc');
      }
    },
    [sortField, isBreakdown]
  );

  const cellHighlight = (field: PlayerStatsSortField) =>
    sortField === field ? 'bg-muted/50' : '';

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          variant={view === 'standard' ? 'default' : 'outline'}
          size="sm"
          onClick={() => switchView('standard')}
        >
          <Target className="w-4 h-4 mr-2" />
          Standard
        </Button>
        <Button
          variant={view === 'advanced' ? 'default' : 'outline'}
          size="sm"
          onClick={() => switchView('advanced')}
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Advanced
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div
            ref={tableContainerRef}
            className="overflow-x-auto max-h-[80vh] overflow-y-auto"
          >
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  {!isBreakdown && (
                    <StatTooltipHead
                      label="#"
                      tooltip={COLUMN_TOOLTIPS['#']}
                      className="w-12 text-center"
                    />
                  )}
                  {isBreakdown ? (
                    <SortableHead
                      label="Tournament"
                      field="Scope"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  ) : (
                    <SortableHead
                      label="Player"
                      field="Player"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  )}
                  {!isBreakdown && showTeamColumn && (
                    <SortableHead
                      label="Team"
                      field="Team"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      className="w-16"
                    />
                  )}
                  {!isBreakdown && (
                    <SortableHead
                      label="Pos"
                      field="Position"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  )}
                  <SortableHead
                    label="GP"
                    field="GP"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    center
                    className="text-center"
                  />
                  <SortableHead
                    label="MPG"
                    field="MPG"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    center
                    className="text-center"
                  />

                  {view === 'standard' ? (
                    <>
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
                      <SortableHead label="TOPG" field="TOPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                      <SortableHead label="FPG" field="FPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                      <SortableHead label="+/-" field="+/-" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                      <SortableHead label="GmSc" field="GmSc" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                      <SortableHead label="EFF" field="EFF" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                    </>
                  ) : (
                    <>
                      <SortableHead label="FG" field="FG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                      <SortableHead label="3PT" field="3PT" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                      <SortableHead label="FT" field="FT" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                      <SortableHead label="ORPG" field="ORPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                      <SortableHead label="FDPG" field="FDPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                      <SortableHead
                        label="Paint"
                        field="Paint"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        center
                        className="text-center"
                        warningTooltip={partialShotTooltip}
                      />
                      <SortableHead
                        label="FB"
                        field="FB"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        center
                        className="text-center"
                        warningTooltip={partialShotTooltip}
                      />
                      <SortableHead
                        label="BA"
                        field="BlocksAgainst"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        center
                        className="text-center"
                      />
                      <SortableHead label="TF" field="TFPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                      <SortableHead label="UF" field="UFPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} center className="text-center" />
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((playerData, index) => {
                  const { totalStats, gamesPlayed } = playerData;
                  const rowKey = playerData.scopeId ?? playerData.player.id;
                  const isSummaryRow = playerData.isSummaryRow === true;
                  const mpg =
                    gamesPlayed > 0 ? totalStats.minutes_played / gamesPlayed : 0;
                  const paintPg =
                    playerData.gamesWithShotData > 0
                      ? playerData.paintPointsTotal / playerData.gamesWithShotData
                      : null;
                  const fbPg =
                    playerData.gamesWithShotData > 0
                      ? playerData.fastbreakPointsTotal / playerData.gamesWithShotData
                      : null;
                  const blocksAgainstPg =
                    foulStatCoverage?.blocksAgainst && gamesPlayed > 0
                      ? totalStats.blocks_received / gamesPlayed
                      : null;
                  const tfPg =
                    foulStatCoverage?.techFouls && gamesPlayed > 0
                      ? totalStats.tech_fouls / gamesPlayed
                      : null;
                  const ufPg =
                    foulStatCoverage?.unsportsmanlikeFouls && gamesPlayed > 0
                      ? totalStats.unsportsmanlike_fouls / gamesPlayed
                      : null;

                  return (
                    <TableRow
                      key={rowKey}
                      className={`hover:bg-muted/50 ${
                        isSummaryRow ? 'border-t-2 bg-muted/20 font-medium' : ''
                      }`}
                    >
                      {!isBreakdown && (
                        <TableCell className="text-center">{index + 1}</TableCell>
                      )}
                      {isBreakdown ? (
                        <TableCell
                          className={`font-medium ${cellHighlight('Scope')} ${
                            isSummaryRow ? 'font-bold' : ''
                          }`}
                        >
                          {!isSummaryRow &&
                          playerData.scopeId &&
                          playerData.scopeId !== 'no-tournament' &&
                          onNavigateToTournament ? (
                            <button
                              type="button"
                              className="text-left hover:text-primary hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToTournament(playerData.scopeId!);
                              }}
                            >
                              {playerData.scopeLabel ?? '—'}
                            </button>
                          ) : (
                            playerData.scopeLabel ?? '—'
                          )}
                        </TableCell>
                      ) : (
                        <TableCell
                          className={`font-medium ${
                            disableRowNavigation
                              ? ''
                              : 'cursor-pointer hover:text-primary'
                          } ${cellHighlight('Player')}`}
                          onClick={() => {
                            if (!disableRowNavigation && onNavigateToPlayer) {
                              onNavigateToPlayer(
                                playerData.player.id,
                                playerData.team.id
                              );
                            }
                          }}
                        >
                          {playerData.player.name}
                        </TableCell>
                      )}
                      {!isBreakdown && showTeamColumn && (
                        <TableCell className={cellHighlight('Team')}>
                          {playerData.team.abbreviation}
                        </TableCell>
                      )}
                      {!isBreakdown && (
                        <TableCell className={cellHighlight('Position')}>
                          {playerData.player.position}
                        </TableCell>
                      )}
                      <TableCell
                        className={`text-center ${cellHighlight('GP')} ${
                          isSummaryRow ? 'font-bold' : ''
                        }`}
                      >
                        {gamesPlayed}
                      </TableCell>
                      <TableCell
                        className={`text-center font-mono tabular-nums ${cellHighlight('MPG')}`}
                      >
                        {formatDecimalMinutes(mpg)}
                      </TableCell>

                      {view === 'standard' ? (
                        <>
                          <StandardStatCells
                            playerData={playerData}
                            cellHighlight={cellHighlight}
                          />
                        </>
                      ) : (
                        <>
                          <TableCell
                            className={`text-center font-mono tabular-nums ${cellHighlight('FG')}`}
                          >
                            {madeAttempted(totalStats.fg_made, totalStats.fg_attempted)}
                          </TableCell>
                          <TableCell
                            className={`text-center font-mono tabular-nums ${cellHighlight('3PT')}`}
                          >
                            {madeAttempted(totalStats.three_made, totalStats.three_attempted)}
                          </TableCell>
                          <TableCell
                            className={`text-center font-mono tabular-nums ${cellHighlight('FT')}`}
                          >
                            {madeAttempted(totalStats.ft_made, totalStats.ft_attempted)}
                          </TableCell>
                          <TableCell className={`text-center ${cellHighlight('ORPG')}`}>
                            {gamesPlayed > 0
                              ? (totalStats.orb / gamesPlayed).toFixed(1)
                              : '0.0'}
                          </TableCell>
                          <TableCell className={`text-center ${cellHighlight('FDPG')}`}>
                            {gamesPlayed > 0
                              ? (totalStats.fouls_drawn / gamesPlayed).toFixed(1)
                              : '0.0'}
                          </TableCell>
                          <TableCell className={`text-center ${cellHighlight('Paint')}`}>
                            <OptionalStatText value={paintPg} decimals={1} />
                          </TableCell>
                          <TableCell className={`text-center ${cellHighlight('FB')}`}>
                            <OptionalStatText value={fbPg} decimals={1} />
                          </TableCell>
                          <TableCell className={`text-center ${cellHighlight('BlocksAgainst')}`}>
                            <OptionalStatText value={blocksAgainstPg} decimals={1} />
                          </TableCell>
                          <TableCell className={`text-center ${cellHighlight('TFPG')}`}>
                            <OptionalStatText value={tfPg} decimals={1} />
                          </TableCell>
                          <TableCell className={`text-center ${cellHighlight('UFPG')}`}>
                            <OptionalStatText value={ufPg} decimals={1} />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StandardStatCells({
  playerData,
  cellHighlight,
}: {
  playerData: PlayerSeasonRow;
  cellHighlight: (field: PlayerStatsSortField) => string;
}) {
  const { totalStats, gamesPlayed } = playerData;

  const ppg = gamesPlayed > 0 ? totalStats.points / gamesPlayed : 0;
  const rpg =
    gamesPlayed > 0 ? (totalStats.orb + totalStats.drb) / gamesPlayed : 0;
  const apg = gamesPlayed > 0 ? totalStats.assists / gamesPlayed : 0;
  const spg = gamesPlayed > 0 ? totalStats.steals / gamesPlayed : 0;
  const bpg = gamesPlayed > 0 ? totalStats.blocks / gamesPlayed : 0;
  const fgPct =
    totalStats.fg_attempted > 0
      ? (totalStats.fg_made / totalStats.fg_attempted) * 100
      : 0;
  const fgm = gamesPlayed > 0 ? totalStats.fg_made / gamesPlayed : 0;
  const fga = gamesPlayed > 0 ? totalStats.fg_attempted / gamesPlayed : 0;
  const threePct =
    totalStats.three_attempted > 0
      ? (totalStats.three_made / totalStats.three_attempted) * 100
      : 0;
  const threePm = gamesPlayed > 0 ? totalStats.three_made / gamesPlayed : 0;
  const threePa = gamesPlayed > 0 ? totalStats.three_attempted / gamesPlayed : 0;
  const ftPct =
    totalStats.ft_attempted > 0
      ? (totalStats.ft_made / totalStats.ft_attempted) * 100
      : 0;
  const ftm = gamesPlayed > 0 ? totalStats.ft_made / gamesPlayed : 0;
  const fta = gamesPlayed > 0 ? totalStats.ft_attempted / gamesPlayed : 0;
  const topg = gamesPlayed > 0 ? totalStats.turnovers / gamesPlayed : 0;
  const fpg = gamesPlayed > 0 ? totalStats.fouls / gamesPlayed : 0;
  const plusMinus = gamesPlayed > 0 ? totalStats.plus_minus / gamesPlayed : 0;
  const eff = MetricsCalculator.calculateEfficiency(totalStats);
  const effPg = gamesPlayed > 0 ? eff / gamesPlayed : 0;
  const gameSc = MetricsCalculator.calculateGameScore(totalStats);
  const gameScPg = gamesPlayed > 0 ? gameSc / gamesPlayed : 0;

  return (
    <>
      <TableCell className={`text-center ${cellHighlight('PPG')}`}>{ppg.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('RPG')}`}>{rpg.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('APG')}`}>{apg.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('SPG')}`}>{spg.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('BPG')}`}>{bpg.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('FG%')}`}>{fgPct.toFixed(1)}%</TableCell>
      <TableCell className={`text-center ${cellHighlight('FGM')}`}>{fgm.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('FGA')}`}>{fga.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('3P%')}`}>{threePct.toFixed(1)}%</TableCell>
      <TableCell className={`text-center ${cellHighlight('3PM')}`}>{threePm.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('3PA')}`}>{threePa.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('FT%')}`}>{ftPct.toFixed(1)}%</TableCell>
      <TableCell className={`text-center ${cellHighlight('FTM')}`}>{ftm.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('FTA')}`}>{fta.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('TOPG')}`}>{topg.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('FPG')}`}>{fpg.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('+/-')}`}>
        <span className={plusMinus >= 0 ? 'text-green-600' : 'text-red-600'}>
          {plusMinus >= 0 ? '+' : ''}
          {plusMinus.toFixed(1)}
        </span>
      </TableCell>
      <TableCell className={`text-center ${cellHighlight('GmSc')}`}>{gameScPg.toFixed(1)}</TableCell>
      <TableCell className={`text-center ${cellHighlight('EFF')}`}>{effPg.toFixed(1)}</TableCell>
    </>
  );
}
