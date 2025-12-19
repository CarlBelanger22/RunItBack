import React from 'react';
import { GameEvent, Team, Player } from '../App';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';
import { 
  Target, 
  Activity, 
  RotateCcw, 
  AlertCircle, 
  RefreshCw, 
  Clock,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';

interface PlayByPlayProps {
  events: GameEvent[];
  ourTeam: Team;
  opponentTeam: Team;
  className?: string;
  maxEvents?: number;
}

export function PlayByPlay({ 
  events, 
  ourTeam, 
  opponentTeam, 
  className,
  maxEvents 
}: PlayByPlayProps) {
  const allPlayers = [...ourTeam.players, ...opponentTeam.players];
  const displayEvents = maxEvents ? events.slice(-maxEvents).reverse() : [...events].reverse();

  const getPlayerName = (playerId?: string) => {
    if (!playerId) return null;
    const player = allPlayers.find(p => p.id === playerId);
    return player ? `${player.name.split(' ').pop()} #${player.number}` : 'Unknown';
  };

  const getTeamAbbr = (teamId: string) => {
    if (teamId === ourTeam.id) return ourTeam.abbreviation;
    if (teamId === opponentTeam.id) return opponentTeam.abbreviation;
    return 'UNK';
  };

  const formatEventMessage = (event: GameEvent) => {
    const playerName = getPlayerName(event.playerId);
    const teamAbbr = getTeamAbbr(event.teamId);
    const isOurTeam = event.teamId === ourTeam.id;

    switch (event.type) {
      case 'shot_attempt':
        const shotType = event.details.isThree ? '3PT' : '2PT';
        const result = event.details.made ? 'made' : 'missed';
        let msg = `${playerName || teamAbbr} ${result} ${shotType} shot`;
        if (event.details.assistedBy) {
          msg += ` (AST: ${getPlayerName(event.details.assistedBy)})`;
        }
        if (event.details.blockedBy) {
          msg += ` (BLK: ${getPlayerName(event.details.blockedBy)})`;
        }
        return msg;

      case 'free_throw':
        const ftMade = event.details.attempts?.filter((a: boolean) => a).length || 0;
        const ftTotal = event.details.attempts?.length || 0;
        return `${playerName || teamAbbr} free throw: ${ftMade}/${ftTotal}`;

      case 'rebound':
        const rebType = event.details.reboundType === 'offensive' ? 'OFF' : 'DEF';
        return `${playerName || teamAbbr} ${rebType} rebound`;

      case 'foul':
        const foulType = event.details.foulType || 'personal';
        let foulMsg = `${playerName || teamAbbr} ${foulType} foul`;
        if (event.details.fouledPlayer) {
          foulMsg += ` on ${getPlayerName(event.details.fouledPlayer)}`;
        }
        return foulMsg;

      case 'turnover':
        const toType = (event.details.turnoverType || 'general').replace('_', ' ');
        let toMsg = `${playerName || teamAbbr} turnover (${toType})`;
        if (event.details.stolenBy) {
          toMsg += ` (STL: ${getPlayerName(event.details.stolenBy)})`;
        }
        return toMsg;

      case 'substitution':
        return `Substitution: ${event.details.playersIn?.map((id: string) => getPlayerName(id)).join(', ')} IN, ${event.details.playersOut?.map((id: string) => getPlayerName(id)).join(', ')} OUT`;

      case 'timeout':
        return `${teamAbbr} Timeout`;

      case 'violation':
        return `${playerName || teamAbbr} violation (${event.details.type})`;

      default:
        return `${event.type} by ${playerName || teamAbbr}`;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'shot_attempt': return <Target className="w-3 h-3" />;
      case 'free_throw': return <Target className="w-3 h-3 text-blue-500" />;
      case 'rebound': return <RotateCcw className="w-3 h-3 text-orange-500" />;
      case 'foul': return <AlertCircle className="w-3 h-3 text-red-500" />;
      case 'turnover': return <Activity className="w-3 h-3 text-amber-600" />;
      case 'substitution': return <RefreshCw className="w-3 h-3 text-green-600" />;
      default: return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  return (
    <ScrollArea className={cn("h-full w-full pr-4", className)}>
      <div className="space-y-3">
        {displayEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm italic">
            No events recorded yet
          </div>
        ) : (
          displayEvents.map((event, index) => {
            const isOurTeam = event.teamId === ourTeam.id;
            const isScoring = (event.type === 'shot_attempt' && event.details.made) || 
                             (event.type === 'free_throw' && event.details.attempts?.some((a: boolean) => a));

            return (
              <div 
                key={event.id} 
                className={cn(
                  "relative flex flex-col gap-1 p-2 rounded-lg border transition-colors",
                  isOurTeam ? "bg-primary/5 border-primary/10" : "bg-muted/30 border-muted",
                  isScoring && "ring-1 ring-primary/20 bg-primary/10 shadow-sm"
                )}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    {getEventIcon(event.type)}
                    <span className={cn(isOurTeam ? "text-primary" : "text-foreground")}>
                      {getTeamAbbr(event.teamId)}
                    </span>
                    <span>•</span>
                    <span>{event.gameTime}</span>
                    <span>•</span>
                    <span>{event.period <= 4 ? `Q${event.period}` : `OT${event.period - 4}`}</span>
                  </div>
                  <div className="font-mono bg-background px-1.5 py-0.5 rounded border shadow-sm text-foreground">
                    {event.homeScore}-{event.awayScore}
                  </div>
                </div>
                
                <div className="text-sm font-medium leading-tight">
                  {formatEventMessage(event)}
                </div>
                
                {/* Optional marker for the newest event */}
                {index === 0 && (
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                )}
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}

