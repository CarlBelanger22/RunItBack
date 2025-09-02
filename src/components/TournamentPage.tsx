import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tournament, Team, Game, Player, GameStats } from '../App';
import { MetricsCalculator } from './MetricsCalculator';
import { 
  Trophy, 
  Users, 
  BarChart3, 
  User, 
  ArrowLeft,
  Calendar,
  Target,
  Activity,
  TrendingUp,
  Medal,
  Crown,
  Star,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from 'lucide-react';

interface TournamentPageProps {
  tournament: Tournament;
  teams: Team[];
  games: Game[];
  activeTab: 'home' | 'teams' | 'standings' | 'players';
  onTabChange: (tab: 'home' | 'teams' | 'standings' | 'players') => void;
  onBack: () => void;
  onNavigateToTeam: (teamId: string) => void;
  onNavigateToPlayer: (playerId: string) => void;
  onNavigateToGame: (gameId: string) => void;
  onCreateTeam: (teamData: Omit<Team, 'id'>) => void;
  onAddTeamToTournament: (teamId: string, tournamentId: string) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
}

export function TournamentPage({ 
  tournament, 
  teams, 
  games, 
  activeTab, 
  onTabChange, 
  onBack,
  onNavigateToTeam,
  onNavigateToPlayer,
  onNavigateToGame,
  onCreateTeam,
  onAddTeamToTournament,
  onUpdateTeam,
  onDeleteTeam
}: TournamentPageProps) {
  
  // Get tournament teams
  const tournamentTeams = teams.filter(team => tournament.teams.includes(team.id));
  
  // Get tournament games
  const tournamentGames = games.filter(game => tournament.games.includes(game.id));
  
  // Calculate tournament standings
  const calculateStandings = () => {
    const standings = tournamentTeams.map(team => {
      const teamGames = tournamentGames.filter(game => 
        game.homeTeamId === team.id || game.awayTeamId === team.id
      );
      
      let wins = 0;
      let losses = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;
      
      teamGames.forEach(game => {
        if (!game.finalScore) return;
        
        const isHome = game.homeTeamId === team.id;
        const teamScore = isHome ? game.finalScore.home : game.finalScore.away;
        const opponentScore = isHome ? game.finalScore.away : game.finalScore.home;
        
        pointsFor += teamScore;
        pointsAgainst += opponentScore;
        
        if (teamScore > opponentScore) wins++;
        else losses++;
      });
      
      const gamesPlayed = wins + losses;
      const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
      const pointsDiff = gamesPlayed > 0 ? (pointsFor - pointsAgainst) / gamesPlayed : 0; // Per-game average
      const ppg = gamesPlayed > 0 ? pointsFor / gamesPlayed : 0;
      const papg = gamesPlayed > 0 ? pointsAgainst / gamesPlayed : 0;
      
      return {
        team,
        wins,
        losses,
        gamesPlayed,
        winPercentage,
        pointsFor,
        pointsAgainst,
        pointsDiff,
        ppg,
        papg
      };
    });
    
    return standings.sort((a, b) => {
      if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
      return b.pointsDiff - a.pointsDiff;
    });
  };
  
  // Get tournament leaders
  const getTournamentLeaders = () => {
    const allPlayerStats: Array<{ player: Player; team: Team; stats: GameStats }> = [];
    
    tournamentGames.forEach(game => {
      game.gameStats.forEach(stat => {
        const playerTeam = tournamentTeams.find(team => 
          team.players.some(p => p.id === stat.playerId)
        );
        const player = playerTeam?.players.find(p => p.id === stat.playerId);
        
        if (player && playerTeam) {
          allPlayerStats.push({ player, team: playerTeam, stats: stat });
        }
      });
    });
    
    // Aggregate stats by player
    const playerTotals = new Map<string, { 
      player: Player; 
      team: Team; 
      totalStats: GameStats; 
      gamesPlayed: number; 
    }>();
    
    allPlayerStats.forEach(({ player, team, stats }) => {
      const existing = playerTotals.get(player.id);
      if (existing) {
        // Aggregate stats
        Object.keys(stats).forEach(key => {
          if (key !== 'playerId' && typeof stats[key as keyof GameStats] === 'number') {
            (existing.totalStats as any)[key] += (stats as any)[key];
          }
        });
        existing.gamesPlayed++;
      } else {
        playerTotals.set(player.id, {
          player,
          team,
          totalStats: { ...stats },
          gamesPlayed: 1
        });
      }
    });
    
    const playersArray = Array.from(playerTotals.values());
    
    return {
      points: playersArray.sort((a, b) => (b.totalStats.points / b.gamesPlayed) - (a.totalStats.points / a.gamesPlayed)).slice(0, 5),
      rebounds: playersArray.sort((a, b) => ((b.totalStats.orb + b.totalStats.drb) / b.gamesPlayed) - ((a.totalStats.orb + a.totalStats.drb) / a.gamesPlayed)).slice(0, 5),
      assists: playersArray.sort((a, b) => (b.totalStats.assists / b.gamesPlayed) - (a.totalStats.assists / a.gamesPlayed)).slice(0, 5),
      steals: playersArray.sort((a, b) => (b.totalStats.steals / b.gamesPlayed) - (a.totalStats.steals / a.gamesPlayed)).slice(0, 5),
      blocks: playersArray.sort((a, b) => (b.totalStats.blocks / b.gamesPlayed) - (a.totalStats.blocks / a.gamesPlayed)).slice(0, 5),
    };
  };

  // Calculate additional team stats for standings
  const calculateStandingsWithExtendedStats = () => {
    return standings.map(standing => {
      const teamTotalStats = tournamentGames.reduce((acc, game) => {
        let teamStats = null;
        if (game.homeTeamId === standing.team.id) {
          teamStats = game.teamStats.home;
        } else if (game.awayTeamId === standing.team.id) {
          teamStats = game.teamStats.away;
        }
        
        if (teamStats) {
          return {
            fg_made: acc.fg_made + teamStats.fg_made,
            fg_attempted: acc.fg_attempted + teamStats.fg_attempted,
            three_made: acc.three_made + teamStats.three_made,
            three_attempted: acc.three_attempted + teamStats.three_attempted,
            ft_made: acc.ft_made + teamStats.ft_made,
            ft_attempted: acc.ft_attempted + teamStats.ft_attempted,
            orb: acc.orb + teamStats.orb,
            drb: acc.drb + teamStats.drb,
            assists: acc.assists + teamStats.assists,
          };
        }
        return acc;
      }, {
        fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0,
        ft_made: 0, ft_attempted: 0, orb: 0, drb: 0, assists: 0
      });

      const rpg = standing.gamesPlayed > 0 ? (teamTotalStats.orb + teamTotalStats.drb) / standing.gamesPlayed : 0;
      const apg = standing.gamesPlayed > 0 ? teamTotalStats.assists / standing.gamesPlayed : 0;
      const fgPct = teamTotalStats.fg_attempted > 0 ? (teamTotalStats.fg_made / teamTotalStats.fg_attempted) * 100 : 0;
      const threePct = teamTotalStats.three_attempted > 0 ? (teamTotalStats.three_made / teamTotalStats.three_attempted) * 100 : 0;
      const ftPct = teamTotalStats.ft_attempted > 0 ? (teamTotalStats.ft_made / teamTotalStats.ft_attempted) * 100 : 0;

      return {
        ...standing,
        rpg,
        apg,
        fgPct,
        threePct,
        ftPct
      };
    });
  };
  
  const standings = calculateStandings();
  const leaders = getTournamentLeaders();
  const extendedStandings = calculateStandingsWithExtendedStats();
  
  // Team creation state
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [isAddTeamDialogOpen, setIsAddTeamDialogOpen] = useState(false);
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    abbreviation: '',
    description: '',
    players: [] as Array<{ name: string; number: string; position: string }>
  });

  // Players table sorting state
  const [sortField, setSortField] = useState<string>('PPG');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Get teams not in tournament
  const availableTeams = teams.filter(team => !tournament.teams.includes(team.id));
  
  const HomeTab = () => (
    <div className="space-y-6">
      {/* Tournament Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {tournament.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{tournamentTeams.length}</div>
              <div className="text-sm text-muted-foreground">Teams</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{tournamentGames.length}</div>
              <div className="text-sm text-muted-foreground">Games</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{tournament.year}</div>
              <div className="text-sm text-muted-foreground">{tournament.month}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {tournamentGames.filter(g => g.isCompleted).length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary Standings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Standings
              </div>
              <Button variant="ghost" size="sm" onClick={() => onTabChange('standings')}>
                View All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {standings.slice(0, 5).map((standing, index) => (
                <div key={standing.team.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => onNavigateToTeam(standing.team.id)}>
                  <div className="flex items-center gap-3">
                    <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="font-medium">{standing.team.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {standing.wins}-{standing.losses}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Games */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tournamentGames.slice().reverse().slice(0, 5).map(game => (
                <div 
                  key={game.id} 
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => onNavigateToGame(game.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{game.homeTeam.name}</span>
                    <span className="text-xs text-muted-foreground">vs</span>
                    <span className="text-sm">{game.awayTeam.name}</span>
                  </div>
                  {game.finalScore && (
                    <Badge variant="outline" className="text-xs">
                      {game.finalScore.home}-{game.finalScore.away}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaders - Improved Layout */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { title: 'Points', data: leaders.points, icon: Target, key: 'points' },
          { title: 'Rebounds', data: leaders.rebounds, icon: Activity, key: 'rebounds' },
          { title: 'Assists', data: leaders.assists, icon: Users, key: 'assists' },
          { title: 'Steals', data: leaders.steals, icon: TrendingUp, key: 'steals' },
          { title: 'Blocks', data: leaders.blocks, icon: Crown, key: 'blocks' }
        ].map(({ title, data, icon: Icon, key }) => (
          <Card key={key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {data.slice(0, 5).map((player, index) => (
                <div 
                  key={player.player.id}
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                  onClick={() => onNavigateToPlayer(player.player.id)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant={index === 0 ? "default" : "outline"} className="w-5 h-5 p-0 text-xs flex-shrink-0">
                      {index + 1}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate" title={player.player.name}>
                        {player.player.name}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold ml-2 flex-shrink-0">
                    {key === 'points' ? (player.totalStats.points / player.gamesPlayed).toFixed(1) : 
                     key === 'rebounds' ? ((player.totalStats.orb + player.totalStats.drb) / player.gamesPlayed).toFixed(1) :
                     key === 'assists' ? (player.totalStats.assists / player.gamesPlayed).toFixed(1) :
                     key === 'steals' ? (player.totalStats.steals / player.gamesPlayed).toFixed(1) :
                     (player.totalStats.blocks / player.gamesPlayed).toFixed(1)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const resetTeamForm = () => {
    setTeamFormData({
      name: '',
      abbreviation: '',
      description: '',
      players: []
    });
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    
    const players = teamFormData.players.map((player, index) => ({
      id: `player-${Date.now()}-${index}`,
      name: player.name,
      number: parseInt(player.number),
      position: player.position
    }));

    const teamData = {
      name: teamFormData.name,
      abbreviation: teamFormData.abbreviation.toUpperCase() || teamFormData.name.substring(0, 3).toUpperCase(),
      description: teamFormData.description,
      players,
      currentTournamentId: tournament.id
    };

    onCreateTeam(teamData);
    setIsCreateTeamDialogOpen(false);
    resetTeamForm();
  };

  const addPlayer = () => {
    setTeamFormData(prev => ({
      ...prev,
      players: [...prev.players, { name: '', number: '', position: 'Guard' }]
    }));
  };

  const updatePlayer = (index: number, field: string, value: string) => {
    setTeamFormData(prev => ({
      ...prev,
      players: prev.players.map((player, i) => 
        i === index ? { ...player, [field]: value } : player
      )
    }));
  };

  const removePlayer = (index: number) => {
    setTeamFormData(prev => ({
      ...prev,
      players: prev.players.filter((_, i) => i !== index)
    }));
  };

  const TeamsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Tournament Teams</h3>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{tournamentTeams.length} Teams</Badge>
          
          {availableTeams.length > 0 && (
            <Dialog open={isAddTeamDialogOpen} onOpenChange={setIsAddTeamDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Team to Tournament</DialogTitle>
                  <DialogDescription>
                    Select an existing team to add to this tournament.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {availableTeams.map(team => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        onAddTeamToTournament(team.id, tournament.id);
                        setIsAddTeamDialogOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {team.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{team.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {team.players.length} players
                          </div>
                        </div>
                      </div>
                      <Button size="sm">Add</Button>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          <Dialog open={isCreateTeamDialogOpen} onOpenChange={setIsCreateTeamDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create New Team
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>
                  Create a new team for this tournament. You can add players now or later.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    value={teamFormData.name}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter team name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamAbbreviation">Team Abbreviation</Label>
                  <Input
                    id="teamAbbreviation"
                    value={teamFormData.abbreviation}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, abbreviation: e.target.value.toUpperCase() }))}
                    placeholder="3-letter abbreviation (e.g. LAL)"
                    maxLength={3}
                    className="uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamDescription">Description (Optional)</Label>
                  <Textarea
                    id="teamDescription"
                    value={teamFormData.description}
                    onChange={(e) => setTeamFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter team description"
                    rows={2}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Players (Optional)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addPlayer}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Player
                    </Button>
                  </div>
                  
                  {teamFormData.players.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No players added yet. You can add players now or after creating the team.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {teamFormData.players.map((player, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5">
                            <Input
                              placeholder="Player name"
                              value={player.name}
                              onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                              required
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              placeholder="#"
                              type="number"
                              min="0"
                              max="99"
                              value={player.number}
                              onChange={(e) => updatePlayer(index, 'number', e.target.value)}
                              required
                            />
                          </div>
                          <div className="col-span-4">
                            <select
                              className="w-full px-3 py-1 text-sm border border-border rounded-md bg-background"
                              value={player.position}
                              onChange={(e) => updatePlayer(index, 'position', e.target.value)}
                            >
                              <option value="Point Guard">Point Guard</option>
                              <option value="Shooting Guard">Shooting Guard</option>
                              <option value="Small Forward">Small Forward</option>
                              <option value="Power Forward">Power Forward</option>
                              <option value="Center">Center</option>
                              <option value="Guard">Guard</option>
                              <option value="Forward">Forward</option>
                            </select>
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePlayer(index)}
                              className="h-8 w-8 p-0"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsCreateTeamDialogOpen(false);
                      resetTeamForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    Create Team
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournamentTeams.map(team => {
          const teamStanding = standings.find(s => s.team.id === team.id);
          return (
            <Card 
              key={team.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onNavigateToTeam(team.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      {team.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{team.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {team.players.length} players
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamStanding && (
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <div className="font-bold">{teamStanding.wins}-{teamStanding.losses}</div>
                      <div className="text-xs text-muted-foreground">Record</div>
                    </div>
                    <div>
                      <div className="font-bold">{teamStanding.ppg.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">PPG</div>
                    </div>
                    <div>
                      <div className="font-bold">
                        {teamStanding.pointsDiff >= 0 ? '+' : ''}{teamStanding.pointsDiff.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">DIFF</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty state for when no teams exist */}
      {tournamentTeams.length === 0 && (
        <Card className="text-center p-12">
          <CardContent className="space-y-4">
            <Users className="h-16 w-16 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-medium">No teams in tournament</h3>
              <p className="text-muted-foreground">
                Add teams to this tournament to start tracking games and statistics.
              </p>
            </div>
            <Button onClick={() => setIsCreateTeamDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Team
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const StandingsTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tournament Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-center">W</TableHead>
                  <TableHead className="text-center">L</TableHead>
                  <TableHead className="text-center">PCT</TableHead>
                  <TableHead className="text-center">PPG</TableHead>
                  <TableHead className="text-center">PAPG</TableHead>
                  <TableHead className="text-center">DIFF</TableHead>
                  <TableHead className="text-center">RPG</TableHead>
                  <TableHead className="text-center">APG</TableHead>
                  <TableHead className="text-center">FG%</TableHead>
                  <TableHead className="text-center">3P%</TableHead>
                  <TableHead className="text-center">FT%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extendedStandings.map((standing, index) => (
                  <TableRow 
                    key={standing.team.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onNavigateToTeam(standing.team.id)}
                  >
                    <TableCell>
                      <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                        {index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{standing.team.name}</TableCell>
                    <TableCell className="text-center">{standing.wins}</TableCell>
                    <TableCell className="text-center">{standing.losses}</TableCell>
                    <TableCell className="text-center">{(standing.winPercentage / 100).toFixed(3)}</TableCell>
                    <TableCell className="text-center">{standing.ppg.toFixed(1)}</TableCell>
                    <TableCell className="text-center">{standing.papg.toFixed(1)}</TableCell>
                    <TableCell className="text-center">
                      <span className={standing.pointsDiff >= 0 ? "text-green-600" : "text-red-600"}>
                        {standing.pointsDiff >= 0 ? '+' : ''}{standing.pointsDiff.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{standing.rpg.toFixed(1)}</TableCell>
                    <TableCell className="text-center">{standing.apg.toFixed(1)}</TableCell>
                    <TableCell className="text-center">{standing.fgPct.toFixed(1)}%</TableCell>
                    <TableCell className="text-center">{standing.threePct.toFixed(1)}%</TableCell>
                    <TableCell className="text-center">{standing.ftPct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Enhanced Players Tab with all players and improved sorting
  const PlayersTab = () => {
    // Get all players from tournament teams with their stats
    const getAllPlayersWithStats = () => {
      const allPlayerStats: Array<{ player: Player; team: Team; stats: GameStats }> = [];
      
      tournamentGames.forEach(game => {
        game.gameStats.forEach(stat => {
          const playerTeam = tournamentTeams.find(team => 
            team.players.some(p => p.id === stat.playerId)
          );
          const player = playerTeam?.players.find(p => p.id === stat.playerId);
          
          if (player && playerTeam) {
            allPlayerStats.push({ player, team: playerTeam, stats: stat });
          }
        });
      });
      
      // Aggregate stats by player
      const playerTotals = new Map<string, { 
        player: Player; 
        team: Team; 
        totalStats: GameStats; 
        gamesPlayed: number; 
      }>();
      
      allPlayerStats.forEach(({ player, team, stats }) => {
        const existing = playerTotals.get(player.id);
        if (existing) {
          // Aggregate stats
          Object.keys(stats).forEach(key => {
            if (key !== 'playerId' && typeof stats[key as keyof GameStats] === 'number') {
              (existing.totalStats as any)[key] += (stats as any)[key];
            }
          });
          existing.gamesPlayed++;
        } else {
          playerTotals.set(player.id, {
            player,
            team,
            totalStats: { ...stats },
            gamesPlayed: 1
          });
        }
      });

      // Include all players even if they don't have stats yet
      tournamentTeams.forEach(team => {
        team.players.forEach(player => {
          if (!playerTotals.has(player.id)) {
            playerTotals.set(player.id, {
              player,
              team,
              totalStats: {
                playerId: player.id,
                points: 0, fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0,
                ft_made: 0, ft_attempted: 0, orb: 0, drb: 0, assists: 0, steals: 0,
                blocks: 0, turnovers: 0, fouls: 0, tech_fouls: 0, unsportsmanlike_fouls: 0,
                fouls_drawn: 0, blocks_received: 0, plus_minus: 0, minutes_played: 0
              },
              gamesPlayed: 0
            });
          }
        });
      });
      
      return Array.from(playerTotals.values());
    };

    const playersData = getAllPlayersWithStats();

    const handleSort = (field: string) => {
      // Store current scroll position
      const currentScrollLeft = tableContainerRef.current?.scrollLeft || 0;
      
      if (sortField === field) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        // Default sort order for different fields
        if (field === 'Player' || field === 'Team' || field === 'Position') {
          setSortOrder('asc');
        } else {
          setSortOrder('desc');
        }
      }

      // Restore scroll position after state update
      setTimeout(() => {
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollLeft = currentScrollLeft;
        }
      }, 0);
    };

    const getSortIcon = (field: string) => {
      if (sortField !== field) {
        return <ChevronsUpDown className="w-3 h-3 text-muted-foreground" />;
      }
      return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
    };

    const sortedPlayers = [...playersData].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'Player':
          aValue = a.player.name.toLowerCase();
          bValue = b.player.name.toLowerCase();
          break;
        case 'Team':
          aValue = a.team.abbreviation;
          bValue = b.team.abbreviation;
          break;
        case 'Position':
          // Basketball position order: PG -> SG -> SF -> PF -> C
          const positionOrder = ['PG', 'SG', 'SF', 'PF', 'C'];
          const aPos = positionOrder.indexOf(a.player.position) !== -1 ? positionOrder.indexOf(a.player.position) : 999;
          const bPos = positionOrder.indexOf(b.player.position) !== -1 ? positionOrder.indexOf(b.player.position) : 999;
          // First click should sort PG->SG->SF->PF->C (ascending)
          if (sortOrder === 'asc') {
            aValue = aPos;
            bValue = bPos;
          } else {
            aValue = bPos;
            bValue = aPos;
          }
          break;
        case 'GP':
          aValue = a.gamesPlayed;
          bValue = b.gamesPlayed;
          break;
        case 'MPG':
          aValue = a.gamesPlayed > 0 ? a.totalStats.minutes_played / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.minutes_played / b.gamesPlayed : 0;
          break;
        case 'PPG':
          aValue = a.gamesPlayed > 0 ? a.totalStats.points / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.points / b.gamesPlayed : 0;
          break;
        case 'RPG':
          aValue = a.gamesPlayed > 0 ? (a.totalStats.orb + a.totalStats.drb) / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? (b.totalStats.orb + b.totalStats.drb) / b.gamesPlayed : 0;
          break;
        case 'APG':
          aValue = a.gamesPlayed > 0 ? a.totalStats.assists / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.assists / b.gamesPlayed : 0;
          break;
        case 'SPG':
          aValue = a.gamesPlayed > 0 ? a.totalStats.steals / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.steals / b.gamesPlayed : 0;
          break;
        case 'BPG':
          aValue = a.gamesPlayed > 0 ? a.totalStats.blocks / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.blocks / b.gamesPlayed : 0;
          break;
        case 'FG%':
          aValue = a.totalStats.fg_attempted > 0 ? (a.totalStats.fg_made / a.totalStats.fg_attempted) * 100 : 0;
          bValue = b.totalStats.fg_attempted > 0 ? (b.totalStats.fg_made / b.totalStats.fg_attempted) * 100 : 0;
          break;
        case 'FGM':
          aValue = a.gamesPlayed > 0 ? a.totalStats.fg_made / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.fg_made / b.gamesPlayed : 0;
          break;
        case 'FGA':
          aValue = a.gamesPlayed > 0 ? a.totalStats.fg_attempted / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.fg_attempted / b.gamesPlayed : 0;
          break;
        case '3P%':
          aValue = a.totalStats.three_attempted > 0 ? (a.totalStats.three_made / a.totalStats.three_attempted) * 100 : 0;
          bValue = b.totalStats.three_attempted > 0 ? (b.totalStats.three_made / b.totalStats.three_attempted) * 100 : 0;
          break;
        case '3PM':
          aValue = a.gamesPlayed > 0 ? a.totalStats.three_made / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.three_made / b.gamesPlayed : 0;
          break;
        case '3PA':
          aValue = a.gamesPlayed > 0 ? a.totalStats.three_attempted / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.three_attempted / b.gamesPlayed : 0;
          break;
        case 'FT%':
          aValue = a.totalStats.ft_attempted > 0 ? (a.totalStats.ft_made / a.totalStats.ft_attempted) * 100 : 0;
          bValue = b.totalStats.ft_attempted > 0 ? (b.totalStats.ft_made / b.totalStats.ft_attempted) * 100 : 0;
          break;
        case 'FTM':
          aValue = a.gamesPlayed > 0 ? a.totalStats.ft_made / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.ft_made / b.gamesPlayed : 0;
          break;
        case 'FTA':
          aValue = a.gamesPlayed > 0 ? a.totalStats.ft_attempted / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.ft_attempted / b.gamesPlayed : 0;
          break;
        case 'ORPG':
          aValue = a.gamesPlayed > 0 ? a.totalStats.orb / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.orb / b.gamesPlayed : 0;
          break;
        case 'TOPG':
          aValue = a.gamesPlayed > 0 ? a.totalStats.turnovers / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.turnovers / b.gamesPlayed : 0;
          break;
        case 'FPG':
          aValue = a.gamesPlayed > 0 ? a.totalStats.fouls / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.fouls / b.gamesPlayed : 0;
          break;
        case '+/-':
          aValue = a.gamesPlayed > 0 ? a.totalStats.plus_minus / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? b.totalStats.plus_minus / b.gamesPlayed : 0;
          break;
        case 'EFF':
          const aEff = MetricsCalculator.calculateEfficiency(a.totalStats);
          const bEff = MetricsCalculator.calculateEfficiency(b.totalStats);
          aValue = a.gamesPlayed > 0 ? aEff / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? bEff / b.gamesPlayed : 0;
          break;
        case 'GmSc':
          const aGmSc = MetricsCalculator.calculateGameScore(a.totalStats);
          const bGmSc = MetricsCalculator.calculateGameScore(b.totalStats);
          aValue = a.gamesPlayed > 0 ? aGmSc / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? bGmSc / b.gamesPlayed : 0;
          break;
        case 'IoS':
          const aIoS = MetricsCalculator.calculateIndexOfSuccess(a.totalStats);
          const bIoS = MetricsCalculator.calculateIndexOfSuccess(b.totalStats);
          aValue = a.gamesPlayed > 0 ? aIoS / a.gamesPlayed : 0;
          bValue = b.gamesPlayed > 0 ? bIoS / b.gamesPlayed : 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (typeof aValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Player Stats</h3>
          <Badge variant="secondary">{playersData.length} Players</Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            <div ref={tableContainerRef} className="overflow-x-auto max-h-[80vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead className={`cursor-pointer select-none ${sortField === 'Player' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('Player')}>
                      <div className="flex items-center gap-1">
                        Player
                        {getSortIcon('Player')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none w-16 ${sortField === 'Team' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('Team')}>
                      <div className="flex items-center gap-1">
                        Team
                        {getSortIcon('Team')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none ${sortField === 'Position' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('Position')}>
                      <div className="flex items-center gap-1">
                        Pos
                        {getSortIcon('Position')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'GP' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('GP')}>
                      <div className="flex items-center gap-1 justify-center">
                        GP
                        {getSortIcon('GP')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'MPG' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('MPG')}>
                      <div className="flex items-center gap-1 justify-center">
                        MPG
                        {getSortIcon('MPG')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'PPG' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('PPG')}>
                      <div className="flex items-center gap-1 justify-center">
                        PPG
                        {getSortIcon('PPG')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'RPG' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('RPG')}>
                      <div className="flex items-center gap-1 justify-center">
                        RPG
                        {getSortIcon('RPG')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'APG' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('APG')}>
                      <div className="flex items-center gap-1 justify-center">
                        APG
                        {getSortIcon('APG')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'SPG' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('SPG')}>
                      <div className="flex items-center gap-1 justify-center">
                        SPG
                        {getSortIcon('SPG')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'BPG' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('BPG')}>
                      <div className="flex items-center gap-1 justify-center">
                        BPG
                        {getSortIcon('BPG')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'FG%' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('FG%')}>
                      <div className="flex items-center gap-1 justify-center">
                        FG%
                        {getSortIcon('FG%')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'FGM' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('FGM')}>
                      <div className="flex items-center gap-1 justify-center">
                        FGM
                        {getSortIcon('FGM')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'FGA' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('FGA')}>
                      <div className="flex items-center gap-1 justify-center">
                        FGA
                        {getSortIcon('FGA')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === '3P%' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('3P%')}>
                      <div className="flex items-center gap-1 justify-center">
                        3P%
                        {getSortIcon('3P%')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === '3PM' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('3PM')}>
                      <div className="flex items-center gap-1 justify-center">
                        3PM
                        {getSortIcon('3PM')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === '3PA' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('3PA')}>
                      <div className="flex items-center gap-1 justify-center">
                        3PA
                        {getSortIcon('3PA')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'FT%' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('FT%')}>
                      <div className="flex items-center gap-1 justify-center">
                        FT%
                        {getSortIcon('FT%')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'FTM' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('FTM')}>
                      <div className="flex items-center gap-1 justify-center">
                        FTM
                        {getSortIcon('FTM')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'FTA' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('FTA')}>
                      <div className="flex items-center gap-1 justify-center">
                        FTA
                        {getSortIcon('FTA')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'ORPG' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('ORPG')}>
                      <div className="flex items-center gap-1 justify-center">
                        ORPG
                        {getSortIcon('ORPG')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'TOPG' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('TOPG')}>
                      <div className="flex items-center gap-1 justify-center">
                        TOPG
                        {getSortIcon('TOPG')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'FPG' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('FPG')}>
                      <div className="flex items-center gap-1 justify-center">
                        FPG
                        {getSortIcon('FPG')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === '+/-' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('+/-')}>
                      <div className="flex items-center gap-1 justify-center">
                        +/-
                        {getSortIcon('+/-')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'GmSc' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('GmSc')}>
                      <div className="flex items-center gap-1 justify-center">
                        GmSc
                        {getSortIcon('GmSc')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'EFF' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('EFF')}>
                      <div className="flex items-center gap-1 justify-center">
                        EFF
                        {getSortIcon('EFF')}
                      </div>
                    </TableHead>
                    <TableHead className={`cursor-pointer select-none text-center ${sortField === 'IoS' ? 'bg-muted/50' : ''}`} onClick={() => handleSort('IoS')}>
                      <div className="flex items-center gap-1 justify-center">
                        IoS
                        {getSortIcon('IoS')}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPlayers.map((playerData, index) => {
                    const mpg = playerData.gamesPlayed > 0 ? playerData.totalStats.minutes_played / playerData.gamesPlayed : 0;
                    const ppg = playerData.gamesPlayed > 0 ? playerData.totalStats.points / playerData.gamesPlayed : 0;
                    const rpg = playerData.gamesPlayed > 0 ? (playerData.totalStats.orb + playerData.totalStats.drb) / playerData.gamesPlayed : 0;
                    const apg = playerData.gamesPlayed > 0 ? playerData.totalStats.assists / playerData.gamesPlayed : 0;
                    const spg = playerData.gamesPlayed > 0 ? playerData.totalStats.steals / playerData.gamesPlayed : 0;
                    const bpg = playerData.gamesPlayed > 0 ? playerData.totalStats.blocks / playerData.gamesPlayed : 0;
                    const fgPct = playerData.totalStats.fg_attempted > 0 ? (playerData.totalStats.fg_made / playerData.totalStats.fg_attempted) * 100 : 0;
                    const fgm = playerData.gamesPlayed > 0 ? playerData.totalStats.fg_made / playerData.gamesPlayed : 0;
                    const fga = playerData.gamesPlayed > 0 ? playerData.totalStats.fg_attempted / playerData.gamesPlayed : 0;
                    const threePct = playerData.totalStats.three_attempted > 0 ? (playerData.totalStats.three_made / playerData.totalStats.three_attempted) * 100 : 0;
                    const threePm = playerData.gamesPlayed > 0 ? playerData.totalStats.three_made / playerData.gamesPlayed : 0;
                    const threePa = playerData.gamesPlayed > 0 ? playerData.totalStats.three_attempted / playerData.gamesPlayed : 0;
                    const ftPct = playerData.totalStats.ft_attempted > 0 ? (playerData.totalStats.ft_made / playerData.totalStats.ft_attempted) * 100 : 0;
                    const ftm = playerData.gamesPlayed > 0 ? playerData.totalStats.ft_made / playerData.gamesPlayed : 0;
                    const fta = playerData.gamesPlayed > 0 ? playerData.totalStats.ft_attempted / playerData.gamesPlayed : 0;
                    const orpg = playerData.gamesPlayed > 0 ? playerData.totalStats.orb / playerData.gamesPlayed : 0;
                    const topg = playerData.gamesPlayed > 0 ? playerData.totalStats.turnovers / playerData.gamesPlayed : 0;
                    const fpg = playerData.gamesPlayed > 0 ? playerData.totalStats.fouls / playerData.gamesPlayed : 0;
                    const plusMinus = playerData.gamesPlayed > 0 ? playerData.totalStats.plus_minus / playerData.gamesPlayed : 0;
                    
                    const eff = MetricsCalculator.calculateEfficiency(playerData.totalStats);
                    const effPg = playerData.gamesPlayed > 0 ? eff / playerData.gamesPlayed : 0;
                    
                    const gameSc = MetricsCalculator.calculateGameScore(playerData.totalStats);
                    const gameScPg = playerData.gamesPlayed > 0 ? gameSc / playerData.gamesPlayed : 0;
                    
                    const ioS = MetricsCalculator.calculateIndexOfSuccess(playerData.totalStats);
                    const ioSPg = playerData.gamesPlayed > 0 ? ioS / playerData.gamesPlayed : 0;

                    return (
                      <TableRow 
                        key={playerData.player.id}
                        className="hover:bg-muted/50"
                      >
                        <TableCell className="text-center">{index + 1}</TableCell>
                        <TableCell 
                          className={`font-medium cursor-pointer hover:text-primary ${sortField === 'Player' ? 'bg-muted/50' : ''}`}
                          onClick={() => onNavigateToPlayer(playerData.player.id)}
                        >
                          {playerData.player.name}
                        </TableCell>
                        <TableCell className={sortField === 'Team' ? 'bg-muted/50' : ''}>{playerData.team.abbreviation}</TableCell>
                        <TableCell className={sortField === 'Position' ? 'bg-muted/50' : ''}>{playerData.player.position}</TableCell>
                        <TableCell className={`text-center ${sortField === 'GP' ? 'bg-muted/50' : ''}`}>{playerData.gamesPlayed}</TableCell>
                        <TableCell className={`text-center ${sortField === 'MPG' ? 'bg-muted/50' : ''}`}>{mpg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'PPG' ? 'bg-muted/50' : ''}`}>{ppg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'RPG' ? 'bg-muted/50' : ''}`}>{rpg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'APG' ? 'bg-muted/50' : ''}`}>{apg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'SPG' ? 'bg-muted/50' : ''}`}>{spg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'BPG' ? 'bg-muted/50' : ''}`}>{bpg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'FG%' ? 'bg-muted/50' : ''}`}>{fgPct.toFixed(1)}%</TableCell>
                        <TableCell className={`text-center ${sortField === 'FGM' ? 'bg-muted/50' : ''}`}>{fgm.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'FGA' ? 'bg-muted/50' : ''}`}>{fga.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === '3P%' ? 'bg-muted/50' : ''}`}>{threePct.toFixed(1)}%</TableCell>
                        <TableCell className={`text-center ${sortField === '3PM' ? 'bg-muted/50' : ''}`}>{threePm.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === '3PA' ? 'bg-muted/50' : ''}`}>{threePa.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'FT%' ? 'bg-muted/50' : ''}`}>{ftPct.toFixed(1)}%</TableCell>
                        <TableCell className={`text-center ${sortField === 'FTM' ? 'bg-muted/50' : ''}`}>{ftm.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'FTA' ? 'bg-muted/50' : ''}`}>{fta.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'ORPG' ? 'bg-muted/50' : ''}`}>{orpg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'TOPG' ? 'bg-muted/50' : ''}`}>{topg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'FPG' ? 'bg-muted/50' : ''}`}>{fpg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === '+/-' ? 'bg-muted/50' : ''}`}>
                          <span className={plusMinus >= 0 ? "text-green-600" : "text-red-600"}>
                            {plusMinus >= 0 ? '+' : ''}{plusMinus.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell className={`text-center ${sortField === 'GmSc' ? 'bg-muted/50' : ''}`}>{gameScPg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'EFF' ? 'bg-muted/50' : ''}`}>{effPg.toFixed(1)}</TableCell>
                        <TableCell className={`text-center ${sortField === 'IoS' ? 'bg-muted/50' : ''}`}>{ioSPg.toFixed(1)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <p className="text-muted-foreground">{tournament.month} {tournament.year}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          {tournamentTeams.length} Teams • {tournamentGames.length} Games
        </Badge>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="home">Home</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="players">Player Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="space-y-6">
          <HomeTab />
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <TeamsTab />
        </TabsContent>

        <TabsContent value="standings" className="space-y-6">
          <StandingsTab />
        </TabsContent>

        <TabsContent value="players" className="space-y-6">
          <PlayersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}