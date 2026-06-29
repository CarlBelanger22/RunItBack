import React, { useState, useEffect } from 'react';
import type { GameEvent, Team, Player } from '../../App';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';

interface EventEditDialogProps {
  event: GameEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homeTeam: Team;
  awayTeam: Team;
  onSave: (updated: GameEvent) => void;
}

export function EventEditDialog({
  event,
  open,
  onOpenChange,
  homeTeam,
  awayTeam,
  onSave,
}: EventEditDialogProps) {
  const [playerId, setPlayerId] = useState<string | undefined>();
  const [made, setMade] = useState(false);

  useEffect(() => {
    if (event) {
      setPlayerId(event.playerId);
      if (event.type === 'shot_attempt') {
        setMade(!!event.details.made);
      }
    }
  }, [event]);

  if (!event) return null;

  const team = event.teamId === homeTeam.id ? homeTeam : awayTeam;
  const players: Player[] = team.players;

  const canEditMade = event.type === 'shot_attempt';
  const canEditPlayer = !!event.playerId || event.type !== 'substitution';

  const handleSave = () => {
    const updated: GameEvent = {
      ...event,
      playerId: playerId ?? event.playerId,
      details: canEditMade ? { ...event.details, made } : { ...event.details },
    };
    onSave(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground capitalize">
            {event.type.replace('_', ' ')} · {event.gameTime} · Q{event.period}
          </div>

          {canEditPlayer && players.length > 0 && (
            <div className="space-y-2">
              <Label>Player</Label>
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      #{p.number} {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {canEditMade && (
            <div className="flex items-center justify-between">
              <Label>Made shot</Label>
              <Switch checked={made} onCheckedChange={setMade} />
            </div>
          )}

          {!canEditPlayer && !canEditMade && (
            <p className="text-sm text-muted-foreground">
              This event type cannot be edited yet. Use Undo to remove it.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canEditPlayer && !canEditMade}>
            Save &amp; recalculate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
