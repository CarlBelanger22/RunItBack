import React, { useState, useCallback, useMemo } from 'react';
import { TeamForm } from './forms/TeamForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Team, Tournament, Game, CreateTeamOptions } from '../App';
import { generateTeamAbbreviation } from '../utils/teamAbbreviation';
import { teamDeletionConfirmMessage } from '../utils/rosterPlayerRemoval';
import { TeamBadge } from './TeamBadge';
import { Plus, Users, ArrowLeft, Trash2, Edit } from 'lucide-react';
import { partitionTeams } from '../utils/ghostTeams';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

interface TeamManagerProps {
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  onCreateTeam: (team: Omit<Team, 'id'>, options?: CreateTeamOptions) => Team;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
  onBack: () => void;
  onNavigateToTeam: (teamId: string) => void;
}

function sortTeamsByName(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => a.name.localeCompare(b.name));
}

export function TeamManager({
  teams,
  tournaments,
  games,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onBack,
  onNavigateToTeam,
}: TeamManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [showGhostTeams, setShowGhostTeams] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const gameCountByTeamId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of games) {
      for (const teamId of [game.homeTeamId, game.awayTeamId]) {
        counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
      }
    }
    return counts;
  }, [games]);

  const { realTeams, ghostTeams } = useMemo(
    () => partitionTeams(teams),
    [teams]
  );
  const sortedRealTeams = useMemo(
    () => sortTeamsByName(realTeams),
    [realTeams]
  );
  const sortedGhostTeams = useMemo(
    () => sortTeamsByName(ghostTeams),
    [ghostTeams]
  );

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
        const team = onCreateTeam(
          {
            name,
            abbreviation: resolvedAbbrev,
            icon,
            players: [],
          },
          { tournamentIds }
        );
        setIsCreateDialogOpen(false);
        onNavigateToTeam(team.id);
      }
    },
    [editingTeam, onUpdateTeam, onCreateTeam, onNavigateToTeam, takenAbbreviations]
  );

  const handleEditTeam = useCallback((team: Team) => {
    setEditingTeam(team);
  }, []);

  const handleTeamFormCancel = useCallback(() => {
    if (editingTeam) {
      setEditingTeam(null);
    } else {
      setIsCreateDialogOpen(false);
    }
  }, [editingTeam]);

  const renderTeamCard = (team: Team, ghost = false) => (
    <Card
      key={team.id}
      className={`hover:shadow-lg transition-shadow cursor-pointer ${
        ghost ? 'border-dashed border-muted-foreground/30 bg-muted/20' : ''
      }`}
      onClick={() => onNavigateToTeam(team.id)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <TeamBadge team={team} teamId={team.id} size="lg" />
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg leading-snug">{team.name}</CardTitle>
                {ghost ? (
                  <Badge variant="secondary" className="text-xs font-normal">
                    Ghost
                  </Badge>
                ) : null}
              </div>
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
                setDeleteTarget(team);
              }}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-6">
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
              Create and manage your basketball teams
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
                Add a new team to your league. Open the team page to manage its roster.
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

      {ghostTeams.length > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <Switch
            id="show-ghost-teams"
            checked={showGhostTeams}
            onCheckedChange={setShowGhostTeams}
          />
          <Label htmlFor="show-ghost-teams" className="text-sm font-normal cursor-pointer">
            Show ghost teams ({ghostTeams.length})
          </Label>
        </div>
      ) : null}

      {teams.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent className="space-y-4">
            <Users className="h-16 w-16 text-muted-foreground mx-auto" />
            <div>
              <h3>No teams yet</h3>
              <p className="text-muted-foreground">
                Create your first team, then open it to manage the roster.
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
      ) : realTeams.length === 0 && !showGhostTeams ? (
        <Card className="text-center p-12">
          <CardContent className="space-y-4">
            <Users className="h-16 w-16 text-muted-foreground mx-auto" />
            <div>
              <h3>No teams with players yet</h3>
              <p className="text-muted-foreground">
                Open a team to add players, or enable ghost teams to see{' '}
                {ghostTeams.length} empty{' '}
                {ghostTeams.length === 1 ? 'team' : 'teams'}.
              </p>
            </div>
            <Button
              onClick={() => {
                setCreateFormKey((k) => k + 1);
                setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {realTeams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedRealTeams.map((team) => renderTeamCard(team))}
            </div>
          ) : null}

          {showGhostTeams && ghostTeams.length > 0 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium">Ghost teams</h3>
                <p className="text-sm text-muted-foreground">
                  Teams with no roster on file (opponent placeholders or newly created teams).
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedGhostTeams.map((team) => renderTeamCard(team, true))}
              </div>
            </div>
          ) : null}
        </div>
      )}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget
                ? teamDeletionConfirmMessage(
                    deleteTarget.name,
                    gameCountByTeamId.get(deleteTarget.id) ?? 0
                  ).title
                : 'Delete team?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? teamDeletionConfirmMessage(
                    deleteTarget.name,
                    gameCountByTeamId.get(deleteTarget.id) ?? 0
                  ).description
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) onDeleteTeam(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
