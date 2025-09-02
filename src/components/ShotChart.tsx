import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Game, Shot } from '../App';
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

  // Calculate shooting statistics
  const getShootingStats = () => {
    const totalShots = filteredShots.length;
    const madeShots = filteredShots.filter(shot => shot.made).length;
    const twoPointers = filteredShots.filter(shot => !shot.isThree);
    const threePointers = filteredShots.filter(shot => shot.isThree);
    
    const twoPointMade = twoPointers.filter(shot => shot.made).length;
    const threePointMade = threePointers.filter(shot => shot.made).length;

    return {
      totalShots,
      madeShots,
      overallPercentage: totalShots > 0 ? (madeShots / totalShots) * 100 : 0,
      twoPointAttempts: twoPointers.length,
      twoPointMade,
      twoPointPercentage: twoPointers.length > 0 ? (twoPointMade / twoPointers.length) * 100 : 0,
      threePointAttempts: threePointers.length,
      threePointMade,
      threePointPercentage: threePointers.length > 0 ? (threePointMade / threePointers.length) * 100 : 0
    };
  };

  const stats = getShootingStats();

  // Get shooting zones statistics
  const getZoneStats = () => {
    const zones = {
      paint: { made: 0, attempted: 0 },
      midRange: { made: 0, attempted: 0 },
      threePoint: { made: 0, attempted: 0 }
    };

    filteredShots.forEach(shot => {
      if (shot.isThree) {
        zones.threePoint.attempted++;
        if (shot.made) zones.threePoint.made++;
      } else {
        // Simple zone classification based on court position
        const distanceFromBasket = Math.sqrt(
          Math.pow(shot.x - (shot.x < 50 ? 25 : 75), 2) + Math.pow(shot.y - 50, 2)
        );
        
        if (distanceFromBasket < 15) {
          zones.paint.attempted++;
          if (shot.made) zones.paint.made++;
        } else {
          zones.midRange.attempted++;
          if (shot.made) zones.midRange.made++;
        }
      }
    });

    return zones;
  };

  const zoneStats = getZoneStats();

  const CourtWithShots = () => (
    <div className="relative">
      <svg
        viewBox="0 0 470 250"
        className="w-full h-auto border-2 border-gray-300 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20"
      >
        {/* Court outline */}
        <rect x="10" y="10" width="450" height="230" fill="none" stroke="#8B4513" strokeWidth="2"/>
        
        {/* Half court line */}
        <line x1="235" y1="10" x2="235" y2="240" stroke="#8B4513" strokeWidth="2"/>
        
        {/* Center circle */}
        <circle cx="235" cy="125" r="30" fill="none" stroke="#8B4513" strokeWidth="2"/>
        
        {/* Left basket area */}
        <rect x="10" y="85" width="60" height="80" fill="rgba(59, 130, 246, 0.1)" stroke="#8B4513" strokeWidth="2"/>
        <rect x="10" y="105" width="19" height="40" fill="none" stroke="#8B4513" strokeWidth="2"/>
        <circle cx="25" cy="125" r="2" fill="#8B4513"/>
        
        {/* Right basket area */}
        <rect x="400" y="85" width="60" height="80" fill="rgba(59, 130, 246, 0.1)" stroke="#8B4513" strokeWidth="2"/>
        <rect x="441" y="105" width="19" height="40" fill="none" stroke="#8B4513" strokeWidth="2"/>
        <circle cx="445" cy="125" r="2" fill="#8B4513"/>
        
        {/* Three-point lines */}
        <path d="M 10 40 Q 25 40 70 80 Q 80 125 70 170 Q 25 210 10 210" 
              fill="rgba(147, 51, 234, 0.1)" stroke="#8B4513" strokeWidth="2"/>
        <path d="M 460 40 Q 445 40 400 80 Q 390 125 400 170 Q 445 210 460 210" 
              fill="rgba(147, 51, 234, 0.1)" stroke="#8B4513" strokeWidth="2"/>
        
        {/* Zone labels */}
        <text x="45" y="130" textAnchor="middle" className="fill-blue-600 text-xs font-medium opacity-60">
          Paint
        </text>
        <text x="425" y="130" textAnchor="middle" className="fill-blue-600 text-xs font-medium opacity-60">
          Paint
        </text>
        <text x="150" y="130" textAnchor="middle" className="fill-gray-600 text-xs font-medium opacity-60">
          Mid-Range
        </text>
        <text x="320" y="130" textAnchor="middle" className="fill-gray-600 text-xs font-medium opacity-60">
          Mid-Range
        </text>
        <text x="45" y="60" textAnchor="middle" className="fill-purple-600 text-xs font-medium opacity-60">
          3PT
        </text>
        <text x="425" y="60" textAnchor="middle" className="fill-purple-600 text-xs font-medium opacity-60">
          3PT
        </text>

        {/* Render shots */}
        {filteredShots.map((shot, index) => {
          const player = allPlayers.find(p => p.id === shot.playerId);
          return (
            <g key={shot.id}>
              <circle
                cx={shot.x * 4.7}
                cy={shot.y * 2.5}
                r={shot.isThree ? "4" : "3"}
                fill={shot.made ? 
                  (shot.isThree ? '#22c55e' : '#3b82f6') : 
                  (shot.isThree ? '#ef4444' : '#f97316')
                }
                stroke="#fff"
                strokeWidth="1.5"
                opacity="0.85"
                className="transition-opacity hover:opacity-100 cursor-pointer"
              >
                <title>
                  {player?.name} #{player?.number} - {shot.isThree ? '3PT' : '2PT'} {shot.made ? 'Made' : 'Missed'}
                </title>
              </circle>
              {/* Player number overlay for made shots */}
              {shot.made && (
                <text
                  x={shot.x * 4.7}
                  y={shot.y * 2.5 + 2}
                  textAnchor="middle"
                  className="fill-white text-xs font-bold pointer-events-none"
                >
                  {player?.number}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="absolute bottom-2 right-2 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>2PT Made</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>2PT Missed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span>3PT Made</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span>3PT Missed</span>
          </div>
        </div>
      </div>
    </div>
  );

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
              <Select value={shotTypeFilter} onValueChange={(value) => setShotTypeFilter(value as any)}>
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
              <Select value={shotDistanceFilter} onValueChange={(value) => setShotDistanceFilter(value as any)}>
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
              {filteredShots.length} shots
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CourtWithShots />
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
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">Paint</span>
                </div>
                <div className="text-right">
                  <div className="font-mono">{zoneStats.paint.made}/{zoneStats.paint.attempted}</div>
                  <div className="text-xs text-muted-foreground">
                    {zoneStats.paint.attempted > 0 ? 
                      ((zoneStats.paint.made / zoneStats.paint.attempted) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span className="text-sm">Mid-Range</span>
                </div>
                <div className="text-right">
                  <div className="font-mono">{zoneStats.midRange.made}/{zoneStats.midRange.attempted}</div>
                  <div className="text-xs text-muted-foreground">
                    {zoneStats.midRange.attempted > 0 ? 
                      ((zoneStats.midRange.made / zoneStats.midRange.attempted) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-sm">Three-Point</span>
                </div>
                <div className="text-right">
                  <div className="font-mono">{zoneStats.threePoint.made}/{zoneStats.threePoint.attempted}</div>
                  <div className="text-xs text-muted-foreground">
                    {zoneStats.threePoint.attempted > 0 ? 
                      ((zoneStats.threePoint.made / zoneStats.threePoint.attempted) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                Hot Zone: {
                  [
                    { name: 'Paint', percentage: zoneStats.paint.attempted > 0 ? (zoneStats.paint.made / zoneStats.paint.attempted) * 100 : 0 },
                    { name: 'Mid-Range', percentage: zoneStats.midRange.attempted > 0 ? (zoneStats.midRange.made / zoneStats.midRange.attempted) * 100 : 0 },
                    { name: 'Three-Point', percentage: zoneStats.threePoint.attempted > 0 ? (zoneStats.threePoint.made / zoneStats.threePoint.attempted) * 100 : 0 }
                  ].reduce((max, zone) => zone.percentage > max.percentage ? zone : max).name
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}