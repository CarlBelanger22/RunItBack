import React from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { TeamBadge } from './TeamBadge';
import type { PlayerJerseyEditorTeamGroup } from '../utils/playerJerseyResolution';

interface PlayerTournamentJerseyEditorProps {
  groups: PlayerJerseyEditorTeamGroup[];
  clubNumbers: Record<string, string>;
  tournamentNumbers: Record<string, string>;
  onClubNumberChange: (teamId: string, value: string) => void;
  onTournamentNumberChange: (
    teamId: string,
    tournamentId: string,
    value: string
  ) => void;
}

function tournamentDraftKey(teamId: string, tournamentId: string): string {
  return `${teamId}:${tournamentId}`;
}

export function PlayerTournamentJerseyEditor({
  groups,
  clubNumbers,
  tournamentNumbers,
  onClubNumberChange,
  onTournamentNumberChange,
}: PlayerTournamentJerseyEditorProps) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-4 pb-4 border-b">
      <Label className="text-sm font-medium">Jersey numbers</Label>
      <div className="space-y-4">
        {groups.map((group) => (
          <div
            key={group.team.id}
            className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <TeamBadge team={group.team} teamId={group.team.id} size="sm" />
              <span className="text-sm font-medium truncate" title={group.team.name}>
                {group.team.name}
              </span>
            </div>

            <div className="flex items-center gap-3 pl-1">
              <Label
                htmlFor={`club-jersey-${group.team.id}`}
                className="text-xs text-muted-foreground shrink-0 w-24"
              >
                Club number
              </Label>
              <div className="w-24 shrink-0">
                <Input
                  id={`club-jersey-${group.team.id}`}
                  type="number"
                  min={0}
                  max={99}
                  value={clubNumbers[group.team.id] ?? String(group.clubNumber)}
                  onChange={(e) => onClubNumberChange(group.team.id, e.target.value)}
                  placeholder="0-99"
                  aria-label={`Club jersey number for ${group.team.name}`}
                />
              </div>
            </div>

            <div className="space-y-2 pl-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tournaments
              </p>
              {group.tournaments.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-1">
                  No tournament entries yet
                </p>
              ) : (
                group.tournaments.map((tournament) => {
                  const key = tournamentDraftKey(
                    group.team.id,
                    tournament.tournamentId
                  );
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 pl-2 border-l-2 border-border/50"
                    >
                      <span
                        className="text-sm truncate flex-1 min-w-0"
                        title={tournament.tournamentName}
                      >
                        {tournament.tournamentName}
                      </span>
                      <div className="w-24 shrink-0">
                        <Input
                          type="number"
                          min={0}
                          max={99}
                          value={
                            tournamentNumbers[key] ?? String(tournament.number)
                          }
                          onChange={(e) =>
                            onTournamentNumberChange(
                              group.team.id,
                              tournament.tournamentId,
                              e.target.value
                            )
                          }
                          placeholder="0-99"
                          aria-label={`Jersey number for ${tournament.tournamentName}`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
