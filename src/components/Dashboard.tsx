import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Trophy, Users, Calendar } from 'lucide-react';
import { Tournament, Team, Game } from '../App';

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

export function Dashboard({ 
  tournaments, 
  teams, 
  recentGames, 
  onNavigateToTournaments,
  onNavigateToTeams,
  onNavigateToGameSummary,
  onStartNewGame,
  onNavigateToTournament,
  onNavigateToTeam,
  onNavigateToRecentGames
}: DashboardProps) {
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

  return (
    <div className="space-y-8">
      {/* Main Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Tournaments Section */}
        <Card 
          className="shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-shadow"
          onClick={onNavigateToTournaments}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5" />
              Tournaments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{tournaments.length}</div>
              <p className="text-sm text-muted-foreground">
                Active {tournaments.length === 1 ? 'Tournament' : 'Tournaments'}
              </p>
            </div>
            
            {tournaments.length > 0 && (
              <div className="space-y-2">
                {tournaments.slice(0, 3).map(tournament => (
                  <div 
                    key={tournament.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToTournament(tournament.id);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">
                          {tournament.icon || tournament.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{tournament.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {tournament.teams.length} Teams
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teams Section */}
        <Card 
          className="shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-shadow"
          onClick={onNavigateToTeams}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5" />
              Teams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{teams.length}</div>
              <p className="text-sm text-muted-foreground">
                {teams.length === 1 ? 'Team' : 'Teams'} Created
              </p>
            </div>
            
            {teams.length > 0 && (
              <div className="space-y-2">
                {teams.slice(0, 3).map(team => {
                  const teamLogo = getTeamLogo(team.name);
                  return (
                    <div 
                      key={team.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToTeam(team.id);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {teamLogo ? (
                          <img 
                            src={teamLogo} 
                            alt={team.name}
                            className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs">
                              {team.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <span className="text-sm font-medium">{team.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {team.players.length} Players
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest Games Section */}
        <Card 
          className="shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-shadow"
          onClick={onNavigateToRecentGames}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Calendar className="h-5 w-5" />
              Latest Games
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{recentGames.length}</div>
              <p className="text-sm text-muted-foreground">
                {recentGames.length === 1 ? 'Game' : 'Games'} Completed
              </p>
            </div>
            
            {recentGames.length > 0 && (
              <div className="space-y-2">
                {recentGames.slice(0, 3).map(game => {
                  const homeTeamLogo = getTeamLogo(game.homeTeam.name);
                  const awayTeamLogo = getTeamLogo(game.awayTeam.name);
                  return (
                    <div 
                      key={game.id}
                      className="p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToGameSummary(game);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {homeTeamLogo && (
                            <img 
                              src={homeTeamLogo} 
                              alt={game.homeTeam.name}
                              className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                            />
                          )}
                          <span className="text-sm font-medium truncate">{game.homeTeam.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">vs</span>
                          {awayTeamLogo && (
                            <img 
                              src={awayTeamLogo} 
                              alt={game.awayTeam.name}
                              className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                            />
                          )}
                          <span className="text-sm font-medium truncate">{game.awayTeam.name}</span>
                        </div>
                        {game.finalScore && (
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {game.finalScore.home}-{game.finalScore.away}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(game.date).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}