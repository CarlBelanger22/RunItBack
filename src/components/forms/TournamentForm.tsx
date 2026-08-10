import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Team } from '../../App';
import { TournamentIconField } from '../TournamentIconField';
import { TeamBadge } from '../TeamBadge';
import { Badge } from '../ui/badge';
import { Plus, X } from 'lucide-react';

interface TournamentFormProps {
  initialData?: {
    name?: string;
    description?: string;
    year?: number;
    month?: string;
    selectedTeams?: string[];
    icon?: string;
  };
  tournamentId?: string;
  teams: Team[];
  onSubmit: (data: {
    name: string;
    description: string;
    year: number;
    month: string;
    teams: string[];
    icon?: string;
  }) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

function teamMatchesQuery(team: Team, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  return (
    team.name.toLowerCase().includes(q) ||
    team.abbreviation.toLowerCase().includes(q)
  );
}

export const TournamentForm = React.memo(({
  initialData,
  tournamentId,
  teams,
  onSubmit,
  onCancel,
  isEditing = false
}: TournamentFormProps) => {
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const [icon, setIcon] = useState<string | undefined>(initialData?.icon);
  const [tournamentName, setTournamentName] = useState(initialData?.name || '');
  const [month, setMonth] = useState<string>(
    initialData?.month || new Date().toLocaleDateString('en-US', { month: 'short' })
  );
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(
    new Set(initialData?.selectedTeams || [])
  );
  const [teamQuery, setTeamQuery] = useState('');

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  const enrolledTeams = useMemo(() => {
    return [...selectedTeams]
      .map((id) => teamById.get(id))
      .filter((t): t is Team => t != null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedTeams, teamById]);

  const availableTeams = useMemo(() => {
    return teams
      .filter((t) => !selectedTeams.has(t.id) && teamMatchesQuery(t, teamQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, selectedTeams, teamQuery]);

  const enrollTeam = useCallback((teamId: string) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      next.add(teamId);
      return next;
    });
  }, []);

  const unenrollTeam = useCallback((teamId: string) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      next.delete(teamId);
      return next;
    });
  }, []);

  const handleMonthChange = useCallback((value: string) => {
    setMonth(value);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    const tournamentData = {
      name: nameRef.current?.value || '',
      description: descriptionRef.current?.value || '',
      year: parseInt(yearRef.current?.value || String(new Date().getFullYear())) || new Date().getFullYear(),
      month: month,
      teams: Array.from(selectedTeams),
      icon,
    };

    onSubmit(tournamentData);
  }, [onSubmit, month, selectedTeams, icon]);

  return (
    <form onSubmit={handleSubmit} className="tournament-form" onKeyDown={(e) => {
      if (e.key === 'Enter' && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
      }
    }}>
      <div className="space-y-2">
        <Label htmlFor="name">Tournament Name</Label>
        <Input
          ref={nameRef}
          id="name"
          defaultValue={initialData?.name || ''}
          placeholder="Enter tournament name"
          required
          autoFocus
          onChange={(e) => setTournamentName(e.target.value)}
        />
      </div>

      <TournamentIconField
        value={icon}
        onChange={setIcon}
        tournamentName={tournamentName || 'Tournament'}
        tournamentId={tournamentId}
      />

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          ref={descriptionRef}
          id="description"
          defaultValue={initialData?.description || ''}
          placeholder="Enter tournament description"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Input
            ref={yearRef}
            id="year"
            type="number"
            defaultValue={initialData?.year || new Date().getFullYear()}
            min="2000"
            max="2030"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="month">Month</Label>
          <Select
            defaultValue={initialData?.month || new Date().toLocaleDateString('en-US', { month: 'short' })}
            onValueChange={handleMonthChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Teams</Label>
          <Badge variant="secondary">
            {enrolledTeams.length} enrolled
          </Badge>
        </div>

        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-md border p-3">
            No teams available. Create some teams first.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Enrolled</p>
              {enrolledTeams.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-md border p-3 tournament-team-empty">
                  No teams enrolled yet. Search and add from the list below.
                </p>
              ) : (
                <div className="tournament-team-chip-list">
                  {enrolledTeams.map((team) => (
                    <div
                      key={team.id}
                      className="tournament-team-chip"
                    >
                      <TeamBadge team={team} teamId={team.id} size="xs" />
                      <span className="tournament-team-chip-abbr">
                        {team.abbreviation}
                      </span>
                      <span className="tournament-team-chip-name">{team.name}</span>
                      <button
                        type="button"
                        className="tournament-team-chip-remove"
                        aria-label={`Remove ${team.name}`}
                        onClick={() => unenrollTeam(team.id)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tournament-team-search">Add teams</Label>
              <Input
                id="tournament-team-search"
                value={teamQuery}
                onChange={(e) => setTeamQuery(e.target.value)}
                placeholder="Search by name or abbreviation…"
                autoComplete="off"
              />
              <div className="tournament-team-picker-list">
                {availableTeams.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">
                    {teamQuery.trim()
                      ? 'No matching teams left to add.'
                      : 'All teams are enrolled.'}
                  </p>
                ) : (
                  availableTeams.map((team) => (
                    <div key={team.id} className="tournament-team-picker-row">
                      <div className="flex min-w-0 items-center gap-2">
                        <TeamBadge team={team} teamId={team.id} size="sm" />
                        <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">
                          {team.abbreviation}
                        </span>
                        <span className="truncate text-sm">{team.name}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => enrollTeam(team.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="tournament-form-actions">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit">
          {isEditing ? 'Update Tournament' : 'Create Tournament'}
        </Button>
      </div>
    </form>
  );
});

TournamentForm.displayName = 'TournamentForm';
