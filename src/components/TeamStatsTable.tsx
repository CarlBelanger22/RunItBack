import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Shield,
  Target,
  TrendingUp,
} from 'lucide-react';
import { TeamBadge } from './TeamBadge';
import { NoStatRecorded } from './StatDisplay';
import {
  ADVANCED_TOURNAMENT_TEAM_STATS_FIELDS,
  DEFENSIVE_TOURNAMENT_TEAM_STATS_FIELDS,
  STANDARD_TOURNAMENT_TEAM_STATS_FIELDS,
  TOURNAMENT_TEAM_STATS_NO_VALUE,
  defaultSortOrderForTeamField,
  formatAdvancedLeagueAverageTournamentTeamStatsRow,
  formatAdvancedTournamentTeamStatsRow,
  formatDefensiveLeagueAverageTournamentTeamStatsRow,
  formatDefensiveTournamentTeamStatsRow,
  formatStandardLeagueAverageTournamentTeamStatsRow,
  formatStandardTournamentTeamStatsRow,
  sortTournamentTeamSeasonRows,
  type TournamentTeamSeasonRow,
  type TournamentTeamStatsSortField,
} from '../utils/tournamentTeamSeasonStats';

type StatsView = 'standard' | 'advanced' | 'defensive';

interface TeamStatsTableProps {
  rows: TournamentTeamSeasonRow[];
  onNavigateToTeam?: (teamId: string) => void;
}

function SortIcon({
  field,
  sortField,
  sortOrder,
}: {
  field: TournamentTeamStatsSortField;
  sortField: TournamentTeamStatsSortField;
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
  field: TournamentTeamStatsSortField;
  sortField: TournamentTeamStatsSortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: TournamentTeamStatsSortField) => void;
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
        <span>{label}</span>
        <SortIcon field={field} sortField={sortField} sortOrder={sortOrder} />
      </div>
    </TableHead>
  );
}

const numericCellClass = 'text-center text-sm font-mono tabular-nums';
const tableLinkButtonClass =
  'text-sm font-normal text-left hover:text-primary hover:underline cursor-pointer';

function fieldsForView(view: StatsView) {
  if (view === 'standard') return STANDARD_TOURNAMENT_TEAM_STATS_FIELDS;
  if (view === 'advanced') return ADVANCED_TOURNAMENT_TEAM_STATS_FIELDS;
  return DEFENSIVE_TOURNAMENT_TEAM_STATS_FIELDS;
}

function formatRowForView(view: StatsView, row: TournamentTeamSeasonRow): string[] {
  if (view === 'standard') return formatStandardTournamentTeamStatsRow(row);
  if (view === 'advanced') return formatAdvancedTournamentTeamStatsRow(row);
  return formatDefensiveTournamentTeamStatsRow(row);
}

function formatLeagueAverageForView(
  view: StatsView,
  rows: TournamentTeamSeasonRow[]
): string[] {
  if (view === 'standard') {
    return formatStandardLeagueAverageTournamentTeamStatsRow(rows);
  }
  if (view === 'advanced') {
    return formatAdvancedLeagueAverageTournamentTeamStatsRow(rows);
  }
  return formatDefensiveLeagueAverageTournamentTeamStatsRow(rows);
}

export function TeamStatsTable({ rows, onNavigateToTeam }: TeamStatsTableProps) {
  const [view, setView] = useState<StatsView>('standard');
  const [sortField, setSortField] = useState<TournamentTeamStatsSortField>('PPG');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const selectView = useCallback((next: StatsView) => {
    setView(next);
    const nextFields = fieldsForView(next);
    setSortField((prev) => {
      if (next === 'defensive') {
        // NBA-like team defense leaderboard feel
        setSortOrder(defaultSortOrderForTeamField('DRtg'));
        return 'DRtg';
      }
      if (prev === 'Team' || (nextFields as readonly string[]).includes(prev)) {
        return prev;
      }
      const fallback: TournamentTeamStatsSortField =
        next === 'standard' ? 'PPG' : 'eFG%';
      setSortOrder(defaultSortOrderForTeamField(fallback));
      return fallback;
    });
  }, []);

  const handleSort = useCallback((field: TournamentTeamStatsSortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder(defaultSortOrderForTeamField(field));
      return field;
    });
  }, []);

  const sorted = useMemo(
    () => sortTournamentTeamSeasonRows(rows, sortField, sortOrder),
    [rows, sortField, sortOrder]
  );

  const leagueAverageValues = useMemo(
    () => formatLeagueAverageForView(view, rows),
    [rows, view]
  );

  const activeFields = fieldsForView(view);

  const cellHighlight = (field: TournamentTeamStatsSortField) =>
    sortField === field ? 'bg-muted/40' : '';

  const renderStatCell = (
    field: (typeof activeFields)[number],
    value: string
  ) => {
    const isDiff = field === 'DIFF';
    if (value === TOURNAMENT_TEAM_STATS_NO_VALUE) {
      return <NoStatRecorded />;
    }
    if (isDiff) {
      return (
        <span
          className={
            value.startsWith('+')
              ? 'text-green-400'
              : value.startsWith('-')
                ? 'text-red-400'
                : undefined
          }
        >
          {value}
        </span>
      );
    }
    return value;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant={view === 'standard' ? 'default' : 'outline'}
          onClick={() => selectView('standard')}
        >
          <Target className="w-3.5 h-3.5 mr-1.5" />
          Standard
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === 'advanced' ? 'default' : 'outline'}
          onClick={() => selectView('advanced')}
        >
          <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
          Advanced
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === 'defensive' ? 'default' : 'outline'}
          onClick={() => selectView('defensive')}
        >
          <Shield className="w-3.5 h-3.5 mr-1.5" />
          Defensive
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Team"
                    field="Team"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    className="sticky left-0 z-10 bg-card min-w-[10rem]"
                  />
                  {activeFields.map((field) => (
                    <SortableHead
                      key={field}
                      label={field}
                      field={field}
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      center
                    />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={1 + activeFields.length}
                      className="text-center text-muted-foreground py-8"
                    >
                      No teams in this tournament yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((row) => {
                    const values = formatRowForView(view, row);
                    return (
                      <TableRow key={row.team.id}>
                        <TableCell
                          className={`sticky left-0 z-10 bg-card ${cellHighlight('Team')}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <TeamBadge team={row.team} teamId={row.team.id} size="sm" />
                            {onNavigateToTeam ? (
                              <button
                                type="button"
                                className={tableLinkButtonClass}
                                onClick={() => onNavigateToTeam(row.team.id)}
                              >
                                {row.team.name}
                              </button>
                            ) : (
                              <span className="text-sm truncate">{row.team.name}</span>
                            )}
                          </div>
                        </TableCell>
                        {activeFields.map((field, index) => (
                          <TableCell
                            key={field}
                            className={`${numericCellClass} ${cellHighlight(field)}`}
                          >
                            {renderStatCell(field, values[index] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {sorted.length > 0 ? (
                <TableFooter>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell className="sticky left-0 z-10 bg-muted min-w-[10rem] font-medium text-sm">
                      League Average
                    </TableCell>
                    {activeFields.map((field, index) => (
                      <TableCell
                        key={field}
                        className={`${numericCellClass} font-medium`}
                      >
                        {renderStatCell(field, leagueAverageValues[index] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
