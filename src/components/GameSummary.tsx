import React, { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Game, Tournament } from '../App';
import { ArrowLeft, Calendar, Clock, Download, Edit, Trash2 } from 'lucide-react';
import { BoxScore } from './BoxScore';
import { ShotChart } from './ShotChart';
import { GameReportOverview } from './GameReportOverview';
import { GameLeadersSection } from './GameLeadersSection';
import { GameTeamLink } from './GameTeamLink';
import { TeamBadge } from './TeamBadge';
import { GameForm } from './forms/GameForm';
import { ErrorBoundary } from './ErrorBoundary';
import { resolveTeamScore } from '../utils/gameDisplay';
import {
  buildGameMetadataPatch,
  getFinalScoreMismatchWarning,
} from '../utils/gameMetadata';
import { deleteGameConfirmDescription } from '../utils/activeGame';
import { downloadGameReportPdf } from '../lib/gameReportPdf';
import { resolveGameMetaLabel } from '../utils/friendlyGame';
import { cn } from './ui/utils';
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

interface GameSummaryProps {
  game: Game;
  tournaments: Tournament[];
  onBack: () => void;
  onGameUpdate: (game: Game) => void;
  onDeleteGame?: () => void;
  onNavigateToPlayer?: (playerId: string, teamId: string) => void;
  onNavigateToTeam?: (teamId: string) => void;
}

export function GameSummary({
  game,
  tournaments,
  onBack,
  onGameUpdate,
  onDeleteGame,
  onNavigateToPlayer,
  onNavigateToTeam,
}: GameSummaryProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const homeScore = resolveTeamScore(game, game.homeTeam.id);
  const awayScore = resolveTeamScore(game, game.awayTeam.id);

  const gameDate = new Date(game.date);
  const isRecent = Date.now() - gameDate.getTime() < 7 * 24 * 60 * 60 * 1000;
  const tournament = game.tournamentId
    ? tournaments.find((t) => t.id === game.tournamentId)
    : undefined;
  const metaLabel = resolveGameMetaLabel(game, tournament?.name);

  const scoreMismatchWarning = useMemo(
    () => getFinalScoreMismatchWarning(game),
    [game]
  );

  const handleEditGameSubmit = useCallback(
    (values: Parameters<typeof buildGameMetadataPatch>[1]) => {
      onGameUpdate(buildGameMetadataPatch(game, values));
      setIsEditDialogOpen(false);
    },
    [game, onGameUpdate]
  );

  const handleExportPdf = useCallback(() => {
    downloadGameReportPdf(game, tournaments);
  }, [game, tournaments]);

  const hasShotChart = game.shots.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-center gap-3">
          {isRecent && (
            <Badge variant="secondary" className="px-3 py-1">
              Recent Game
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            title="Export box score PDF"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Game
          </Button>
          {onDeleteGame && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              title="Delete this game"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Game Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Game Summary</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {metaLabel && <span>{metaLabel}</span>}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {gameDate.toLocaleDateString()}
              </div>
              {game.startTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {game.startTime}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-start justify-center gap-8 sm:gap-12">
            {/* Home Team */}
            <div className="text-center space-y-3 flex-1 min-w-0">
              <TeamBadge
                team={game.homeTeam}
                teamId={game.homeTeam.id}
                size="xl"
                className="mx-auto"
              />
              <GameTeamLink
                teamId={game.homeTeam.id}
                teamName={game.homeTeam.name}
                onNavigateToTeam={onNavigateToTeam}
                className="text-xl font-medium leading-snug break-words block w-full text-center"
              />
              <div className="text-4xl font-bold tabular-nums">{homeScore}</div>
            </div>
            
            {/* VS */}
            <div className="text-2xl font-light text-muted-foreground pt-8 shrink-0">VS</div>
            
            {/* Away Team */}
            <div className="text-center space-y-3 flex-1 min-w-0">
              <TeamBadge
                team={game.awayTeam}
                teamId={game.awayTeam.id}
                size="xl"
                className="mx-auto"
              />
              <GameTeamLink
                teamId={game.awayTeam.id}
                teamName={game.awayTeam.name}
                onNavigateToTeam={onNavigateToTeam}
                className="text-xl font-medium leading-snug break-words block w-full text-center"
              />
              <div className="text-4xl font-bold tabular-nums">{awayScore}</div>
            </div>
          </div>
          
          {/* Game Status */}
          <div className="text-center mt-6">
            <Badge variant="outline" className="px-4 py-2">
              {game.isActive ? 'In Progress' : 'Final'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <GameLeadersSection game={game} onNavigateToPlayer={onNavigateToPlayer} />

      {/* Game Details Tabs */}
      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList
          className={cn(
            'grid w-full',
            hasShotChart ? 'grid-cols-3' : 'grid-cols-2'
          )}
        >
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="box-score">Box Score</TabsTrigger>
          {hasShotChart && <TabsTrigger value="shot-chart">Shot Chart</TabsTrigger>}
        </TabsList>

        <div className="space-y-6">
          <TabsContent value="summary" className="space-y-6">
            <GameReportOverview
              game={game}
              tournaments={tournaments}
              onNavigateToPlayer={onNavigateToPlayer}
            />
          </TabsContent>

          <TabsContent value="box-score" className="space-y-6">
            <BoxScore
              game={game}
              onNavigateToPlayer={onNavigateToPlayer}
              onNavigateToTeam={onNavigateToTeam}
            />
          </TabsContent>

          {hasShotChart && (
            <TabsContent value="shot-chart" className="space-y-6">
              <ShotChart game={game} />
            </TabsContent>
          )}
        </div>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Game Details</DialogTitle>
            <DialogDescription>
              Update game date, time, tournament, or final score.
            </DialogDescription>
          </DialogHeader>
          <ErrorBoundary>
            <GameForm
              key={String(isEditDialogOpen)}
              game={game}
              tournaments={tournaments}
              isCompleted={game.isCompleted}
              scoreMismatchWarning={scoreMismatchWarning}
              onSubmit={handleEditGameSubmit}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          </ErrorBoundary>
        </DialogContent>
      </Dialog>

      {onDeleteGame && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this game?</AlertDialogTitle>
              <AlertDialogDescription>{deleteGameConfirmDescription(game)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  onDeleteGame();
                }}
              >
                Delete game
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
