import React, { useRef, useCallback, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Tournament } from '../../App';
import {
  generateTeamAbbreviation,
  isValidTeamAbbreviation,
  normalizeTeamAbbreviation,
  TEAM_ABBREV_MAX,
} from '../../utils/teamAbbreviation';
import { sortTournamentsByDateDesc } from '../../utils/tournamentSort';
import { TeamIconField } from '../TeamIconField';

export interface TeamFormValues {
  name: string;
  abbreviation: string;
  icon?: string;
  tournamentIds: string[];
}

interface TeamFormProps {
  initialName?: string;
  initialAbbreviation?: string;
  initialIcon?: string;
  initialTournamentIds?: string[];
  teamId?: string;
  takenAbbreviations?: string[];
  tournaments?: Tournament[];
  /** When true, tournament membership is fixed via initialTournamentIds (e.g. create from tournament page). */
  hideTournamentPicker?: boolean;
  onSubmit: (data: TeamFormValues) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export const TeamForm = React.memo(({
  initialName = '',
  initialAbbreviation = '',
  initialIcon,
  initialTournamentIds = [],
  teamId,
  takenAbbreviations = [],
  tournaments = [],
  hideTournamentPicker = false,
  onSubmit,
  onCancel,
  isEditing = false,
}: TeamFormProps) => {
  const nameRef = useRef<HTMLInputElement>(null);
  const abbreviationRef = useRef<HTMLInputElement>(null);
  const abbrevManuallyEditedRef = useRef(isEditing);
  const [icon, setIcon] = useState<string | undefined>(initialIcon);
  const [teamNamePreview, setTeamNamePreview] = useState(initialName);
  const [abbrevPreview, setAbbrevPreview] = useState(initialAbbreviation);
  const [selectedTournamentIds, setSelectedTournamentIds] = useState<Set<string>>(
    () => new Set(initialTournamentIds)
  );

  const sortedTournaments = useMemo(
    () => sortTournamentsByDateDesc(tournaments),
    [tournaments]
  );

  const syncAbbreviationFromName = useCallback(() => {
    if (abbrevManuallyEditedRef.current) return;
    const name = nameRef.current?.value || '';
    const abbrev = generateTeamAbbreviation(name, takenAbbreviations);
    if (abbreviationRef.current) {
      abbreviationRef.current.value = abbrev;
    }
  }, [takenAbbreviations]);

  const handleAbbreviationChange = useCallback(() => {
    abbrevManuallyEditedRef.current = true;
    if (abbreviationRef.current) {
      abbreviationRef.current.value = normalizeTeamAbbreviation(
        abbreviationRef.current.value
      );
    }
  }, []);

  const toggleTournament = useCallback((tournamentId: string) => {
    setSelectedTournamentIds((prev) => {
      const next = new Set(prev);
      if (next.has(tournamentId)) {
        next.delete(tournamentId);
      } else {
        next.add(tournamentId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const name = nameRef.current?.value.trim() || '';
      if (!name) return;

      const abbrevInput = normalizeTeamAbbreviation(
        abbreviationRef.current?.value.trim() || ''
      );
      const abbreviation =
        abbrevInput && isValidTeamAbbreviation(abbrevInput)
          ? abbrevInput
          : generateTeamAbbreviation(name, takenAbbreviations);

      if (
        abbrevInput &&
        !isValidTeamAbbreviation(abbrevInput) &&
        abbreviationRef.current
      ) {
        abbreviationRef.current.value = abbreviation;
      }

      onSubmit({
        name,
        abbreviation,
        icon,
        tournamentIds: isEditing
          ? []
          : hideTournamentPicker
            ? [...initialTournamentIds]
            : [...selectedTournamentIds],
      });
    },
    [onSubmit, takenAbbreviations, isEditing, selectedTournamentIds, icon, hideTournamentPicker, initialTournamentIds]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
          e.preventDefault();
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="teamName">Team Name</Label>
        <Input
          ref={nameRef}
          id="teamName"
          defaultValue={initialName}
          placeholder="Enter team name"
          required
          autoFocus
          onChange={(e) => {
            setTeamNamePreview(e.target.value);
            syncAbbreviationFromName();
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="teamAbbreviation">Abbreviation</Label>
        <Input
          ref={abbreviationRef}
          id="teamAbbreviation"
          defaultValue={initialAbbreviation}
          placeholder="2–5 letter code (e.g. NTU, SUTD, SUSS)"
          maxLength={TEAM_ABBREV_MAX}
          required
          onChange={(e) => {
            handleAbbreviationChange();
            setAbbrevPreview(e.target.value);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Auto-generated from the team name. You can edit it if needed.
        </p>
      </div>

      <TeamIconField
        value={icon}
        onChange={setIcon}
        teamName={teamNamePreview || 'Team'}
        abbreviation={abbrevPreview}
        teamId={teamId}
      />

      {!isEditing && !hideTournamentPicker && (
        <div className="space-y-2">
          <Label>Tournaments</Label>
          <p className="text-xs text-muted-foreground">
            Select which tournaments this team participates in.
          </p>
          <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
            {sortedTournaments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tournaments yet. Create a tournament first, or add this team to
                tournaments later.
              </p>
            ) : (
              sortedTournaments.map((tournament) => (
                <div key={tournament.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tournament-${tournament.id}`}
                    checked={selectedTournamentIds.has(tournament.id)}
                    onCheckedChange={() => toggleTournament(tournament.id)}
                  />
                  <Label
                    htmlFor={`tournament-${tournament.id}`}
                    className="text-sm cursor-pointer font-normal"
                  >
                    {tournament.name}
                    <span className="text-muted-foreground ml-1">
                      ({tournament.month} {tournament.year})
                    </span>
                  </Label>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{isEditing ? 'Update Team' : 'Create Team'}</Button>
      </div>
    </form>
  );
});

TeamForm.displayName = 'TeamForm';
