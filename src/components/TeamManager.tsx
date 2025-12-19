import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Team, Player } from '../App';
import { Plus, Users, ArrowLeft, Trash2, Edit, UserPlus } from 'lucide-react';

interface TeamManagerProps {
  teams: Team[];
  onCreateTeam: (team: Omit<Team, 'id'>) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
  onBack: () => void;
}

interface TeamFormProps {
  teamForm: { name: string };
  setTeamForm: React.Dispatch<React.SetStateAction<{ name: string }>>;
  editingTeam: Team | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

interface PlayerFormProps {
  playerForm: { name: string; number: string; position: string };
  setPlayerForm: React.Dispatch<React.SetStateAction<{ name: string; number: string; position: string }>>;
  selectedTeam: Team | null;
  positions: string[];
  isNumberTaken: (number: string, teamId: string) => boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const TeamForm = React.memo(({ teamForm, setTeamForm, editingTeam, onSubmit, onCancel }: TeamFormProps) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="teamName">Team Name</Label>
      <Input
        id="teamName"
        value={teamForm.name}
        onChange={(e) => setTeamForm(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Enter team name"
        required
      />
    </div>

    <div className="flex justify-end space-x-2 pt-4">
      <Button 
        type="button" 
        variant="outline" 
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button type="submit">
        {editingTeam ? 'Update Team' : 'Create Team'}
      </Button>
    </div>
  </form>
));

TeamForm.displayName = 'TeamForm';

const PlayerForm = React.memo(({ playerForm, setPlayerForm, selectedTeam, positions, isNumberTaken, onSubmit, onCancel }: PlayerFormProps) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="playerName">Player Name</Label>
      <Input
        id="playerName"
        value={playerForm.name}
        onChange={(e) => setPlayerForm(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Enter player name"
        required
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="playerNumber">Jersey Number</Label>
        <Input
          id="playerNumber"
          type="number"
          min="0"
          max="99"
          value={playerForm.number}
          onChange={(e) => setPlayerForm(prev => ({ ...prev, number: e.target.value }))}
          placeholder="0-99"
          required
        />
        {selectedTeam && playerForm.number && isNumberTaken(playerForm.number, selectedTeam.id) && (
          <p className="text-xs text-destructive">This number is already taken</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="playerPosition">Position</Label>
        <Select value={playerForm.position} onValueChange={(value) => setPlayerForm(prev => ({ ...prev, position: value }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select position" />
          </SelectTrigger>
          <SelectContent>
            {positions.map(position => (
              <SelectItem key={position} value={position}>
                {position}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="flex justify-end space-x-2 pt-4">
      <Button 
        type="button" 
        variant="outline" 
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button 
        type="submit"
        disabled={selectedTeam && playerForm.number && isNumberTaken(playerForm.number, selectedTeam.id)}
      >
        Add Player
      </Button>
    </div>
  </form>
));

PlayerForm.displayName = 'PlayerForm';

export function TeamManager({ teams, onCreateTeam, onUpdateTeam, onDeleteTeam, onBack }: TeamManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '' });
  const [playerForm, setPlayerForm] = useState({
    name: '',
    number: '',
    position: ''
  });

  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

  const resetTeamForm = useCallback(() => {
    setTeamForm({ name: '' });
  }, []);

  const resetPlayerForm = useCallback(() => {
    setPlayerForm({ name: '', number: '', position: '' });
  }, []);

  const handleTeamSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTeam) {
      onUpdateTeam({
        ...editingTeam,
        name: teamForm.name
      });
      setEditingTeam(null);
    } else {
      onCreateTeam({
        name: teamForm.name,
        players: []
      });
      setIsCreateDialogOpen(false);
    }
    
    resetTeamForm();
  }, [editingTeam, teamForm.name, onUpdateTeam, onCreateTeam, resetTeamForm]);

  const handlePlayerSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTeam) return;

    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      name: playerForm.name,
      number: parseInt(playerForm.number),
      position: playerForm.position
    };

    const updatedTeam = {
      ...selectedTeam,
      players: [...selectedTeam.players, newPlayer]
    };

    onUpdateTeam(updatedTeam);
    setIsPlayerDialogOpen(false);
    resetPlayerForm();
  }, [selectedTeam, playerForm, onUpdateTeam, resetPlayerForm]);

  const handleEditTeam = useCallback((team: Team) => {
    setEditingTeam(team);
    setTeamForm({ name: team.name });
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
    resetTeamForm();
  }, [editingTeam, resetTeamForm]);

  const handlePlayerFormCancel = useCallback(() => {
    setIsPlayerDialogOpen(false);
    resetPlayerForm();
  }, [resetPlayerForm]);

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
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Add a new team to your roster. You can add players after creating the team.
              </DialogDescription>
            </DialogHeader>
            <TeamForm
              teamForm={teamForm}
              setTeamForm={setTeamForm}
              editingTeam={editingTeam}
              onSubmit={handleTeamSubmit}
              onCancel={handleTeamFormCancel}
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
              teamForm={teamForm}
              setTeamForm={setTeamForm}
              editingTeam={editingTeam}
              onSubmit={handleTeamSubmit}
              onCancel={handleTeamFormCancel}
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
            playerForm={playerForm}
            setPlayerForm={setPlayerForm}
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
            <Card key={team.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {team.players.length} {team.players.length === 1 ? 'Player' : 'Players'}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditTeam(team)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteTeam(team.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Players List */}
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
                          onClick={() => handleRemovePlayer(team, player.id)}
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
                  onClick={() => {
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