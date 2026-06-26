import React, { useMemo } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';
import type { GameFormatScope } from '../utils/gameFormat';
import {
  applyClearTournamentSelection,
  applySelectAllTournaments,
  applyTournamentToggle,
  isTournamentCheckedInScope,
  tournamentSelectionTriggerLabel,
  type TournamentIdSet,
  type TournamentSelectOption,
} from '../utils/tournamentSelection';

export interface TournamentSelectionScopeChange {
  format: GameFormatScope;
  selection: TournamentIdSet;
}

interface TournamentMultiSelectProps {
  options: TournamentSelectOption[];
  value: TournamentIdSet;
  gameFormatScope: GameFormatScope;
  onSelectionScopeChange: (change: TournamentSelectionScopeChange) => void;
  id?: string;
  className?: string;
}

export function TournamentMultiSelect({
  options,
  value,
  gameFormatScope,
  onSelectionScopeChange,
  id = 'tournament-multi-select',
  className,
}: TournamentMultiSelectProps) {
  const triggerLabel = tournamentSelectionTriggerLabel(value, options, gameFormatScope);

  const isChecked = useMemo(
    () => (tournamentId: string, optionFormat: TournamentSelectOption['gameFormat']) =>
      isTournamentCheckedInScope(
        tournamentId,
        optionFormat,
        gameFormatScope,
        value,
        options
      ),
    [gameFormatScope, value, options]
  );

  const handleToggle = (tournamentId: string, checked: boolean) => {
    onSelectionScopeChange(
      applyTournamentToggle(tournamentId, checked, gameFormatScope, value, options)
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            'h-9 w-full justify-between bg-background font-normal shadow-sm',
            className
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,20rem)] p-0" align="end">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => onSelectionScopeChange(applySelectAllTournaments())}
          >
            Select all
          </button>
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground hover:underline"
            onClick={() =>
              onSelectionScopeChange(applyClearTournamentSelection(gameFormatScope))
            }
          >
            Clear
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {options.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No tournaments</p>
          ) : (
            options.map((option) => {
              const itemId = `${id}-${option.id}`;
              const checked = isChecked(option.id, option.gameFormat);
              return (
                <div
                  key={option.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <Checkbox
                    id={itemId}
                    checked={checked}
                    onCheckedChange={(next) =>
                      handleToggle(option.id, next === true)
                    }
                  />
                  <Label htmlFor={itemId} className="cursor-pointer text-sm font-normal">
                    {option.label}
                  </Label>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
