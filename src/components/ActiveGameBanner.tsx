import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import type { Game, Tournament } from '../App';
import { Play, Pause, CalendarDays } from 'lucide-react';
import { resolveGameMetaLabel } from '../utils/friendlyGame';

interface ActiveGameBannerProps {
  game: Game;
  tournament?: Tournament;
  onResume: () => void;
  onPause?: () => void;
}

export function ActiveGameBanner({
  game,
  tournament,
  onResume,
  onPause,
}: ActiveGameBannerProps) {
  const matchup = `${game.homeTeam.abbreviation || game.homeTeam.name} vs ${
    game.awayTeam.abbreviation || game.awayTeam.name
  }`;
  const score = `${game.teamStats.home.total_points} – ${game.teamStats.away.total_points}`;
  const metaLabel = resolveGameMetaLabel(game, tournament?.name);

  return (
    <Card className="shadow-lg rounded-2xl border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">Game in progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="font-medium text-xl">{matchup}</p>
          <p className="text-muted-foreground">Score: {score}</p>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {game.date && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                {game.date}
              </span>
            )}
            {metaLabel && <span>{metaLabel}</span>}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Pause this game to free the slot and start another. Resume anytime from
          Ongoing games.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button size="lg" className="w-full sm:w-auto" onClick={onResume}>
            <Play className="w-4 h-4 mr-2" />
            Resume game
          </Button>
          {onPause && (
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={onPause}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause game
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
