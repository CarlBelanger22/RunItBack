import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import type { Game, Tournament } from '../App';
import { buildGameReportModel } from '../utils/gameReportModel';
import { buildGameComparisonVisualModel } from '../utils/gameComparisonVisualModel';
import {
  buildGameHeadToHeadModel,
  transposeQuarterRows,
} from '../utils/gameHeadToHeadModel';
import { ShootingComparisonSection } from './ShootingComparisonSection';
import { TeamStatsComparisonSection } from './TeamStatsComparisonSection';
import { PlayerHeadToHeadSection } from './PlayerHeadToHeadSection';

interface GameReportOverviewProps {
  game: Game;
  tournaments: Tournament[];
  onNavigateToPlayer?: (playerId: string, teamId: string) => void;
}

function TransposedQuarterScoringTable({
  homeHeader,
  awayHeader,
  rows,
}: {
  homeHeader: string;
  awayHeader: string;
  rows: { label: string; home: string; away: string }[];
}) {
  const table = useMemo(
    () => transposeQuarterRows(rows, homeHeader, awayHeader),
    [rows, homeHeader, awayHeader]
  );

  return (
    <Card className="game-report-right-card shadow-lg rounded-2xl">
      <CardContent className="flex flex-1 items-center justify-center px-4 py-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              {table.periodHeaders.map((period) => (
                <TableHead key={period} className="text-center text-sm">
                  {period}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium text-sm text-blue-600 dark:text-blue-400">
                {table.homeRow.label}
              </TableCell>
              {table.homeRow.scores.map((score, index) => (
                <TableCell
                  key={`home-${table.periodHeaders[index]}`}
                  className="text-center font-mono text-sm tabular-nums"
                >
                  {score}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-sm text-amber-600 dark:text-amber-400">
                {table.awayRow.label}
              </TableCell>
              {table.awayRow.scores.map((score, index) => (
                <TableCell
                  key={`away-${table.periodHeaders[index]}`}
                  className="text-center font-mono text-sm tabular-nums"
                >
                  {score}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function GameReportOverview({
  game,
  tournaments,
  onNavigateToPlayer,
}: GameReportOverviewProps) {
  const reportModel = useMemo(
    () => buildGameReportModel(game, tournaments),
    [game, tournaments]
  );

  const visualModel = useMemo(() => buildGameComparisonVisualModel(game), [game]);

  const headToHeadModel = useMemo(() => buildGameHeadToHeadModel(game), [game]);

  return (
    <div className="space-y-4">
      <div className="grid w-full grid-cols-1 items-stretch gap-4 md:grid-cols-2">
        <Card className="h-full shadow-lg rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Shooting</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <ShootingComparisonSection
              rows={visualModel.shooting}
              homeAbbr={visualModel.homeAbbr}
              awayAbbr={visualModel.awayAbbr}
            />
          </CardContent>
        </Card>

        <div className="game-report-right-stack flex h-full flex-col gap-4">
          <TransposedQuarterScoringTable
            homeHeader={reportModel.homeAbbr}
            awayHeader={reportModel.awayAbbr}
            rows={reportModel.quarterRows}
          />

          <Card className="game-report-right-card shadow-lg rounded-2xl">
            <CardContent className="flex flex-1 w-full items-center justify-center px-4 py-4">
              <PlayerHeadToHeadSection
                model={headToHeadModel}
                onNavigateToPlayer={onNavigateToPlayer}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="shadow-lg rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Team Comparison</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 pt-0">
          <TeamStatsComparisonSection
            homeAbbr={visualModel.homeAbbr}
            awayAbbr={visualModel.awayAbbr}
            majorGroups={visualModel.majorGroups}
            minorRows={visualModel.minorRows}
            advancedRows={visualModel.advancedRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
