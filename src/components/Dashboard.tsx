import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Trophy, Users, Clock, Plus, ChevronRight, BarChart3, Target, Calendar } from 'lucide-react';
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
  onNavigateToTeam
}: DashboardProps) {
  return (
    <div className="space-y-8">
      {/* Header with Centralized Logo */}
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-4">
          <BarChart3 className="w-16 h-16 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">RunItBack</h1>
            <p className="text-lg text-muted-foreground">Basketball Stats Tracker</p>
          </div>
        </div>
        
        {/* Primary Action */}
        <Button onClick={onStartNewGame} size="lg" className="px-8 py-3 text-lg">
          <Plus className="mr-2 h-5 w-5" />
          Start a New Game
        </Button>
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Tournaments Section */}
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Tournaments
            </CardTitle>
            <CardDescription>
              Organize and manage your basketball tournaments
            </CardDescription>
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
                <h4 className="text-sm font-medium">Recent Tournaments</h4>
                {tournaments.slice(0, 3).map(tournament => (
                  <div 
                    key={tournament.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => onNavigateToTournament(tournament.id)}
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
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={onNavigateToTournaments}
            >
              {tournaments.length > 0 ? 'Manage Tournaments' : 'Create Tournament'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Teams Section */}
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teams
            </CardTitle>
            <CardDescription>
              Create and manage your basketball teams
            </CardDescription>
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
                <h4 className="text-sm font-medium">Recent Teams</h4>
                {teams.slice(0, 3).map(team => (
                  <div 
                    key={team.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => onNavigateToTeam(team.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">
                          {team.icon || team.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{team.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {team.players.length} Players
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={onNavigateToTeams}
            >
              {teams.length > 0 ? 'Manage Teams' : 'Create Team'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Latest Games Section */}
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Latest Games
            </CardTitle>
            <CardDescription>
              View recent games and statistics
            </CardDescription>
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
                <h4 className="text-sm font-medium">Recent Games</h4>
                {recentGames.slice(0, 3).map(game => (
                  <div 
                    key={game.id}
                    className="p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => onNavigateToGameSummary(game)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {game.homeTeam.name} vs {game.awayTeam.name}
                      </div>
                      {game.finalScore && (
                        <Badge variant="outline" className="text-xs">
                          {game.finalScore.home}-{game.finalScore.away}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(game.date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => {/* Could add a "View All Games" page */}}
            >
              {recentGames.length > 0 ? 'View All Games' : 'No Games Yet'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Empty State for New Users */}
      {tournaments.length === 0 && teams.length === 0 && recentGames.length === 0 && (
        <Card className="text-center p-12 shadow-lg rounded-2xl">
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center">
              <Target className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-medium">Welcome to RunItBack</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Get started by creating your first team, setting up a tournament, 
                or jumping straight into tracking a game.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={onNavigateToTeams}>
                <Users className="mr-2 h-4 w-4" />
                Create a Team
              </Button>
              <Button variant="outline" onClick={onNavigateToTournaments}>
                <Trophy className="mr-2 h-4 w-4" />
                Start Tournament
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}