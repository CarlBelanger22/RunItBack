import React, { useState, useCallback } from 'react';
import { TeamForm } from './forms/TeamForm';
import { PlayerForm } from './forms/PlayerForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Team, Player } from '../App';
import { Plus, Users, ArrowLeft, Trash2, Edit, UserPlus } from 'lucide-react';

interface TeamManagerProps {
  teams: Team[];
  onCreateTeam: (team: Omit<Team, 'id'>) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
  onBack: () => void;
  onNavigateToTeam: (teamId: string) => void;
}

export function TeamManager({
  teams,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onBack,
  onNavigateToTeam,
}: TeamManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);

  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

  const handleTeamSubmit = useCallback((name: string) => {
    if (editingTeam) {
      onUpdateTeam({
        ...editingTeam,
        name
      });
      setEditingTeam(null);
    } else {
      onCreateTeam({
        name,
        players: []
      });
      setIsCreateDialogOpen(false);
    }
  }, [editingTeam, onUpdateTeam, onCreateTeam]);

  const handlePlayerSubmit = useCallback((data: { 
    name: string; 
    number: string; 
    position: string;
    secondaryPosition?: string;
    height: string;
    weight: string;
    dateOfBirth?: string;
  }) => {
    if (!selectedTeam) return;

    // Calculate age from date of birth if provided
    let age = 0;
    if (data.dateOfBirth) {
      const birthDate = new Date(data.dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      name: data.name,
      number: parseInt(data.number),
      position: data.position,
      secondaryPosition: data.secondaryPosition,
      height: data.height || '',
      weight: data.weight || '',
      age: age,
      dateOfBirth: data.dateOfBirth
    };

    const updatedTeam = {
      ...selectedTeam,
      players: [...selectedTeam.players, newPlayer]
    };

    onUpdateTeam(updatedTeam);
    setIsPlayerDialogOpen(false);
  }, [selectedTeam, onUpdateTeam]);

  const handleEditTeam = useCallback((team: Team) => {
    setEditingTeam(team);
  }, []);

  const handleRemovePlayer = useCallback((team: Team, playerId: string) => {
    const updatedTeam = {
      ...team,
      players: team.players.filter(player => player.id !== playerId)
    };
    onUpdateTeam(updatedTeam);
  }, [onUpdateTeam]);

  const isNumberTaken = useCallback((number: string, teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team?.players.some(player => player.number === parseInt(number)) || false;
  }, [teams]);

  const handleTeamFormCancel = useCallback(() => {
    if (editingTeam) {
      setEditingTeam(null);
    } else {
      setIsCreateDialogOpen(false);
    }
  }, [editingTeam]);

  const handlePlayerFormCancel = useCallback(() => {
    setIsPlayerDialogOpen(false);
  }, []);

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
              <Users className="h-5 w-5" />
              Team Manager
            </h2>
            <p className="text-muted-foreground">
              Create and manage your basketball teams and players
            </p>
          </div>
        </div>
        
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Team
        </Button>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Add a new team to your roster. You can add players after creating the team.
              </DialogDescription>
            </DialogHeader>
            <TeamForm
              initialName=""
              onSubmit={handleTeamSubmit}
              onCancel={handleTeamFormCancel}
              isEditing={false}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Team Dialog */}
      {editingTeam && (
        <Dialog open={!!editingTeam} onOpenChange={() => setEditingTeam(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Team</DialogTitle>
              <DialogDescription>
                Update team information.
              </DialogDescription>
            </DialogHeader>
            <TeamForm
              initialName={editingTeam.name}
              onSubmit={handleTeamSubmit}
              onCancel={handleTeamFormCancel}
              isEditing
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Player Dialog */}
      <Dialog open={isPlayerDialogOpen} onOpenChange={setIsPlayerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Player to {selectedTeam?.name}</DialogTitle>
            <DialogDescription>
              Add a new player to the team roster.
            </DialogDescription>
          </DialogHeader>
            <PlayerForm
              selectedTeam={selectedTeam}
              positions={positions}
              isNumberTaken={isNumberTaken}
              onSubmit={handlePlayerSubmit}
              onCancel={handlePlayerFormCancel}
            />
        </DialogContent>
      </Dialog>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent className="space-y-4">
            <Users className="h-16 w-16 text-muted-foreground mx-auto" />
            <div>
              <h3>No teams yet</h3>
              <p className="text-muted-foreground">
                Create your first team and start building your roster.
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Card
              key={team.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onNavigateToTeam(team.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {team.players.length} {team.players.length === 1 ? 'Player' : 'Players'}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTeam(team);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTeam(team.id);
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {team.players.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {team.players.map((player) => (
                      <div key={player.id} className="flex items-center justify-between text-sm border rounded p-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs w-8 h-6 justify-center">
                            #{player.number}
                          </Badge>
                          <span>{player.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {player.position}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePlayer(team, player.id);
                          }}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No players added yet
                  </p>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTeam(team);
                    setIsPlayerDialogOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Player
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}