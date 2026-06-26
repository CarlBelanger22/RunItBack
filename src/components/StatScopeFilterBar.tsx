import React from 'react';
import { Label } from './ui/label';
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
}: StatScopeFilterBarProps) {
  const showTournament =
    tournamentOptions !== undefined && onTournamentSelectionScopeChange !== undefined;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <FilterField label="Format">
          <GameFormatToggle
            value={gameFormatScope}
            onChange={onGameFormatScopeChange}
            id={formatToggleId}
            showCombinedWarning={false}
            inline
          />
        </FilterField>

        {showTournament && (
          <>
            <div
              className="hidden sm:block w-px self-stretch bg-border/60 mx-1 mb-0.5"
              aria-hidden
            />
            <FilterField
              label="Tournament"
              htmlFor={tournamentSelectId}
              className="w-full sm:w-auto sm:min-w-[14rem]"
            >
              <TournamentMultiSelect
                id={tournamentSelectId}
                options={tournamentOptions}
                value={selectedTournamentIds}
                gameFormatScope={gameFormatScope}
                onSelectionScopeChange={onTournamentSelectionScopeChange}
              />
            </FilterField>
          </>
        )}
      </div>

      {gameFormatScopeUsesCombinedWarning(gameFormatScope) && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground border-t border-border/40 pt-3">
          Combined mixes 5v5 and 3×3 games — per-game averages are not directly
          comparable.
        </p>
      )}
    </div>
  );
}
