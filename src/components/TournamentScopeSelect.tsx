import React from 'react';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import type { TournamentScope, TournamentScopeOption } from '../utils/playerSeasonStats';

interface TournamentScopeSelectProps {
  options: TournamentScopeOption[];
  value: TournamentScope;
  onChange: (value: TournamentScope) => void;
  id?: string;
}

export function TournamentScopeSelect({
  options,
  value,
  onChange,
  id = 'tournament-scope',
}: TournamentScopeSelectProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <Label htmlFor={id} className="text-sm text-muted-foreground shrink-0">
        Tournament
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full sm:w-[280px]">
          <SelectValue placeholder="Select tournament" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
