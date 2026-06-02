import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowLeft, Calendar, Filter, Play, Trash2 } from 'lucide-react';
import { Game } from '../App';
import {
  canDeleteIncompleteGame,
  isGameInProgress,
  isOrphanedIncompleteGame,
} from '../utils/activeGame';
import { resolveTeamScore } from '../utils/gameDisplay';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { TeamBadge } from './TeamBadge';
import { resolveGameTeam } from '../utils/gameTeams';

interface RecentGamesProps {
  games: Game[];
  teams?: Team[];
  onBack: () => void;
  onNavigateToGame: (gameId: string) => void;
  onDeleteActiveGame?: (gameId: string) => void;
}

export function RecentGames({
  games,
  teams = [],
  onBack,
  onNavigateToGame,
  onDeleteActiveGame,
}: RecentGamesProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'ongoing'>('all');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  
  // Sort games by date (most recent first)
  const sortedGames = [...games].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // Filter games based on status
  const filteredGames = sortedGames.filter(game => {
    if (filterStatus === 'completed') return game.isCompleted;
    if (filterStatus === 'ongoing') {
      return isGameInProgress(game) || isOrphanedIncompleteGame(game);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Recent Games
            </h1>
            <p className="text-sm text-muted-foreground">
              {filteredGames.length} {filteredGames.length === 1 ? 'game' : 'games'} {filterStatus !== 'all' && `(${filterStatus})`}
            </p>
          </div>
        </div>
        
        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              All
            </Button>
            <Button
              variant={filterStatus === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('completed')}
            >
              Completed
            </Button>
            <Button
              variant={filterStatus === 'ongoing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('ongoing')}
            >
              Ongoing
            </Button>
          </div>
        </div>
      </div>

      {/* Games List */}
      <div className="space-y-4">
        {filteredGames.length === 0 ? (
          <Card className="shadow-lg rounded-2xl">
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No {filterStatus !== 'all' && filterStatus} games found
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredGames.map((game) => {
            const homeTeam = resolveGameTeam(teams, game, 'home');
            const awayTeam = resolveGameTeam(teams, game, 'away');
            const homeScore = resolveTeamScore(game, homeTeam.id);
            const awayScore = resolveTeamScore(game, awayTeam.id);
            const inProgress = isGameInProgress(game);
            const orphaned = isOrphanedIncompleteGame(game);
            const showIncompleteActions = canDeleteIncompleteGame(game);
            return (
              <Card 
                key={game.id} 
                className="shadow-lg rounded-2xl cursor-pointer transition-all hover:bg-muted/40 hover:shadow-xl"
                onClick={() => onNavigateToGame(game.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    {/* Game Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        {/* Home Team */}
                        <div className="flex-1 flex items-start justify-end gap-2">
                          <div className="text-right">
                            <div className="font-medium">{homeTeam.name}</div>
                            {game.isCompleted && (
                              <div className="text-2xl font-bold tabular-nums mt-1">{homeScore}</div>
                            )}
                          </div>
                          <TeamBadge team={homeTeam} teamId={homeTeam.id} size="lg" />
                        </div>
                        
                        {/* Status */}
                        <div className="flex items-center px-4 shrink-0">
                          {inProgress ? (
                            <Badge variant="outline">Live</Badge>
                          ) : !game.isCompleted ? (
                            <Badge variant="secondary">Incomplete</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm" aria-hidden>
                              vs
                            </span>
                          )}
                        </div>
                        
                        {/* Away Team */}
                        <div className="flex-1 flex items-start gap-2">
                          <TeamBadge team={awayTeam} teamId={awayTeam.id} size="lg" />
                          <div className="text-left">
                            <div className="font-medium">{awayTeam.name}</div>
                            {game.isCompleted && (
                              <div className="text-2xl font-bold tabular-nums mt-1">{awayScore}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Date & Status */}
                      <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground">
                        <span>{new Date(game.date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}</span>
                        {game.tournamentId && (
                          <>
                            <span>•</span>
                            <span>Tournament Game</span>
                          </>
                        )}
                        {game.isCompleted && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">Final</Badge>
                          </>
                        )}
                      </div>

                      {showIncompleteActions && (
                        <div
                          className="flex flex-wrap gap-2 mt-4 justify-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {inProgress && (
                            <Button
                              size="sm"
                              onClick={() => onNavigateToGame(game.id)}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Resume
                            </Button>
                          )}
                          {onDeleteActiveGame && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTargetId(game.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this game?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the in-progress game and all stats recorded so far.
              Setup-created teams and their players are removed. Players you added to an
              existing team during setup are removed too. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId && onDeleteActiveGame) {
                  onDeleteActiveGame(deleteTargetId);
                }
                setDeleteTargetId(null);
              }}
            >
              Delete game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}