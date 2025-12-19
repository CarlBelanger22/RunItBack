import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Player, Team, Game, Shot } from '../App';
import { Target, Thermometer } from 'lucide-react';
import courtImage from 'figma:asset/77b3cb60278146a2e537f92c04fc7ef61df2281f.png';

interface PlayerShotChartProps {
  player: Player;
  team: Team;
  games: Game[];
  selectedTournament: string;
}

// Zone data structure
interface ZoneData {
  id: string;
  name: string;
  path: string;
  clipPath?: string;
  made: number;
  attempted: number;
  percentage: number;
  labelX: number;
  labelY: number;
  shots: Shot[]; // Preserved shot-level data (non-rendered)
}

export function PlayerShotChart({ player, team, games, selectedTournament }: PlayerShotChartProps) {
  // Get all shots by the player
  const getPlayerShots = (): Shot[] => {
    const playerGames = games.filter(game => 
      game.gameStats.some(stat => stat.playerId === player.id) &&
      (selectedTournament === 'all' || game.tournamentId === selectedTournament)
    );

    const allShots: Shot[] = [];
    playerGames.forEach(game => {
      const playerShots = game.shots.filter(shot => shot.playerId === player.id);
      allShots.push(...playerShots);
    });

    return allShots;
  };

  const playerShots = getPlayerShots();

  // Court dimensions (viewBox coordinate system)
  const COURT_WIDTH = 1000;
  const COURT_HEIGHT = 1000;
  
  // Key measurements traced from actual court geometry
  const BASKET_X = 500;
  const BASKET_Y = 83;
  const PAINT_WIDTH = 160;
  const PAINT_TOP = 83;
  const PAINT_BOTTOM = 270;
  const FT_CIRCLE_CENTER_Y = 270;
  const FT_CIRCLE_RADIUS = 60;
  const RESTRICTED_RADIUS = 40;
  const THREE_BREAK_Y = 140;
  const THREE_CORNER_X = 90;
  const THREE_ARC_RADIUS = 237.5;
  const BASELINE_Y = 50;

  // Step 1: Traced court paths (locked geometry)
  const courtPaths = {
    // Sidelines and baseline
    sideline_left: `M 50 ${BASELINE_Y} L 50 950`,
    sideline_right: `M 950 ${BASELINE_Y} L 950 950`,
    baseline: `M 50 ${BASELINE_Y} L 950 ${BASELINE_Y}`,
    centerline: `M 50 ${COURT_HEIGHT / 2} L 950 ${COURT_HEIGHT / 2}`,
    
    // Lane (paint) rectangle
    lane_outer_left: `M ${BASKET_X - PAINT_WIDTH/2} ${PAINT_TOP} L ${BASKET_X - PAINT_WIDTH/2} ${PAINT_BOTTOM}`,
    lane_outer_right: `M ${BASKET_X + PAINT_WIDTH/2} ${PAINT_TOP} L ${BASKET_X + PAINT_WIDTH/2} ${PAINT_BOTTOM}`,
    lane_rect: `M ${BASKET_X - PAINT_WIDTH/2} ${PAINT_TOP} L ${BASKET_X - PAINT_WIDTH/2} ${PAINT_BOTTOM} L ${BASKET_X + PAINT_WIDTH/2} ${PAINT_BOTTOM} L ${BASKET_X + PAINT_WIDTH/2} ${PAINT_TOP} Z`,
    
    // Restricted area (4-foot arc under basket)
    restricted_arc: `M ${BASKET_X - RESTRICTED_RADIUS} ${BASKET_Y + RESTRICTED_RADIUS} A ${RESTRICTED_RADIUS} ${RESTRICTED_RADIUS} 0 0 1 ${BASKET_X + RESTRICTED_RADIUS} ${BASKET_Y + RESTRICTED_RADIUS}`,
    
    // Free throw circle
    ft_circle: `M ${BASKET_X} ${FT_CIRCLE_CENTER_Y} m -${FT_CIRCLE_RADIUS} 0 a ${FT_CIRCLE_RADIUS} ${FT_CIRCLE_RADIUS} 0 1 0 ${FT_CIRCLE_RADIUS * 2} 0 a ${FT_CIRCLE_RADIUS} ${FT_CIRCLE_RADIUS} 0 1 0 -${FT_CIRCLE_RADIUS * 2} 0`,
    ft_semicircle_paint: `M ${BASKET_X - FT_CIRCLE_RADIUS} ${FT_CIRCLE_CENTER_Y} A ${FT_CIRCLE_RADIUS} ${FT_CIRCLE_RADIUS} 0 0 1 ${BASKET_X + FT_CIRCLE_RADIUS} ${FT_CIRCLE_CENTER_Y}`,
    
    // Three-point line segments
    three_line_left: `M ${THREE_CORNER_X} ${THREE_BREAK_Y} L ${THREE_CORNER_X} ${BASELINE_Y}`,
    three_line_right: `M ${COURT_WIDTH - THREE_CORNER_X} ${THREE_BREAK_Y} L ${COURT_WIDTH - THREE_CORNER_X} ${BASELINE_Y}`,
    
    // Three-point arc (curved section between breaks)
    three_arc: (() => {
      const centerX = BASKET_X;
      const centerY = BASKET_Y;
      const radius = THREE_ARC_RADIUS;
      
      // Calculate arc endpoints at the breaks
      const leftBreakX = THREE_CORNER_X;
      const rightBreakX = COURT_WIDTH - THREE_CORNER_X;
      const breakY = THREE_BREAK_Y;
      
      // Create the arc path
      return `M ${leftBreakX} ${breakY} A ${radius} ${radius} 0 0 1 ${rightBreakX} ${breakY}`;
    })(),
    
    // Rim and backboard
    rim: `M ${BASKET_X} ${BASKET_Y} m -7.5 0 a 7.5 7.5 0 1 0 15 0 a 7.5 7.5 0 1 0 -15 0`,
    backboard: `M ${BASKET_X - 30} ${BASKET_Y - 5} L ${BASKET_X + 30} ${BASKET_Y - 5}`
  };

  // Helper: Check if point is inside a zone (using precise geometry)
  const isPointInZone = (x: number, y: number, zoneId: string): boolean => {
    const dx = x - BASKET_X;
    const dy = y - BASKET_Y;
    const distFromBasket = Math.sqrt(dx * dx + dy * dy);
    
    const inPaint = x >= BASKET_X - PAINT_WIDTH/2 && 
                    x <= BASKET_X + PAINT_WIDTH/2 && 
                    y >= PAINT_TOP && 
                    y <= PAINT_BOTTOM;
    
    const inRestrictedArc = distFromBasket <= RESTRICTED_RADIUS && 
                            y >= BASKET_Y && 
                            y <= BASKET_Y + RESTRICTED_RADIUS;
    
    const beyondThreeArc = distFromBasket >= THREE_ARC_RADIUS || 
                           (y >= BASELINE_Y && y <= THREE_BREAK_Y && 
                            (x <= THREE_CORNER_X || x >= COURT_WIDTH - THREE_CORNER_X));
    
    switch (zoneId) {
      case 'restricted':
        return inRestrictedArc;
      
      case 'paint_nonRA':
        return inPaint && !inRestrictedArc;
      
      case 'mid_center':
        return !beyondThreeArc && 
               !inPaint && 
               x >= BASKET_X - PAINT_WIDTH/2 - 20 && 
               x <= BASKET_X + PAINT_WIDTH/2 + 20 &&
               y >= PAINT_BOTTOM - 20 &&
               y <= 500;
      
      case 'mid_left':
        return !beyondThreeArc && 
               !inPaint && 
               x < BASKET_X - PAINT_WIDTH/2 - 20 && 
               x >= THREE_CORNER_X + 10 &&
               y >= THREE_BREAK_Y &&
               y <= 500;
      
      case 'mid_right':
        return !beyondThreeArc && 
               !inPaint && 
               x > BASKET_X + PAINT_WIDTH/2 + 20 && 
               x <= COURT_WIDTH - THREE_CORNER_X - 10 &&
               y >= THREE_BREAK_Y &&
               y <= 500;
      
      case 'corner3_left':
        return x <= THREE_CORNER_X + 5 && 
               y >= BASELINE_Y && 
               y <= THREE_BREAK_Y + 20;
      
      case 'corner3_right':
        return x >= COURT_WIDTH - THREE_CORNER_X - 5 && 
               y >= BASELINE_Y && 
               y <= THREE_BREAK_Y + 20;
      
      case 'wing3_left':
        return beyondThreeArc && 
               x > THREE_CORNER_X + 5 && 
               x < BASKET_X - 100 &&
               y >= THREE_BREAK_Y - 20 &&
               y <= 450;
      
      case 'wing3_right':
        return beyondThreeArc && 
               x < COURT_WIDTH - THREE_CORNER_X - 5 && 
               x > BASKET_X + 100 &&
               y >= THREE_BREAK_Y - 20 &&
               y <= 450;
      
      case 'top3':
        return beyondThreeArc && 
               x >= BASKET_X - 100 && 
               x <= BASKET_X + 100 &&
               y >= 380 &&
               y <= 600;
      
      default:
        return false;
    }
  };

  // Step 2: Build zones using traced paths (boolean operations via SVG paths)
  const createZones = (): ZoneData[] => {
    const zones: ZoneData[] = [
      // Restricted area (inside restricted_arc ∩ inside lane_rect)
      {
        id: 'restricted',
        name: 'Restricted',
        path: `M ${BASKET_X - RESTRICTED_RADIUS} ${BASKET_Y + RESTRICTED_RADIUS} A ${RESTRICTED_RADIUS} ${RESTRICTED_RADIUS} 0 0 1 ${BASKET_X + RESTRICTED_RADIUS} ${BASKET_Y + RESTRICTED_RADIUS} L ${BASKET_X + RESTRICTED_RADIUS} ${BASKET_Y} A ${RESTRICTED_RADIUS} ${RESTRICTED_RADIUS} 0 0 0 ${BASKET_X - RESTRICTED_RADIUS} ${BASKET_Y} Z`,
        labelX: BASKET_X,
        labelY: BASKET_Y + 32,
        made: 0,
        attempted: 0,
        percentage: 0,
        shots: []
      },
      
      // Paint non-restricted (inside lane_rect − inside restricted_arc)
      {
        id: 'paint_nonRA',
        name: 'Paint',
        path: `M ${BASKET_X - PAINT_WIDTH/2} ${PAINT_TOP} L ${BASKET_X - PAINT_WIDTH/2} ${PAINT_BOTTOM} L ${BASKET_X + PAINT_WIDTH/2} ${PAINT_BOTTOM} L ${BASKET_X + PAINT_WIDTH/2} ${PAINT_TOP} L ${BASKET_X + RESTRICTED_RADIUS} ${BASKET_Y} A ${RESTRICTED_RADIUS} ${RESTRICTED_RADIUS} 0 0 0 ${BASKET_X - RESTRICTED_RADIUS} ${BASKET_Y} Z M ${BASKET_X - RESTRICTED_RADIUS} ${BASKET_Y + RESTRICTED_RADIUS} A ${RESTRICTED_RADIUS} ${RESTRICTED_RADIUS} 0 0 1 ${BASKET_X + RESTRICTED_RADIUS} ${BASKET_Y + RESTRICTED_RADIUS}`,
        labelX: BASKET_X,
        labelY: PAINT_BOTTOM - 80,
        made: 0,
        attempted: 0,
        percentage: 0,
        shots: []
      },
      
      // Mid-range center (top of key)
      {
        id: 'mid_center',
        name: 'Mid Center',
        path: `M ${BASKET_X - PAINT_WIDTH/2} ${PAINT_BOTTOM} L ${BASKET_X - PAINT_WIDTH/2} ${PAINT_BOTTOM + 150} Q ${BASKET_X} ${PAINT_BOTTOM + 210} ${BASKET_X + PAINT_WIDTH/2} ${PAINT_BOTTOM + 150} L ${BASKET_X + PAINT_WIDTH/2} ${PAINT_BOTTOM} Z`,
        labelX: BASKET_X,
        labelY: PAINT_BOTTOM + 95,
        made: 0,
        attempted: 0,
        percentage: 0,
        shots: []
      },
      
      // Mid-range left (follows three_arc curve exactly)
      {
        id: 'mid_left',
        name: 'Mid Left',
        path: (() => {
          const leftX = THREE_CORNER_X + 15;
          const topY = THREE_BREAK_Y;
          const arcStartX = BASKET_X - PAINT_WIDTH/2 - 40;
          const arcStartY = PAINT_BOTTOM + 100;
          
          // Create path that follows the three-point arc inner boundary
          return `M ${leftX} ${topY} L ${leftX} ${topY + 200} Q ${leftX + 80} ${topY + 240} ${arcStartX} ${arcStartY} L ${BASKET_X - PAINT_WIDTH/2} ${PAINT_BOTTOM + 150} Q ${BASKET_X - 40} ${topY + 150} ${leftX + 50} ${topY + 20} Z`;
        })(),
        labelX: 220,
        labelY: 350,
        made: 0,
        attempted: 0,
        percentage: 0,
        shots: []
      },
      
      // Mid-range right (mirror of mid_left - perfect symmetry)
      {
        id: 'mid_right',
        name: 'Mid Right',
        path: (() => {
          const rightX = COURT_WIDTH - THREE_CORNER_X - 15;
          const topY = THREE_BREAK_Y;
          const arcStartX = BASKET_X + PAINT_WIDTH/2 + 40;
          const arcStartY = PAINT_BOTTOM + 100;
          
          return `M ${rightX} ${topY} L ${rightX} ${topY + 200} Q ${rightX - 80} ${topY + 240} ${arcStartX} ${arcStartY} L ${BASKET_X + PAINT_WIDTH/2} ${PAINT_BOTTOM + 150} Q ${BASKET_X + 40} ${topY + 150} ${rightX - 50} ${topY + 20} Z`;
        })(),
        labelX: 780,
        labelY: 350,
        made: 0,
        attempted: 0,
        percentage: 0,
        shots: []
      },
      
      // Corner 3 left (outside three_line_left, bounded by sideline & baseline)
      {
        id: 'corner3_left',
        name: 'L Corner 3',
        path: `M ${THREE_CORNER_X} ${BASELINE_Y} L 55 ${BASELINE_Y} L 55 ${THREE_BREAK_Y + 15} L ${THREE_CORNER_X} ${THREE_BREAK_Y + 15} Z`,
        labelX: THREE_CORNER_X - 20,
        labelY: 100,
        made: 0,
        attempted: 0,
        percentage: 0,
        shots: []
      },
      
      // Corner 3 right (mirror of corner3_left)
      {
        id: 'corner3_right',
        name: 'R Corner 3',
        path: `M ${COURT_WIDTH - THREE_CORNER_X} ${BASELINE_Y} L ${COURT_WIDTH - 55} ${BASELINE_Y} L ${COURT_WIDTH - 55} ${THREE_BREAK_Y + 15} L ${COURT_WIDTH - THREE_CORNER_X} ${THREE_BREAK_Y + 15} Z`,
        labelX: COURT_WIDTH - THREE_CORNER_X + 20,
        labelY: 100,
        made: 0,
        attempted: 0,
        percentage: 0,
        shots: []
      },
      
      // Wing 3 left (outside three_arc, left sector)
      {
        id: 'wing3_left',
        name: 'L Wing 3',
        path: (() => {
          const startX = THREE_CORNER_X;
          const startY = THREE_BREAK_Y + 15;
          const radius = THREE_ARC_RADIUS;
          
          // Path following outer edge of three-point arc
          return `M ${startX} ${startY} L ${startX + 15} ${startY} Q ${startX + 80} ${startY + 80} ${startX + 140} ${startY + 180} L ${startX + 120} ${startY + 195} Q ${startX + 65} ${startY + 95} ${startX} ${startY + 20} Z`;
        })(),
        labelX: 165,
        labelY: 235,
        made: 0,
        attempted: 0,
        percentage: 0,
        shots: []
      },
      
      // Wing 3 right (mirror of wing3_left)
      {
        id: 'wing3_right',
        name: 'R Wing 3',
        path: (() => {
          const startX = COURT_WIDTH - THREE_CORNER_X;
          const startY = THREE_BREAK_Y + 15;
          
          return `M ${startX} ${startY} L ${startX - 15} ${startY} Q ${startX - 80} ${startY + 80} ${startX - 140} ${startY + 180} L ${startX - 120} ${startY + 195} Q ${startX - 65} ${startY + 95} ${startX} ${startY + 20} Z`;
        })(),
        labelX: 835,
        labelY: 235,
        made: 0,
        attempted: 0,
        percentage: 0,
        shots: []
      },
      
      // Top 3 (outside three_arc, center sector above key)
      {
        id: 'top3',
        name: 'Top 3',
        path: (() => {
          const leftEdge = BASKET_X - 140;
          const rightEdge = BASKET_X + 140;
          const topY = 435;
          
          return `M ${leftEdge} ${topY - 95} Q ${BASKET_X - 100} ${topY - 50} ${BASKET_X} ${topY} Q ${BASKET_X + 100} ${topY - 50} ${rightEdge} ${topY - 95} L ${rightEdge - 10} ${topY - 80} Q ${BASKET_X + 90} ${topY - 40} ${BASKET_X} ${topY - 15} Q ${BASKET_X - 90} ${topY - 40} ${leftEdge + 10} ${topY - 80} Z`;
        })(),
        labelX: BASKET_X,
        labelY: 390,
        made: 0,
        attempted: 0,
        percentage: 0,
        shots: []
      }
    ];

    // Calculate stats for each zone and preserve shot data
    zones.forEach(zone => {
      const zoneShots = playerShots.filter(shot => {
        const shotX = shot.x * 10;
        const shotY = shot.y * 10;
        return isPointInZone(shotX, shotY, zone.id);
      });

      zone.shots = zoneShots;
      zone.attempted = zoneShots.length;
      zone.made = zoneShots.filter(shot => shot.made).length;
      zone.percentage = zone.attempted > 0 ? (zone.made / zone.attempted) * 100 : 0;
    });

    return zones;
  };

  const zones = createZones();

  // Color map based on FG%
  const getZoneFill = (zone: ZoneData): string => {
    if (zone.attempted === 0) return 'rgba(209, 213, 219, 0.25)'; // No data
    
    const pct = zone.percentage;
    if (pct >= 60) return 'rgba(34, 197, 94, 0.35)';      // ≥60%: green, 35%
    if (pct >= 45) return 'rgba(163, 230, 184, 0.32)';    // 45-59%: light green, 32%
    if (pct >= 35) return 'rgba(209, 213, 219, 0.28)';    // 35-44%: neutral, 28%
    return 'rgba(239, 68, 68, 0.32)';                     // <35%: red, 32%
  };

  // Zone stroke color for clear boundaries
  const getZoneStroke = (zone: ZoneData): string => {
    if (zone.attempted === 0) return 'rgba(156, 163, 175, 0.4)'; // Gray for no data
    
    const pct = zone.percentage;
    if (pct >= 60) return 'rgba(34, 197, 94, 0.5)';       // Green stroke
    if (pct >= 45) return 'rgba(163, 230, 184, 0.5)';     // Light green stroke
    if (pct >= 35) return 'rgba(156, 163, 175, 0.45)';    // Neutral stroke
    return 'rgba(239, 68, 68, 0.5)';                      // Red stroke
  };

  // Auto-contrast text color
  const getTextColor = (zone: ZoneData): string => {
    if (zone.attempted === 0) return '#9CA3AF';
    
    const pct = zone.percentage;
    // Always use dark text on semi-transparent fills for readability
    return '#111827';
  };

  // Calculate overall stats
  const totalShots = playerShots.length;
  const totalMade = playerShots.filter(shot => shot.made).length;
  const overallPercentage = totalShots > 0 ? (totalMade / totalShots) * 100 : 0;

  const ShotChartCourt = () => (
    <div className="relative w-full">
      {/* Court base image (locked) */}
      <div className="relative">
        <img 
          src={courtImage} 
          alt="Basketball half court" 
          className="w-full h-auto"
        />
        
        {/* SVG overlay - layered organization */}
        <svg
          viewBox={`0 0 ${COURT_WIDTH} ${COURT_HEIGHT}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Layer 1: court/paths (traced geometry - locked, visible for reference) */}
          <g id="court-paths" opacity="0">
            <path d={courtPaths.sideline_left} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
            <path d={courtPaths.sideline_right} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
            <path d={courtPaths.baseline} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
            <path d={courtPaths.lane_outer_left} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
            <path d={courtPaths.lane_outer_right} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
            <path d={courtPaths.restricted_arc} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeDasharray="4,4" />
            <path d={courtPaths.ft_circle} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
            <path d={courtPaths.three_line_left} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
            <path d={courtPaths.three_line_right} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
            <path d={courtPaths.three_arc} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" />
          </g>
          
          {/* Layer 2: zones/* (filled regions with visible strokes) */}
          <g id="zones">
            {zones.map(zone => (
              <path
                key={`zone-${zone.id}`}
                d={zone.path}
                fill={getZoneFill(zone)}
                stroke={getZoneStroke(zone)}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>
          
          {/* Layer 3: labels/* (FG% statistics) */}
          <g id="labels">
            {zones
              .filter(zone => zone.attempted > 0)
              .map(zone => (
                <g key={`label-${zone.id}`}>
                  {/* Background pill for contrast */}
                  <rect
                    x={zone.labelX - 45}
                    y={zone.labelY - 12}
                    width="90"
                    height="24"
                    fill="rgba(255, 255, 255, 0.94)"
                    rx="5"
                    stroke="rgba(0, 0, 0, 0.06)"
                    strokeWidth="1"
                  />
                  {/* FG% text: "10/19 · 53%" */}
                  <text
                    x={zone.labelX}
                    y={zone.labelY + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={getTextColor(zone)}
                    fontSize="12"
                    fontFamily="Inter, -apple-system, 'SF Pro Text', Roboto, sans-serif"
                    fontWeight="500"
                    letterSpacing="-0.01em"
                  >
                    {zone.made}/{zone.attempted} · {zone.percentage.toFixed(0)}%
                  </text>
                </g>
              ))}
          </g>
          
          {/* Layer 4: data/shots (invisible shot-level data) */}
          <g id="data-shots" opacity="0">
            {/* Shot coordinates preserved in zone.shots arrays - not rendered */}
          </g>
        </svg>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Shot Chart - Zone FG% Heat Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Shot Chart by Zone
            <Badge variant="outline" className="ml-2">
              {totalShots} shots
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ShotChartCourt />
        </CardContent>
      </Card>

      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Overall Shooting Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="w-5 h-5" />
              Shooting Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl">{overallPercentage.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Overall FG%</div>
              <div className="text-xs text-muted-foreground mt-1">
                {totalMade}/{totalShots} Field Goals
              </div>
            </div>
            
            {totalShots > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Two-Pointers</span>
                  <span className="text-sm font-mono">
                    {playerShots.filter(s => !s.isThree && s.made).length}/
                    {playerShots.filter(s => !s.isThree).length}
                    {playerShots.filter(s => !s.isThree).length > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        ({(playerShots.filter(s => !s.isThree && s.made).length / playerShots.filter(s => !s.isThree).length * 100).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Three-Pointers</span>
                  <span className="text-sm font-mono">
                    {playerShots.filter(s => s.isThree && s.made).length}/
                    {playerShots.filter(s => s.isThree).length}
                    {playerShots.filter(s => s.isThree).length > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        ({(playerShots.filter(s => s.isThree && s.made).length / playerShots.filter(s => s.isThree).length * 100).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Zone Performance Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Zone Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {zones
                .filter(zone => zone.attempted > 0)
                .sort((a, b) => b.percentage - a.percentage)
                .slice(0, 8)
                .map(zone => {
                  const pct = zone.percentage;
                  let colorDot = 'rgb(209, 213, 219)';
                  if (pct >= 60) colorDot = 'rgb(34, 197, 94)';
                  else if (pct >= 45) colorDot = 'rgb(163, 230, 184)';
                  else if (pct >= 35) colorDot = 'rgb(209, 213, 219)';
                  else colorDot = 'rgb(239, 68, 68)';
                  
                  return (
                    <div key={zone.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: colorDot }}
                        />
                        <span>{zone.name}</span>
                      </div>
                      <span className="font-mono">
                        {zone.made}/{zone.attempted} · {zone.percentage.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
            </div>
            
            {zones.filter(zone => zone.attempted > 0).length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                <p className="text-sm">No shot data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
