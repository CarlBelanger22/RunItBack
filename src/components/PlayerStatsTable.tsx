import React, { useRef, useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertTriangle,
  Download,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  defaultSortOrderForField,
  sortPlayerSeasonRows,
  type PlayerSeasonRow,
  type PlayerStatsSortField,
  type ShotDataCoverage,
  type FoulStatCoverage,
} from '../utils/playerSeasonStats';
import { formatDecimalMinutes } from '../utils/formatMinutes';
import { getTeamStatsAbbreviation } from '../utils/teamAbbreviation';
import type { Team } from '../App';
import { NoStatRecorded, StatTooltipHead } from './StatDisplay';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { STANDARD_SHOOTING_STAT_FIELDS } from '../utils/shootingStatColumns';
import { PLAYER_STATS_COLUMN_TOOLTIPS } from '../utils/playerStatsGlossary';
import {
  ADVANCED_PLAYER_STATS_FIELDS,
  NO_STAT_RECORDED_VALUE,
  STANDARD_PLAYER_STATS_FIELDS,
  formatAdvancedPlayerStatsRow,
  formatStandardPlayerStatsRow,
} from '../utils/playerStatsDisplay';

type StatsView = 'standard' | 'advanced';

const COLUMN_TOOLTIPS = PLAYER_STATS_COLUMN_TOOLTIPS;

const STANDARD_SORT_FIELDS = new Set<PlayerStatsSortField>([
  'Scope',
  'Player',
  'Team',
  'Age',
  'Position',
  'GP',
  'MPG',
  'PPG',
  'RPG',
  'APG',
  'SPG',
  'BPG',
  ...STANDARD_SHOOTING_STAT_FIELDS,
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
  'Age',
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
  showAgeColumn?: boolean;
  shotDataCoverage?: ShotDataCoverage;
  foulStatCoverage?: FoulStatCoverage;
  disableRowNavigation?: boolean;
  defaultSortField?: PlayerStatsSortField;
  defaultSortOrder?: 'asc' | 'desc';
  onNavigateToPlayer?: (playerId: string, teamId: string) => void;
  onNavigateToTournament?: (tournamentId: string) => void;
  onNavigateToTeam?: (teamId: string) => void;
  /** Full league teams for unique stats-table abbreviations when many share "TST". */
  teams?: Team[];
  onExportPdf?: () => void;
  exportDisabled?: boolean;
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
  activeSortFields,
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
  activeSortFields: Set<PlayerStatsSortField>;
  className?: string;
  center?: boolean;
  tooltip?: string;
  warningTooltip?: string;
}) {
  const active = sortField === field && activeSortFields.has(field);
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

const tableLinkButtonClass =
  'text-sm font-normal text-left hover:text-primary hover:underline cursor-pointer';

const numericCellClass = 'text-center text-sm font-mono tabular-nums';

export function PlayerStatsTable({
  rows,
  layout = 'roster',
  showTeamColumn = true,
  showAgeColumn = false,
  shotDataCoverage,
  foulStatCoverage,
  disableRowNavigation = false,
  defaultSortField,
  defaultSortOrder,
  onNavigateToPlayer,
  onNavigateToTournament,
  onNavigateToTeam,
  teams: leagueTeamsProp,
  onExportPdf,
  exportDisabled = false,
}: PlayerStatsTableProps) {
  const isBreakdown = layout === 'tournament-breakdown';
  const leagueTeamsForAbbrev = useMemo(
    () => leagueTeamsProp ?? rows.map((row) => row.team),
    [leagueTeamsProp, rows]
  );
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

  const switchView = useCallback((next: StatsView) => {
    setView(next);
  }, []);

  const activeSortFields =
    view === 'standard' ? STANDARD_SORT_FIELDS : ADVANCED_SORT_FIELDS;

  const isActiveSortField = (field: PlayerStatsSortField) =>
    sortField === field && activeSortFields.has(field);

  const cellHighlight = (field: PlayerStatsSortField) =>
    isActiveSortField(field) ? 'bg-muted/50' : '';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
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
        {onExportPdf && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportPdf}
            disabled={exportDisabled}
            title="Export player stats PDF"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        )}
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
                      activeSortFields={activeSortFields}
                    />
                  ) : (
                    <SortableHead
                      label="Player"
                      field="Player"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      activeSortFields={activeSortFields}
                    />
                  )}
                  {showTeamColumn && (
                    <SortableHead
                      label="Team"
                      field="Team"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      activeSortFields={activeSortFields}
                      className="w-16"
                    />
                  )}
                  {isBreakdown && showAgeColumn && (
                    <SortableHead
                      label="Age"
                      field="Age"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      activeSortFields={activeSortFields}
                      center
                      className="text-center w-12"
                      tooltip={COLUMN_TOOLTIPS.Age}
                    />
                  )}
                  {!isBreakdown && (
                    <SortableHead
                      label="Pos"
                      field="Position"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      activeSortFields={activeSortFields}
                    />
                  )}
                  <SortableHead
                    label="GP"
                    field="GP"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    activeSortFields={activeSortFields}
                    center
                    className="text-center"
                  />
                  <SortableHead
                    label="MPG"
                    field="MPG"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    activeSortFields={activeSortFields}
                    center
                    className="text-center"
                  />

                  {view === 'standard' ? (
                    <>
                      <SortableHead label="PPG" field="PPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="RPG" field="RPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="APG" field="APG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="SPG" field="SPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="BPG" field="BPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      {STANDARD_SHOOTING_STAT_FIELDS.map((field) => (
                        <SortableHead
                          key={field}
                          label={field}
                          field={field}
                          sortField={sortField}
                          sortOrder={sortOrder}
                          onSort={handleSort}
                          activeSortFields={activeSortFields}
                          center
                          className="text-center"
                        />
                      ))}
                      <SortableHead label="TOPG" field="TOPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="FPG" field="FPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="+/-" field="+/-" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="GmSc" field="GmSc" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="EFF" field="EFF" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                    </>
                  ) : (
                    <>
                      <SortableHead label="FG" field="FG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="3PT" field="3PT" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="FT" field="FT" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="ORPG" field="ORPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="FDPG" field="FDPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead
                        label="Paint"
                        field="Paint"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        activeSortFields={activeSortFields}
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
                        activeSortFields={activeSortFields}
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
                        activeSortFields={activeSortFields}
                        center
                        className="text-center"
                      />
                      <SortableHead label="TF" field="TFPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                      <SortableHead label="UF" field="UFPG" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} activeSortFields={activeSortFields} center className="text-center" />
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((playerData, index) => {
                  const { gamesPlayed } = playerData;
                  const rowKey = playerData.scopeId ?? playerData.player.id;
                  const isSummaryRow = playerData.isSummaryRow === true;
                  const mpg =
                    gamesPlayed > 0
                      ? playerData.totalStats.minutes_played / gamesPlayed
                      : 0;

                  return (
                    <TableRow
                      key={rowKey}
                      className={
                        isSummaryRow
                          ? 'border-t-2 border-border bg-muted/40 hover:bg-muted/40'
                          : 'hover:bg-muted/50'
                      }
                    >
                      {!isBreakdown && (
                        <TableCell className="text-center text-sm">{index + 1}</TableCell>
                      )}
                      {isBreakdown ? (
                        <TableCell
                          className={`text-sm ${cellHighlight('Scope')} ${
                            isSummaryRow ? 'font-semibold' : ''
                          }`}
                        >
                          {!isSummaryRow &&
                          playerData.scopeId &&
                          playerData.scopeId !== 'no-tournament' &&
                          onNavigateToTournament ? (
                            <button
                              type="button"
                              className={tableLinkButtonClass}
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToTournament(playerData.scopeId!);
                              }}
                            >
                              {playerData.scopeLabel ?? '?'}
                            </button>
                          ) : (
                            playerData.scopeLabel ?? '?'
                          )}
                        </TableCell>
                      ) : (
                        <TableCell
                          className={`text-sm ${
                            disableRowNavigation
                              ? ''
                              : 'cursor-pointer hover:text-primary'
                          } ${cellHighlight('Player')} ${
                            playerData.isSummaryRow ? 'font-semibold' : ''
                          }`}
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
                      {showTeamColumn && (
                        <TableCell className={`text-sm ${cellHighlight('Team')}`}>
                          {isSummaryRow || !playerData.team.id ? (
                            '-'
                          ) : onNavigateToTeam ? (
                            <button
                              type="button"
                              className={tableLinkButtonClass}
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToTeam(playerData.team.id);
                              }}
                            >
                              {getTeamStatsAbbreviation(
                                playerData.team,
                                leagueTeamsForAbbrev
                              )}
                            </button>
                          ) : (
                            getTeamStatsAbbreviation(
                              playerData.team,
                              leagueTeamsForAbbrev
                            )
                          )}
                        </TableCell>
                      )}
                      {isBreakdown && showAgeColumn && (
                        <TableCell
                          className={`text-sm text-center ${cellHighlight('Age')}`}
                        >
                          {playerData.ageAtScope ?? '-'}
                        </TableCell>
                      )}
                      {!isBreakdown && (
                        <TableCell className={`text-sm ${cellHighlight('Position')}`}>
                          {playerData.player.position}
                        </TableCell>
                      )}
                      <TableCell
                        className={`${numericCellClass} ${cellHighlight('GP')} ${
                          isSummaryRow ? 'font-semibold' : ''
                        }`}
                      >
                        {gamesPlayed}
                      </TableCell>
                      <TableCell
                        className={`${numericCellClass} ${cellHighlight('MPG')}`}
                      >
                        {formatDecimalMinutes(mpg)}
                      </TableCell>

                      {view === 'standard' ? (
                        <StandardStatCells
                          playerData={playerData}
                          cellHighlight={cellHighlight}
                        />
                      ) : (
                        <AdvancedStatCells
                          playerData={playerData}
                          cellHighlight={cellHighlight}
                          foulStatCoverage={foulStatCoverage}
                        />
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
  const values = formatStandardPlayerStatsRow(playerData);

  return (
    <>
      {STANDARD_PLAYER_STATS_FIELDS.map((field, index) => {
        const value = values[index] ?? '';
        return (
          <TableCell
            key={field}
            className={`${numericCellClass} ${cellHighlight(field)}`}
          >
            {value === NO_STAT_RECORDED_VALUE ? (
              <NoStatRecorded />
            ) : field === '+/-' ? (
              <span
                className={
                  value.startsWith('+') ? 'text-green-600' : 'text-red-600'
                }
              >
                {value}
              </span>
            ) : (
              value
            )}
          </TableCell>
        );
      })}
    </>
  );
}

function AdvancedStatCells({
  playerData,
  cellHighlight,
  foulStatCoverage,
}: {
  playerData: PlayerSeasonRow;
  cellHighlight: (field: PlayerStatsSortField) => string;
  foulStatCoverage?: FoulStatCoverage;
}) {
  const values = formatAdvancedPlayerStatsRow(playerData, foulStatCoverage);

  return (
    <>
      {ADVANCED_PLAYER_STATS_FIELDS.map((field, index) => {
        const value = values[index] ?? '';
        return (
          <TableCell
            key={field}
            className={`${numericCellClass} ${cellHighlight(field)}`}
          >
            {value === NO_STAT_RECORDED_VALUE ? (
              <NoStatRecorded />
            ) : (
              value
            )}
          </TableCell>
        );
      })}
    </>
  );
}
