import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Player, Tournament } from '../App';
import type { TournamentRosterEntry } from '../utils/tournamentRosters';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';

interface TournamentRosterCellProps {
  player: Player;
  entries: TournamentRosterEntry[];
  addableTournaments: Tournament[];
  tournaments: Tournament[];
  hasEnrolledTournaments: boolean;
  onAdd: (tournamentId: string) => void;
  onRemove: (tournamentId: string, tournamentName: string) => void;
}

export function TournamentRosterCell({
  player,
  entries,
  addableTournaments,
  tournaments,
  hasEnrolledTournaments,
  onAdd,
  onRemove,
}: TournamentRosterCellProps) {
  const [addOpen, setAddOpen] = useState(false);

  const tournamentName = (tournamentId: string) =>
    tournaments.find((t) => t.id === tournamentId)?.name ?? tournamentId;

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      {entries.map((entry) => (
        <Badge
          key={entry.tournamentId}
          variant="secondary"
          className="gap-1 pr-1 font-normal max-w-full"
        >
          <span className="truncate max-w-[180px]">
            {tournamentName(entry.tournamentId)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${player.name} from ${tournamentName(entry.tournamentId)}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(entry.tournamentId, tournamentName(entry.tournamentId));
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            disabled={!hasEnrolledTournaments || addableTournaments.length === 0}
            aria-label={`Add ${player.name} to a tournament`}
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-56 p-1"
          align="start"
          onClick={(e) => e.stopPropagation()}
        >
          {addableTournaments.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2 py-1.5">
              {hasEnrolledTournaments
                ? 'On all enrolled tournaments'
                : 'No tournaments enrolled'}
            </p>
          ) : (
            <ul className="flex flex-col">
              {addableTournaments.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      onAdd(t.id);
                      setAddOpen(false);
                    }}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
