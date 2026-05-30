import React, { useState, useCallback } from 'react';
import { TournamentForm } from './forms/TournamentForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
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

  const handleFormSubmit = useCallback((data: {
    name: string;
    description: string;
    year: number;
    month: string;
    teams: string[];
  }) => {
    if (editingTournament) {
      onUpdateTournament({
        ...editingTournament,
        name: data.name,
        description: data.description,
        year: data.year,
        month: data.month,
        teams: data.teams,
      });
      setEditingTournament(null);
    } else {
      onCreateTournament({
        ...data,
        games: [],
        standings: [],
      });
      setIsCreateDialogOpen(false);
    }
  }, [editingTournament, onUpdateTournament, onCreateTournament]);

  const handleFormCancel = useCallback(() => {
    if (editingTournament) {
      setEditingTournament(null);
    } else {
      setIsCreateDialogOpen(false);
    }
  }, [editingTournament]);

  const handleEdit = (tournament: Tournament) => {
    setEditingTournament(tournament);
  };

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
        
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Tournament
        </Button>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Tournament</DialogTitle>
              <DialogDescription>
                Set up a new tournament and add teams to participate.
              </DialogDescription>
            </DialogHeader>
            <TournamentForm
              teams={teams}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              isEditing={false}
            />
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
            <TournamentForm
              initialData={{
                name: editingTournament.name,
                description: editingTournament.description || '',
                year: editingTournament.year,
                month: editingTournament.month,
                selectedTeams: editingTournament.teams
              }}
              teams={teams}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              isEditing={true}
            />
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