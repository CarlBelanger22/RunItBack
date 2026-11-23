import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Team, Tournament } from '../../App';
import { TournamentIconField } from '../TournamentIconField';
import { TeamBadge } from '../TeamBadge';
import { Badge } from '../ui/badge';
import { Plus, X } from 'lucide-react';
import {
  DEFAULT_NEW_SERIES_ROOKIE_MODE,
  formatContinueFromTournamentLabel,
  initialSeriesLinkMode,
  listContinueFromTournaments,
  normalizeRookieMode,
  resolveAwardSeriesFields,
  type AwardSeriesLinkMode,
  type RookieMode,
} from '../../utils/tournamentAwardSeries';

export type TournamentFormSubmitData = {
  name: string;
  description: string;
  year: number;
  month: string;
  teams: string[];
  icon?: string;
  awardSeriesId?: string;
  rookieMode?: RookieMode;
  /** Prior tournament that needs the same new series id stamped on save. */
  bootstrapSeriesOntoTournamentId?: string;
};

interface TournamentFormProps {
  initialData?: {
    name?: string;
    description?: string;
    year?: number;
    month?: string;
    selectedTeams?: string[];
    icon?: string;
    awardSeriesId?: string;
    rookieMode?: RookieMode;
  };
  tournamentId?: string;
  teams: Team[];
  /** Existing tournaments — used to list Continue-series options. */
  tournaments?: Tournament[];
  onSubmit: (data: TournamentFormSubmitData) => void;
  onCancel: () => void;
  isEditing?: boolean;
  formId?: string;
  hideActions?: boolean;
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
  tournaments = [],
  onSubmit,
  onCancel,
  isEditing = false,
  formId,
  hideActions = false,
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

  const [seriesLinkMode, setSeriesLinkMode] = useState<AwardSeriesLinkMode>(() =>
    initialSeriesLinkMode(
      initialData?.awardSeriesId
        ? { awardSeriesId: initialData.awardSeriesId }
        : null
    )
  );
  const [continueFromTournamentId, setContinueFromTournamentId] = useState('');
  const [rookieMode, setRookieMode] = useState<RookieMode>(
    () =>
      normalizeRookieMode(initialData?.rookieMode) ??
      DEFAULT_NEW_SERIES_ROOKIE_MODE
  );

  const continueFromOptions = useMemo(
    () => listContinueFromTournaments(tournaments, tournamentId),
    [tournaments, tournamentId]
  );

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

  const handleSeriesLinkChange = useCallback(
    (value: string) => {
      const mode = value as AwardSeriesLinkMode;
      setSeriesLinkMode(mode);
      if (mode === 'new') {
        setRookieMode(DEFAULT_NEW_SERIES_ROOKIE_MODE);
      } else if (mode === 'continue' && continueFromTournamentId) {
        const prior = tournaments.find((t) => t.id === continueFromTournamentId);
        setRookieMode(
          normalizeRookieMode(prior?.rookieMode) ?? DEFAULT_NEW_SERIES_ROOKIE_MODE
        );
      }
    },
    [continueFromTournamentId, tournaments]
  );

  const handleContinueFromChange = useCallback(
    (priorId: string) => {
      setContinueFromTournamentId(priorId);
      const prior = tournaments.find((t) => t.id === priorId);
      setRookieMode(
        normalizeRookieMode(prior?.rookieMode) ?? DEFAULT_NEW_SERIES_ROOKIE_MODE
      );
    },
    [tournaments]
  );

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    const seriesFields = resolveAwardSeriesFields({
      linkMode: seriesLinkMode,
      continueFromTournamentId,
      rookieMode,
      existingSeriesId: initialData?.awardSeriesId,
      tournaments,
    });

    if (
      seriesLinkMode === 'continue' &&
      !seriesFields.awardSeriesId &&
      !continueFromTournamentId
    ) {
      return;
    }

    const tournamentData: TournamentFormSubmitData = {
      name: nameRef.current?.value || '',
      description: descriptionRef.current?.value || '',
      year: parseInt(yearRef.current?.value || String(new Date().getFullYear())) || new Date().getFullYear(),
      month: month,
      teams: Array.from(selectedTeams),
      icon,
      awardSeriesId: seriesFields.awardSeriesId,
      rookieMode: seriesFields.rookieMode,
      bootstrapSeriesOntoTournamentId:
        seriesFields.bootstrapSeriesOntoTournamentId,
    };

    onSubmit(tournamentData);
  }, [
    onSubmit,
    month,
    selectedTeams,
    icon,
    seriesLinkMode,
    continueFromTournamentId,
    rookieMode,
    initialData?.awardSeriesId,
    tournaments,
  ]);

  const showRookieMode =
    seriesLinkMode === 'new' || seriesLinkMode === 'continue';
  const continueNeedsPick =
    seriesLinkMode === 'continue' &&
    !continueFromTournamentId &&
    !initialData?.awardSeriesId;

  return (
    <form id={formId} onSubmit={handleSubmit} className="tournament-form" onKeyDown={(e) => {
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

      <div className="space-y-3 rounded-md border p-3">
        <div className="space-y-1">
          <Label>Award series (ROTY / MIP)</Label>
          <p className="text-xs text-muted-foreground">
            Link progressive seasons of the same league (e.g. NBL Div 1, Rekt League).
            Standalone tournaments skip Rookie and Most Improved awards.
          </p>
        </div>

        <RadioGroup
          value={seriesLinkMode}
          onValueChange={handleSeriesLinkChange}
          className="gap-3"
        >
          <div className="flex items-start gap-2">
            <RadioGroupItem value="standalone" id="series-standalone" className="mt-0.5" />
            <Label htmlFor="series-standalone" className="font-normal leading-snug">
              Standalone — no ROTY / MIP
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="continue" id="series-continue" className="mt-0.5" />
            <Label htmlFor="series-continue" className="font-normal leading-snug">
              Continue existing series…
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="new" id="series-new" className="mt-0.5" />
            <Label htmlFor="series-new" className="font-normal leading-snug">
              Start new series
            </Label>
          </div>
        </RadioGroup>

        {seriesLinkMode === 'continue' ? (
          <div className="space-y-2 pl-6">
            {continueFromOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other tournaments yet. Use "Start new series" instead.
              </p>
            ) : (
              <>
                <Label htmlFor="continue-from-tournament">Continue from</Label>
                <Select
                  value={continueFromTournamentId || undefined}
                  onValueChange={handleContinueFromChange}
                >
                  <SelectTrigger id="continue-from-tournament">
                    <SelectValue placeholder="Pick a prior season…" />
                  </SelectTrigger>
                  <SelectContent>
                    {continueFromOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {formatContinueFromTournamentLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Pick the previous season of this league. If it is not in a series
                  yet, saving will link both tournaments into one series.
                </p>
              </>
            )}
            {continueNeedsPick ? (
              <p className="text-xs text-destructive">Pick a tournament to continue from.</p>
            ) : null}
          </div>
        ) : null}

        {showRookieMode ? (
          <div className="space-y-2 pl-6">
            <Label>Rookie awards</Label>
            <p className="text-xs text-muted-foreground">
              Manual = you tag real rookies (use when older seasons are not in the app).
              Auto = first appearance in this series in RunItBack counts as a rookie.
            </p>
            <Select
              value={rookieMode}
              onValueChange={(v) => {
                const next = normalizeRookieMode(v);
                if (next) setRookieMode(next);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual - I will tag rookies</SelectItem>
                <SelectItem value="auto">Auto - first in-app appearance</SelectItem>
                <SelectItem value="off">Off - hide Rookie of the Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
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

      {hideActions ? null : (
      <div className="tournament-form-actions">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={continueNeedsPick}>
          {isEditing ? 'Save' : 'Create Tournament'}
        </Button>
      </div>
      )}
    </form>
  );
});

TournamentForm.displayName = 'TournamentForm';
