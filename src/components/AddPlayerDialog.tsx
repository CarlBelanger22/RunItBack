import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PlayerForm } from './forms/PlayerForm';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Team, Player, Tournament } from '../App';
import {
  getLeaguePlayerPool,
  isPlayerOnTeam,
  wouldRosterViolateTournamentOverlap,
} from '../utils/rosterPlayers';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from './ui/utils';

export interface AddPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  teams: Team[];
  tournaments: Tournament[];
  orphanPlayers?: Player[];
  positions?: string[];
  onSubmit: (player: Player) => void;
}

function buildNewPlayer(data: {
  name: string;
  number: string;
  position: string;
  secondaryPosition?: string;
  height: string;
  weight: string;
  dateOfBirth?: string;
}): Player {
  let age = 0;
  if (data.dateOfBirth) {
    const birthDate = new Date(data.dateOfBirth);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
  }

  return {
    id: `player-${Date.now()}`,
    name: data.name,
    number: parseInt(data.number, 10),
    position: data.position,
    secondaryPosition: data.secondaryPosition,
    height: data.height || '',
    weight: data.weight || '',
    age,
    dateOfBirth: data.dateOfBirth,
  };
}

export function AddPlayerDialog({
  open,
  onOpenChange,
  team,
  teams,
  tournaments,
  orphanPlayers = [],
  positions = ['PG', 'SG', 'SF', 'PF', 'C'],
  onSubmit,
}: AddPlayerDialogProps) {
  const [tab, setTab] = useState<'new' | 'existing'>('new');
  const [formKey, setFormKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [existingNumber, setExistingNumber] = useState('');

  const availablePool = useMemo(
    () =>
      getLeaguePlayerPool(teams, orphanPlayers).filter(
        (entry) => !isPlayerOnTeam(entry.player.id, team.id, teams)
      ),
    [teams, orphanPlayers, team.id]
  );

  const selectedEntry = useMemo(
    () => availablePool.find((e) => e.player.id === selectedPlayerId) ?? null,
    [availablePool, selectedPlayerId]
  );

  const overlapViolation = useMemo(() => {
    if (!selectedPlayerId) return null;
    return wouldRosterViolateTournamentOverlap(
      selectedPlayerId,
      team.id,
      teams,
      tournaments
    );
  }, [selectedPlayerId, team.id, teams, tournaments]);

  useEffect(() => {
    if (open) {
      setFormKey((k) => k + 1);
      setTab('new');
      setSelectedPlayerId(null);
      setExistingNumber('');
      setPickerOpen(false);
    }
  }, [open, positions]);

  const handleNewSubmit = useCallback(
    (data: {
      name: string;
      number: string;
      position: string;
      secondaryPosition?: string;
      height: string;
      weight: string;
      dateOfBirth?: string;
    }) => {
      onSubmit(buildNewPlayer(data));
      onOpenChange(false);
    },
    [onSubmit, onOpenChange]
  );

  const handleExistingSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedEntry || !existingNumber.trim() || overlapViolation?.violates) {
        return;
      }
      onSubmit({
        ...selectedEntry.player,
        number: parseInt(existingNumber, 10),
      });
      onOpenChange(false);
    },
    [
      selectedEntry,
      existingNumber,
      overlapViolation,
      onSubmit,
      onOpenChange,
    ]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Player to {team.name}</DialogTitle>
          <DialogDescription>
            Create a new player or link someone already in your league.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as 'new' | 'existing')}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New player</TabsTrigger>
            <TabsTrigger value="existing" disabled={availablePool.length === 0}>
              Existing player
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4">
            <PlayerForm
              key={formKey}
              selectedTeam={team}
              positions={positions}
              onSubmit={handleNewSubmit}
              onCancel={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="existing" className="mt-4">
            {availablePool.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No other players in the league yet. Create a new player first.
              </p>
            ) : (
              <form onSubmit={handleExistingSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Player</Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={pickerOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedEntry ? selectedEntry.player.name : 'Search players...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search by name or team" />
                        <CommandList>
                          <CommandEmpty>No players found.</CommandEmpty>
                          <CommandGroup>
                            {availablePool.map(({ player, teamNames }) => (
                              <CommandItem
                                key={player.id}
                                value={`${player.name} ${teamNames.join(' ')}`}
                                onSelect={() => {
                                  setSelectedPlayerId(player.id);
                                  setPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selectedPlayerId === player.id
                                      ? 'opacity-100'
                                      : 'opacity-0'
                                  )}
                                />
                                <div className="min-w-0">
                                  <div className="truncate">{player.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {teamNames.join(', ')}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {overlapViolation?.violates && (
                  <p className="text-sm text-destructive">
                    {overlapViolation.message}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="existingNumber">Jersey Number</Label>
                  <Input
                    id="existingNumber"
                    type="number"
                    min={0}
                    max={99}
                    value={existingNumber}
                    onChange={(e) => setExistingNumber(e.target.value)}
                    placeholder="0-99"
                    required
                  />
                  {selectedEntry && (
                    <p className="text-xs text-muted-foreground">
                      Position:{' '}
                      {selectedEntry.player.position}
                      {selectedEntry.player.secondaryPosition
                        ? ` / ${selectedEntry.player.secondaryPosition}`
                        : ''}{' '}
                      (global profile)
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      !selectedPlayerId ||
                      !existingNumber.trim() ||
                      overlapViolation?.violates
                    }
                  >
                    Add to roster
                  </Button>
                </div>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
