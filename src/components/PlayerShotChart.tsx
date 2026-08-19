import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Player, Game } from '../App';
import { CourtView } from './CourtView';
import { NoStatRecorded } from './StatDisplay';
import { collectPlayerShotChartData, playerShotChartCoverageNote } from '../utils/playerShotChart';
import type { TournamentIdSet } from '../utils/tournamentSelection';
import { Target, TrendingUp, Crosshair } from 'lucide-react';

interface PlayerShotChartProps {
  player: Player;
  games: Game[];
  selectedTournamentIds: TournamentIdSet;
}

function shootingStatsFromShots(shots: { made: boolean; isThree: boolean }[]) {
  const totalShots = shots.length;
  const madeShots = shots.filter((shot) => shot.made).length;
  const twoPointers = shots.filter((shot) => !shot.isThree);
  const threePointers = shots.filter((shot) => shot.isThree);
  const twoPointMade = twoPointers.filter((shot) => shot.made).length;
  const threePointMade = threePointers.filter((shot) => shot.made).length;

  return {
    totalShots,
    madeShots,
    overallPercentage: totalShots > 0 ? (madeShots / totalShots) * 100 : 0,
    twoPointAttempts: twoPointers.length,
    twoPointMade,
    twoPointPercentage:
      twoPointers.length > 0 ? (twoPointMade / twoPointers.length) * 100 : 0,
    threePointAttempts: threePointers.length,
    threePointMade,
    threePointPercentage:
      threePointers.length > 0 ? (threePointMade / threePointers.length) * 100 : 0,
  };
}

export function PlayerShotChart({
  player,
  games,
  selectedTournamentIds,
}: PlayerShotChartProps) {
  const aggregation = useMemo(
    () => collectPlayerShotChartData(player.id, games, selectedTournamentIds),
    [player.id, games, selectedTournamentIds]
  );
  const { shots, gamesWithShotData } = aggregation;
  const coverageNote = playerShotChartCoverageNote(aggregation);

  const hasShotChartData = gamesWithShotData > 0 && shots.length > 0;
  const stats = shootingStatsFromShots(shots);
  const zoneStats = {
    paint: {
      made: shots.filter((s) => !s.isThree && s.inPaint && s.made).length,
      attempted: shots.filter((s) => !s.isThree && s.inPaint).length,
    },
    midRange: {
      made: shots.filter((s) => !s.isThree && !s.inPaint && s.made).length,
      attempted: shots.filter((s) => !s.isThree && !s.inPaint).length,
    },
    threePoint: {
      made: shots.filter((s) => s.isThree && s.made).length,
      attempted: shots.filter((s) => s.isThree).length,
    },
  };

  const hotZone = [
    {
      name: 'Paint',
      percentage:
        zoneStats.paint.attempted > 0
          ? (zoneStats.paint.made / zoneStats.paint.attempted) * 100
          : 0,
    },
    {
      name: 'Mid-Range',
      percentage:
        zoneStats.midRange.attempted > 0
          ? (zoneStats.midRange.made / zoneStats.midRange.attempted) * 100
          : 0,
    },
    {
      name: 'Three-Point',
      percentage:
        zoneStats.threePoint.attempted > 0
          ? (zoneStats.threePoint.made / zoneStats.threePoint.attempted) * 100
          : 0,
    },
  ].reduce((max, zone) => (zone.percentage > max.percentage ? zone : max));

  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
      <Card className="shadow-lg rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Target className="w-5 h-5" />
            Shot Chart
            <Badge variant="outline">
              {hasShotChartData ? `${shots.length} shots` : 'No shot chart data'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CourtView shots={shots} />
          {hasShotChartData && (
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full border border-white bg-[#22c55e] shadow-sm" />
                Made
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="relative inline-flex h-3 w-3 items-center justify-center">
                  <span className="absolute h-px w-3 rotate-45 bg-[#ef4444]" />
                  <span className="absolute h-px w-3 -rotate-45 bg-[#ef4444]" />
                </span>
                Missed
              </span>
            </div>
          )}
          {coverageNote && (
            <p className="text-center text-sm text-muted-foreground">{coverageNote}</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Shooting stats
          </CardTitle>
          <p className="text-sm text-muted-foreground">From located shots only</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {hasShotChartData ? stats.madeShots : <NoStatRecorded />}
              </div>
              <div className="text-sm text-muted-foreground">Made</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {hasShotChartData ? stats.totalShots : <NoStatRecorded />}
              </div>
              <div className="text-sm text-muted-foreground">Attempted</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {hasShotChartData ? (
                  `${stats.overallPercentage.toFixed(1)}%`
                ) : (
                  <NoStatRecorded />
                )}
              </div>
              <div className="text-sm text-muted-foreground">Overall</div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">2-Point Shots</span>
              <div className="text-right">
                {hasShotChartData ? (
                  <>
                    <div className="font-mono">
                      {stats.twoPointMade}/{stats.twoPointAttempts}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stats.twoPointPercentage.toFixed(1)}%
                    </div>
                  </>
                ) : (
                  <NoStatRecorded />
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">3-Point Shots</span>
              <div className="text-right">
                {hasShotChartData ? (
                  <>
                    <div className="font-mono">
                      {stats.threePointMade}/{stats.threePointAttempts}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stats.threePointPercentage.toFixed(1)}%
                    </div>
                  </>
                ) : (
                  <NoStatRecorded />
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Crosshair className="w-4 h-4" />
              By zone
            </div>
            <div className="space-y-3">
              {[
                { name: 'Paint', color: 'bg-blue-500', stats: zoneStats.paint },
                { name: 'Mid-Range', color: 'bg-gray-500', stats: zoneStats.midRange },
                { name: 'Three-Point', color: 'bg-purple-500', stats: zoneStats.threePoint },
              ].map((zone) => (
                <div key={zone.name} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                    <span className="text-sm">{zone.name}</span>
                  </div>
                  <div className="text-right">
                    {hasShotChartData ? (
                      <>
                        <div className="font-mono">
                          {zone.stats.made}/{zone.stats.attempted}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {zone.stats.attempted > 0
                            ? ((zone.stats.made / zone.stats.attempted) * 100).toFixed(1)
                            : '0.0'}
                          %
                        </div>
                      </>
                    ) : (
                      <NoStatRecorded />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {hasShotChartData && (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Hot Zone: {hotZone.name}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
