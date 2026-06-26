import React from 'react';
import { cn } from './ui/utils';
import {
  type GameFormatScope,
  gameFormatScopeLabel,
} from '../utils/gameFormat';

interface GameFormatToggleProps {
  value: GameFormatScope;
  onChange: (value: GameFormatScope) => void;
  id?: string;
  showCombinedWarning?: boolean;
  /** Inline layout without block wrapper — for combined filter bars. */
  inline?: boolean;
}

const SCOPES: GameFormatScope[] = ['5v5', '3x3', 'combined'];

export function GameFormatToggle({
  value,
  onChange,
  id = 'game-format-scope',
  showCombinedWarning = true,
  inline = false,
}: GameFormatToggleProps) {
  const control = (
    <div
      id={id}
      role="radiogroup"
      aria-label="Game format"
      className="inline-flex h-9 items-center rounded-lg border border-border/60 bg-muted/50 p-0.5"
    >
      {SCOPES.map((scope) => {
        const selected = value === scope;
        return (
          <button
            key={scope}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(scope)}
            className={cn(
              'h-full min-w-[4.25rem] rounded-md px-3 text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {gameFormatScopeLabel(scope)}
          </button>
        );
      })}
    </div>
  );

  if (inline) {
    return control;
  }

  return (
    <div className="space-y-2">
      {control}
      {showCombinedWarning && value === 'combined' && (
        <p className="text-xs text-muted-foreground max-w-xl">
          Combined mixes 5v5 and 3×3 games — per-game averages are not directly comparable.
        </p>
      )}
    </div>
  );
}
