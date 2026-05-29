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

interface RecentGamesProps {
  games: Game[];
  onBack: () => void;
  onNavigateToGame: (gameId: string) => void;
  onDeleteActiveGame?: (gameId: string) => void;
}

export function RecentGames({
  games,
  onBack,
  onNavigateToGame,
  onDeleteActiveGame,
}: RecentGamesProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'ongoing'>('all');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  
  // Team logo mapping
  const getTeamLogo = (teamName: string) => {
    const logoMap: { [key: string]: string } = {
      'Thunder Bolts': 'https://images.unsplash.com/photo-1682084037329-45a11d86cce7?w=200&h=200&fit=crop',
      'Soaring Eagles': 'https://images.unsplash.com/photo-1761325970487-05c2541653eb?w=200&h=200&fit=crop',
      'City Warriors': 'https://images.unsplash.com/photo-1743105351315-540bce258f1d?w=200&h=200&fit=crop',
      'Rising Phoenix': 'https://images.unsplash.com/photo-1644721133152-55a3a4aa37d2?w=200&h=200&fit=crop'
    };
    return logoMap[teamName] || null;
  };
  
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
            const homeTeamLogo = getTeamLogo(game.homeTeam.name);
            const awayTeamLogo = getTeamLogo(game.awayTeam.name);
            const inProgress = isGameInProgress(game);
            const orphaned = isOrphanedIncompleteGame(game);
            const showIncompleteActions = canDeleteIncompleteGame(game);
            return (
              <Card 
                key={game.id} 
                className="shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => onNavigateToGame(game.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    {/* Game Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        {/* Home Team */}
                        <div className="flex-1 flex items-center justify-end gap-2">
                          <div className="text-right">
                            <div className="font-medium">{game.homeTeam.name}</div>
                            <div className="text-xs text-muted-foreground">{game.homeTeam.abbreviation}</div>
                          </div>
                          {homeTeamLogo && (
                            <img 
                              src={homeTeamLogo} 
                              alt={game.homeTeam.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                        </div>
                        
                        {/* Score */}
                        <div className="flex items-center gap-3 px-6">
                          {game.finalScore ? (
                            <>
                              <div className="text-2xl font-bold">{game.finalScore.home}</div>
                              <div className="text-muted-foreground">-</div>
                              <div className="text-2xl font-bold">{game.finalScore.away}</div>
                            </>
                          ) : inProgress ? (
                            <Badge variant="outline">Live</Badge>
                          ) : (
                            <Badge variant="secondary">Incomplete</Badge>
                          )}
                        </div>
                        
                        {/* Away Team */}
                        <div className="flex-1 flex items-center gap-2">
                          {awayTeamLogo && (
                            <img 
                              src={awayTeamLogo} 
                              alt={game.awayTeam.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                          <div className="text-left">
                            <div className="font-medium">{game.awayTeam.name}</div>
                            <div className="text-xs text-muted-foreground">{game.awayTeam.abbreviation}</div>
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