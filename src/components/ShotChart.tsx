import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Game } from '../App';
import { CourtView } from './CourtView';
import { NoStatRecorded } from './StatDisplay';
import {
  aggregateBoxScoreShooting,
  boxScoreShootingToDisplayStats,
} from '../utils/gameDisplay';
import { Target, Filter, TrendingUp, Crosshair } from 'lucide-react';

interface ShotChartProps {
  game: Game;
}

export function ShotChart({ game }: ShotChartProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away' | 'both'>('both');
  const [shotTypeFilter, setShotTypeFilter] = useState<'all' | 'made' | 'missed'>('all');
  const [shotDistanceFilter, setShotDistanceFilter] = useState<'all' | 'two' | 'three'>('all');

  // Get all players from both teams
  const allPlayers = [
    ...game.homeTeam.players.map(p => ({ ...p, team: 'home' as const })),
    ...game.awayTeam.players.map(p => ({ ...p, team: 'away' as const }))
  ];

  // Filter shots based on current selections
  const filteredShots = game.shots.filter(shot => {
    const player = allPlayers.find(p => p.id === shot.playerId);
    if (!player) return false;

    // Team filter
    if (selectedTeam !== 'both' && player.team !== selectedTeam) return false;

    // Player filter
    if (selectedPlayer !== 'all' && shot.playerId !== selectedPlayer) return false;

    // Shot type filter
    if (shotTypeFilter === 'made' && !shot.made) return false;
    if (shotTypeFilter === 'missed' && shot.made) return false;

    // Distance filter
    if (shotDistanceFilter === 'two' && shot.isThree) return false;
    if (shotDistanceFilter === 'three' && !shot.isThree) return false;

    return true;
  });

  const hasShotChartData = game.shots.length > 0;

  // Shot-level data when available; otherwise fall back to box score aggregates.
  const getShootingStats = () => {
    if (hasShotChartData) {
      const totalShots = filteredShots.length;
      const madeShots = filteredShots.filter((shot) => shot.made).length;
      const twoPointers = filteredShots.filter((shot) => !shot.isThree);
      const threePointers = filteredShots.filter((shot) => shot.isThree);
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
          threePointers.length > 0
            ? (threePointMade / threePointers.length) * 100
            : 0,
        fromBoxScore: false,
      };
    }

    const boxScoreTotals = aggregateBoxScoreShooting(game, {
      team: selectedTeam,
      playerId: selectedPlayer !== 'all' ? selectedPlayer : undefined,
    });

    return {
      ...boxScoreShootingToDisplayStats(boxScoreTotals),
      fromBoxScore: true,
    };
  };

  const stats = getShootingStats();

  const zoneStats = {
    paint: { 
      made: filteredShots.filter(s => !s.isThree && s.inPaint && s.made).length, 
      attempted: filteredShots.filter(s => !s.isThree && s.inPaint).length 
    },
    midRange: { 
      made: filteredShots.filter(s => !s.isThree && !s.inPaint && s.made).length, 
      attempted: filteredShots.filter(s => !s.isThree && !s.inPaint).length 
    },
    threePoint: { 
      made: filteredShots.filter(s => s.isThree && s.made).length, 
      attempted: filteredShots.filter(s => s.isThree).length 
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Shot Chart Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Team</label>
              <Select value={selectedTeam} onValueChange={(value) => setSelectedTeam(value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both Teams</SelectItem>
                  <SelectItem value="home">{game.homeTeam.name}</SelectItem>
                  {game.awayTeam.players.length > 0 && (
                    <SelectItem value="away">{game.awayTeam.name}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Player</label>
              <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Players</SelectItem>
                  {allPlayers
                    .filter(player => selectedTeam === 'both' || player.team === selectedTeam)
                    .map(player => (
                      <SelectItem key={player.id} value={player.id}>
                        #{player.number} {player.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Result</label>
              <Select
                value={shotTypeFilter}
                onValueChange={(value) => setShotTypeFilter(value as 'all' | 'made' | 'missed')}
                disabled={!hasShotChartData}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shots</SelectItem>
                  <SelectItem value="made">Made Only</SelectItem>
                  <SelectItem value="missed">Missed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Distance</label>
              <Select
                value={shotDistanceFilter}
                onValueChange={(value) => setShotDistanceFilter(value as 'all' | 'two' | 'three')}
                disabled={!hasShotChartData}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shots</SelectItem>
                  <SelectItem value="two">2-Pointers</SelectItem>
                  <SelectItem value="three">3-Pointers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shot Chart */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Shot Chart
            <Badge variant="outline" className="ml-2">
              {hasShotChartData ? `${filteredShots.length} shots` : 'No shot chart data'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CourtView 
            shots={filteredShots}
            useSvgBackground={true}
          />
        </CardContent>
      </Card>

      {/* Shooting Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Overall Stats */}
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Shooting Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{stats.madeShots}</div>
                <div className="text-sm text-muted-foreground">Made</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalShots}</div>
                <div className="text-sm text-muted-foreground">Attempted</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {stats.overallPercentage.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Overall</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">2-Point Shots</span>
                <div className="text-right">
                  <div className="font-mono">{stats.twoPointMade}/{stats.twoPointAttempts}</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.twoPointPercentage.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">3-Point Shots</span>
                <div className="text-right">
                  <div className="font-mono">{stats.threePointMade}/{stats.threePointAttempts}</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.threePointPercentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zone Statistics */}
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crosshair className="w-5 h-5" />
              Shooting by Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <>
                <Separator />

                <div className="text-center">
                  <div className="text-sm text-muted-foreground">
                    Hot Zone:{' '}
                    {
                      [
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
                      ].reduce((max, zone) =>
                        zone.percentage > max.percentage ? zone : max
                      ).name
                    }
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}