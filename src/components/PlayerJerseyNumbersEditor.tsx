import React from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { TeamBadge } from './TeamBadge';
import type { Team } from '../App';

export interface JerseyNumberRow {
  teamId: string;
  teamName: string;
  teamAbbreviation: string;
  team: Team;
  number: string;
}

interface PlayerJerseyNumbersEditorProps {
  rows: JerseyNumberRow[];
  onNumberChange: (teamId: string, value: string) => void;
  isNumberTaken: (number: string, teamId: string, excludePlayerId?: string) => boolean;
  excludePlayerId?: string;
}

export function PlayerJerseyNumbersEditor({
  rows,
  onNumberChange,
  isNumberTaken,
  excludePlayerId,
}: PlayerJerseyNumbersEditorProps) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3 pb-4 border-b">
      <Label className="text-sm font-medium">Jersey numbers</Label>
      <div className="space-y-2">
        {rows.map((row) => {
          const taken =
            row.number.trim() !== '' &&
            isNumberTaken(row.number, row.teamId, excludePlayerId);
          return (
            <div
              key={row.teamId}
              className="flex items-center gap-3"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <TeamBadge team={row.team} teamId={row.teamId} size="sm" />
                <span className="text-sm truncate" title={row.teamName}>
                  {row.teamAbbreviation}
                </span>
              </div>
              <div className="w-24 shrink-0">
                <Input
                  type="number"
                  min={0}
                  max={99}
                  value={row.number}
                  onChange={(e) => onNumberChange(row.teamId, e.target.value)}
                  placeholder="0-99"
                  aria-label={`Jersey number for ${row.teamName}`}
                />
                {taken && (
                  <p className="text-xs text-destructive mt-0.5">Taken</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
