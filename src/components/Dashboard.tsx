import React, { useMemo } from 'react';
import { sortTournamentsByDateDesc } from '../utils/tournamentSort';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Trophy, Users, Calendar, ChevronRight } from 'lucide-react';
import { Tournament, Team, Game } from '../App';
import { TeamBadge } from './TeamBadge';
import { TournamentBadge } from './TournamentBadge';
import { DashboardStatCard } from './dashboard/DashboardStatCard';
import { DashboardGamePreview } from './dashboard/DashboardGamePreview';

const DASHBOARD_PREVIEW_LIMIT = 3;

interface DashboardProps {
  tournaments: Tournament[];
  teams: Team[];
  recentGames: Game[];
  onNavigateToTournaments: () => void;
  onNavigateToTeams: () => void;
  onNavigateToGameSummary: (game: Game) => void;
  onStartNewGame: () => void;
  onNavigateToTournament: (tournamentId: string) => void;
  onNavigateToTeam: (teamId: string) => void;
  onNavigateToRecentGames: () => void;
}

function getCreatedAtMs(item: { id: string; createdAt?: string }): number {
  if (item.createdAt) {
    const parsed = Date.parse(item.createdAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const match = item.id.match(/-(\d{10,})$/);
  if (match) return Number(match[1]);
  return 0;
}

export function Dashboard({
  tournaments,
  teams,
  recentGames,
  onNavigateToTournaments,
  onNavigateToTeams,
  onNavigateToGameSummary,
  onNavigateToTournament,
  onNavigateToTeam,
  onNavigateToRecentGames,
}: DashboardProps) {
  const recentTournaments = useMemo(
    () => sortTournamentsByDateDesc(tournaments).slice(0, DASHBOARD_PREVIEW_LIMIT),
    [tournaments]
  );
  const recentTeams = useMemo(
    () =>
      [...teams]
        .sort((a, b) => {
          const byPlayers = b.players.length - a.players.length;
          if (byPlayers !== 0) return byPlayers;
          return getCreatedAtMs(b) - getCreatedAtMs(a);
        })
        .slice(0, DASHBOARD_PREVIEW_LIMIT),
    [teams]
  );
  const previewGames = recentGames.slice(0, 3);

  const tournamentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tournaments) {
      map.set(t.id, t.name);
    }
    return map;
  }, [tournaments]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashboardStatCard
          icon={Trophy}
          title="Tournaments"
          count={tournaments.length}
          countLabel={
            tournaments.length === 1 ? 'Active Tournament' : 'Active Tournaments'
          }
          onClick={onNavigateToTournaments}
        >
          {recentTournaments.length > 0 && (
            <div className="space-y-1">
              {recentTournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToTournament(tournament.id);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TournamentBadge
                      tournament={tournament}
                      tournamentId={tournament.id}
                      size="sm"
                    />
                    <span className="text-sm font-medium truncate">{tournament.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {tournament.teams.length} Teams
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DashboardStatCard>

        <DashboardStatCard
          icon={Users}
          title="Teams"
          count={teams.length}
          countLabel={teams.length === 1 ? 'Team Created' : 'Teams Created'}
          onClick={onNavigateToTeams}
        >
          {recentTeams.length > 0 && (
            <div className="space-y-1">
              {recentTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToTeam(team.id);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamBadge team={team} teamId={team.id} size="sm" />
                    <span className="text-sm font-medium truncate">{team.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {team.players.length} Players
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DashboardStatCard>
      </div>

      <Card className="shadow-md rounded-2xl">
        <CardHeader
          className="pb-2 cursor-pointer rounded-t-2xl transition-colors hover:bg-muted/40"
          onClick={onNavigateToRecentGames}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="h-5 w-5 text-primary" />
              Latest Games
            </CardTitle>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              View all
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
          <p className="text-sm text-muted-foreground pt-1">
            {recentGames.length}{' '}
            {recentGames.length === 1 ? 'game' : 'games'} completed
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {previewGames.length > 0 ? (
            previewGames
              .map((game) => (
                <DashboardGamePreview
                  key={game.id}
                  game={game}
                  teams={teams}
                  tournamentName={
                    game.tournamentId
                      ? tournamentNameById.get(game.tournamentId)
                      : undefined
                  }
                  onClick={() => onNavigateToGameSummary(game)}
                />
              ))
              .filter((node) => node != null)
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No completed games yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
