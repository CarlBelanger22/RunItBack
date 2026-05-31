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
}

export function PlayerJerseyNumbersEditor({
  rows,
  onNumberChange,
}: PlayerJerseyNumbersEditorProps) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3 pb-4 border-b">
      <Label className="text-sm font-medium">Jersey numbers</Label>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.teamId} className="flex items-center gap-3">
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
