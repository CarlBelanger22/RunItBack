import React from 'react';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { GameFormatToggle } from './GameFormatToggle';
import {
  TournamentMultiSelect,
  type TournamentSelectionScopeChange,
} from './TournamentMultiSelect';
import {
  gameFormatScopeUsesCombinedWarning,
  type GameFormatScope,
} from '../utils/gameFormat';
import type { TournamentIdSet, TournamentSelectOption } from '../utils/tournamentSelection';

export type StatScopeTournamentOption = TournamentSelectOption;

interface StatScopeFilterBarProps {
  gameFormatScope: GameFormatScope;
  onGameFormatScopeChange: (scope: GameFormatScope) => void;
  selectedTournamentIds?: TournamentIdSet;
  onTournamentSelectionScopeChange?: (change: TournamentSelectionScopeChange) => void;
  tournamentOptions?: StatScopeTournamentOption[];
  formatToggleId?: string;
  tournamentSelectId?: string;
  includeFriendlies?: boolean;
  onIncludeFriendliesChange?: (value: boolean) => void;
  includeFriendliesId?: string;
  includeFriendliesDisabled?: boolean;
}

function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

export function StatScopeFilterBar({
  gameFormatScope,
  onGameFormatScopeChange,
  selectedTournamentIds = null,
  onTournamentSelectionScopeChange,
  tournamentOptions,
  formatToggleId = 'game-format-scope',
  tournamentSelectId = 'tournament-scope',
  includeFriendlies = false,
  onIncludeFriendliesChange,
  includeFriendliesId = 'include-friendlies',
  includeFriendliesDisabled = false,
}: StatScopeFilterBarProps) {
  const showTournament =
    tournamentOptions !== undefined && onTournamentSelectionScopeChange !== undefined;
  const showIncludeFriendlies = onIncludeFriendliesChange !== undefined;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
      <div className="flex flex-nowrap items-end justify-between gap-4">
        <div className="flex shrink-0 items-end gap-x-4">
          <FilterField label="Format">
            <GameFormatToggle
              value={gameFormatScope}
              onChange={onGameFormatScopeChange}
              id={formatToggleId}
              showCombinedWarning={false}
              inline
            />
          </FilterField>

          {showIncludeFriendlies && (
            <div
              className="flex items-center gap-2 pb-1"
              title={
                includeFriendliesDisabled
                  ? 'No completed friendly games with stats for this player in the current format'
                  : 'Merge friendly games into the All Time summary row'
              }
            >
              <Checkbox
                id={includeFriendliesId}
                checked={includeFriendlies}
                disabled={includeFriendliesDisabled}
                onCheckedChange={(checked) =>
                  onIncludeFriendliesChange(checked === true)
                }
              />
              <Label
                htmlFor={includeFriendliesId}
                className="cursor-pointer whitespace-nowrap text-sm font-normal leading-none"
              >
                Include Friendlies
              </Label>
            </div>
          )}
        </div>

        {showTournament && (
          <FilterField
            label="Tournament"
            htmlFor={tournamentSelectId}
            className="w-1/3 min-w-[14rem] shrink-0"
          >
            <TournamentMultiSelect
              id={tournamentSelectId}
              className="h-9 w-full min-w-0"
              options={tournamentOptions}
              value={selectedTournamentIds}
              gameFormatScope={gameFormatScope}
              onSelectionScopeChange={onTournamentSelectionScopeChange}
            />
          </FilterField>
        )}
      </div>

      {gameFormatScopeUsesCombinedWarning(gameFormatScope) && (
        <p className="mt-3 border-t border-border/40 pt-3 text-xs leading-relaxed text-muted-foreground">
          Combined mixes 5v5 and 3×3 games — per-game averages are not directly
          comparable.
        </p>
      )}
    </div>
  );
}
