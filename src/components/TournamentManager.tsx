import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tournament, Team } from '../App';
import { Plus, Trophy, Users, Calendar, ArrowLeft, Trash2, Edit } from 'lucide-react';

interface TournamentManagerProps {
  tournaments: Tournament[];
  teams: Team[];
  onCreateTournament: (tournament: Omit<Tournament, 'id'>) => void;
  onUpdateTournament: (tournament: Tournament) => void;
  onDeleteTournament: (tournamentId: string) => void;
  onBack: () => void;
  onNavigateToTournament: (tournamentId: string) => void;
}

export function TournamentManager({ 
  tournaments, 
  teams, 
  onCreateTournament, 
  onUpdateTournament,
  onDeleteTournament,
  onBack,
  onNavigateToTournament
}: TournamentManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    year: new Date().getFullYear(),
    month: new Date().toLocaleDateString('en-US', { month: 'short' }),
    selectedTeams: [] as string[]
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      year: new Date().getFullYear(),
      month: new Date().toLocaleDateString('en-US', { month: 'short' }),
      selectedTeams: []
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const tournamentData = {
      name: formData.name,
      description: formData.description,
      year: formData.year,
      month: formData.month,
      teams: formData.selectedTeams,
      games: [],
      standings: []
    };

    if (editingTournament) {
      onUpdateTournament({
        ...editingTournament,
        ...tournamentData
      });
      setEditingTournament(null);
    } else {
      onCreateTournament(tournamentData);
      setIsCreateDialogOpen(false);
    }
    
    resetForm();
  };

  const handleEdit = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setFormData({
      name: tournament.name,
      description: tournament.description || '',
      year: tournament.year,
      month: tournament.month,
      selectedTeams: tournament.teams
    });
  };

  const handleTeamToggle = (teamId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTeams: prev.selectedTeams.includes(teamId)
        ? prev.selectedTeams.filter(id => id !== teamId)
        : [...prev.selectedTeams, teamId]
    }));
  };

  const TournamentForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Tournament Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter tournament name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Enter tournament description"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            type="number"
            value={formData.year}
            onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
            min="2020"
            max="2030"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="month">Month</Label>
          <Select value={formData.month} onValueChange={(value) => setFormData(prev => ({ ...prev, month: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                <SelectItem key={month} value={month}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Teams</Label>
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-2">
              No teams available. Create some teams first.
            </p>
          ) : (
            teams.map(team => (
              <div key={team.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`team-${team.id}`}
                  checked={formData.selectedTeams.includes(team.id)}
                  onCheckedChange={() => handleTeamToggle(team.id)}
                />
                <Label 
                  htmlFor={`team-${team.id}`} 
                  className="text-sm cursor-pointer"
                >
                  {team.name}
                </Label>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            if (editingTournament) {
              setEditingTournament(null);
            } else {
              setIsCreateDialogOpen(false);
            }
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button type="submit">
          {editingTournament ? 'Update Tournament' : 'Create Tournament'}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h2 className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Tournament Manager
            </h2>
            <p className="text-muted-foreground">
              Create and manage your basketball tournaments
            </p>
          </div>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Tournament
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Tournament</DialogTitle>
              <DialogDescription>
                Set up a new tournament and add teams to participate.
              </DialogDescription>
            </DialogHeader>
            <TournamentForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Tournament Dialog */}
      {editingTournament && (
        <Dialog open={!!editingTournament} onOpenChange={() => setEditingTournament(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Tournament</DialogTitle>
              <DialogDescription>
                Update tournament details and team participation.
              </DialogDescription>
            </DialogHeader>
            <TournamentForm />
          </DialogContent>
        </Dialog>
      )}

      {/* Tournaments Grid */}
      {tournaments.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent className="space-y-4">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto" />
            <div>
              <h3>No tournaments yet</h3>
              <p className="text-muted-foreground">
                Create your first tournament to start organizing games and tracking statistics.
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Tournament
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <Card key={tournament.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigateToTournament(tournament.id)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{tournament.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {tournament.month} {tournament.year}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(tournament)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteTournament(tournament.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {tournament.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {tournament.description}
                  </p>
                )}
                
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {tournament.teams.length} {tournament.teams.length === 1 ? 'Team' : 'Teams'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="text-xs">
                    {tournament.games.length} Games
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Click to view details
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}