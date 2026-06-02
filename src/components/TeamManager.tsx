import React, { useState, useCallback } from 'react';
import { TeamForm } from './forms/TeamForm';
import { AddPlayerDialog } from './AddPlayerDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Team, Player, Tournament, CreateTeamOptions } from '../App';
import { generateTeamAbbreviation } from '../utils/teamAbbreviation';
import { TeamBadge } from './TeamBadge';
import { Plus, Users, ArrowLeft, Trash2, Edit, UserPlus } from 'lucide-react';

interface TeamManagerProps {
  teams: Team[];
  tournaments: Tournament[];
  onCreateTeam: (team: Omit<Team, 'id'>, options?: CreateTeamOptions) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
  onBack: () => void;
  onNavigateToTeam: (teamId: string) => void;
}

export function TeamManager({
  teams,
  tournaments,
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
  const [createFormKey, setCreateFormKey] = useState(0);

  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

  const takenAbbreviations = teams.map((t) => t.abbreviation).filter(Boolean);

  const handleTeamSubmit = useCallback(
    ({ name, abbreviation, description, icon, tournamentIds }: { name: string; abbreviation: string; description?: string; icon?: string; tournamentIds: string[] }) => {
      const resolvedAbbrev =
        abbreviation.trim().toUpperCase() ||
        generateTeamAbbreviation(
          name,
          editingTeam
            ? takenAbbreviations.filter((a) => a !== editingTeam.abbreviation)
            : takenAbbreviations
        );

      if (editingTeam) {
        onUpdateTeam({
          ...editingTeam,
          name,
          abbreviation: resolvedAbbrev,
          description,
          icon,
        });
        setEditingTeam(null);
      } else {
        onCreateTeam(
          {
            name,
            abbreviation: resolvedAbbrev,
            icon,
            players: [],
          },
          { tournamentIds }
        );
        setIsCreateDialogOpen(false);
      }
    },
    [editingTeam, onUpdateTeam, onCreateTeam, takenAbbreviations]
  );

  const handleAddPlayerToRoster = useCallback(
    (player: Player) => {
      if (!selectedTeam) return;
      const currentTeam =
        teams.find((t) => t.id === selectedTeam.id) ?? selectedTeam;
      onUpdateTeam({
        ...currentTeam,
        players: [...currentTeam.players, player],
      });
      setIsPlayerDialogOpen(false);
    },
    [selectedTeam, teams, onUpdateTeam]
  );

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

  const handleTeamFormCancel = useCallback(() => {
    if (editingTeam) {
      setEditingTeam(null);
    } else {
      setIsCreateDialogOpen(false);
    }
  }, [editingTeam]);

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
          onClick={() => {
            setCreateFormKey((k) => k + 1);
            setIsCreateDialogOpen(true);
          }}
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
              key={createFormKey}
              initialName=""
              takenAbbreviations={takenAbbreviations}
              tournaments={tournaments}
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
              key={editingTeam.id}
              initialName={editingTeam.name}
              initialAbbreviation={editingTeam.abbreviation}
              initialDescription={editingTeam.description || ''}
              initialIcon={editingTeam.icon}
              teamId={editingTeam.id}
              takenAbbreviations={takenAbbreviations.filter(
                (a) => a !== editingTeam.abbreviation
              )}
              onSubmit={handleTeamSubmit}
              onCancel={handleTeamFormCancel}
              isEditing
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Player Dialog */}
      {selectedTeam && (
        <AddPlayerDialog
          open={isPlayerDialogOpen}
          onOpenChange={(open) => {
            setIsPlayerDialogOpen(open);
            if (!open) setSelectedTeam(null);
          }}
          team={teams.find((t) => t.id === selectedTeam.id) ?? selectedTeam}
          teams={teams}
          tournaments={tournaments}
          positions={positions}
          onSubmit={handleAddPlayerToRoster}
        />
      )}

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
            <Button
              onClick={() => {
                setCreateFormKey((k) => k + 1);
                setIsCreateDialogOpen(true);
              }}
            >
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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <TeamBadge team={team} teamId={team.id} size="lg" />
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-lg leading-snug">{team.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Users className="h-3 w-3 shrink-0" />
                        {team.players.length}{' '}
                        {team.players.length === 1 ? 'Player' : 'Players'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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