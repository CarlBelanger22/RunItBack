/**
 * LE-112 — Simplified classification bracket editor (match-first UI).
 */
import React, { useState } from 'react';
import type {
  BracketFromOutcome,
  BracketRound,
  BracketSlot,
  TournamentStage,
} from '../utils/tournamentStructure';
import { newStructureId } from '../utils/tournamentStructure';
import { buildEightTeamBracket, buildFourTeamBracket, buildLast16Bracket, buildTwelveTeamBracket } from '../utils/fourTeamBracket';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';

const SIDE_SEED = 'seed';
const SIDE_WINNER = 'winner';
const SIDE_LOSER = 'loser';
const SLOT_NONE = '__none__';

type SideMode = typeof SIDE_SEED | typeof SIDE_WINNER | typeof SIDE_LOSER;

function emptySlot(): BracketSlot {
  return {
    id: newStructureId('slot'),
    label: 'Match',
    homeTeamId: null,
    awayTeamId: null,
    gameId: null,
    homeFromSlotId: null,
    awayFromSlotId: null,
    homeFromOutcome: null,
    awayFromOutcome: null,
    homeSeedLabel: null,
    awaySeedLabel: null,
    winnerPlace: null,
    loserPlace: null,
  };
}

function allSlotsInStage(stage: TournamentStage): BracketSlot[] {
  return (stage.bracket?.rounds ?? []).flatMap((r) => r.slots);
}

function parsePlaceInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

function sideModeFromSlot(
  fromSlotId: string | null | undefined,
  fromOutcome: BracketFromOutcome | null | undefined
): SideMode {
  if (fromSlotId) {
    return fromOutcome === 'loser' ? SIDE_LOSER : SIDE_WINNER;
  }
  return SIDE_SEED;
}

interface ClassificationBracketStructureEditorProps {
  stage: TournamentStage;
  onChangeBracket: (rounds: BracketRound[]) => void;
}

export function ClassificationBracketStructureEditor({
  stage,
  onChangeBracket,
}: ClassificationBracketStructureEditorProps) {
  const rounds = stage.bracket?.rounds ?? [];
  const slotOptions = allSlotsInStage(stage);
  const [pendingTemplate, setPendingTemplate] = useState<
    'four' | 'eight' | 'twelve' | 'sixteen' | null
  >(null);

  const setRounds = (next: BracketRound[]) => onChangeBracket(next);

  const updateRound = (roundId: string, patch: Partial<BracketRound>) => {
    setRounds(rounds.map((r) => (r.id === roundId ? { ...r, ...patch } : r)));
  };

  const updateSlot = (
    roundId: string,
    slotId: string,
    patch: Partial<BracketSlot>
  ) => {
    setRounds(
      rounds.map((r) => {
        if (r.id !== roundId) return r;
        return {
          ...r,
          slots: r.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)),
        };
      })
    );
  };

  const addSection = () => {
    setRounds([
      ...rounds,
      {
        id: newStructureId('round'),
        name: rounds.length === 0 ? 'Finals' : `Section ${rounds.length + 1}`,
        slots: [emptySlot()],
      },
    ]);
  };

  const addMatch = (roundId: string) => {
    setRounds(
      rounds.map((r) =>
        r.id === roundId ? { ...r, slots: [...r.slots, emptySlot()] } : r
      )
    );
  };

  const deleteSection = (roundId: string) => {
    setRounds(rounds.filter((r) => r.id !== roundId));
  };

  const deleteMatch = (roundId: string, slotId: string) => {
    setRounds(
      rounds.map((r) => {
        if (r.id !== roundId) return r;
        return { ...r, slots: r.slots.filter((s) => s.id !== slotId) };
      })
    );
  };

  const applyTemplate = (kind: 'four' | 'eight' | 'twelve' | 'sixteen') => {
    setRounds(
      kind === 'sixteen'
        ? buildLast16Bracket(stage.id).rounds
        : kind === 'twelve'
          ? buildTwelveTeamBracket(stage.id).rounds
          : kind === 'eight'
            ? buildEightTeamBracket(stage.id).rounds
            : buildFourTeamBracket(stage.id).rounds
    );
    setPendingTemplate(null);
  };

  const requestTemplate = (kind: 'four' | 'eight' | 'twelve' | 'sixteen') => {
    const hasMatches = rounds.some((r) => r.slots.length > 0);
    if (hasMatches) {
      setPendingTemplate(kind);
      return;
    }
    applyTemplate(kind);
  };

  return (
    <div className="space-y-3 rounded-md border p-3 mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Bracket</p>
          <p className="text-xs text-muted-foreground">
            Name each match, set who plays (seed or winner/loser of another
            match). Link games on Standings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                Templates
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => requestTemplate('four')}>
                4-Team
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => requestTemplate('eight')}>
                8-Team
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => requestTemplate('twelve')}>
                12-Team
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => requestTemplate('sixteen')}>
                16-Team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" variant="outline" size="sm" onClick={addSection}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Section
          </Button>
        </div>
      </div>

      {rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matches yet. Add a section or use Templates (4-Team / 8-Team / 12-Team / 16-Team).
        </p>
      ) : null}

      {rounds.map((round) => (
        <div key={round.id} className="space-y-2 rounded-md border p-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[8rem]">
              <Label className="text-xs">Section</Label>
              <Input
                value={round.name}
                onChange={(e) => updateRound(round.id, { name: e.target.value })}
                placeholder="Semis, Finals…"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addMatch(round.id)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Match
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => deleteSection(round.id)}
              aria-label={`Delete section ${round.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {round.slots.map((slot, index) => (
            <MatchCard
              key={slot.id}
              matchNumber={index + 1}
              slot={slot}
              slotOptions={slotOptions.filter((s) => s.id !== slot.id)}
              onChange={(patch) => updateSlot(round.id, slot.id, patch)}
              onDelete={() => deleteMatch(round.id, slot.id)}
            />
          ))}
        </div>
      ))}

      <AlertDialog
        open={pendingTemplate != null}
        onOpenChange={(open) => {
          if (!open) setPendingTemplate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this bracket?</AlertDialogTitle>
            <AlertDialogDescription>
              Applying{' '}
              {pendingTemplate === 'sixteen'
                ? '16-Team'
                : pendingTemplate === 'twelve'
                  ? '12-Team'
                  : pendingTemplate === 'eight'
                    ? '8-Team'
                    : '4-Team'}{' '}
              will replace
              the current matches on this stage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTemplate) applyTemplate(pendingTemplate);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MatchCard({
  matchNumber,
  slot,
  slotOptions,
  onChange,
  onDelete,
}: {
  matchNumber: number;
  slot: BracketSlot;
  slotOptions: BracketSlot[];
  onChange: (patch: Partial<BracketSlot>) => void;
  onDelete: () => void;
}) {
  const [placesOpen, setPlacesOpen] = useState(
    () => slot.winnerPlace != null || slot.loserPlace != null
  );

  return (
    <div className="space-y-2 rounded border p-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[8rem]">
          <Label className="text-xs">Match {matchNumber} title</Label>
          <Input
            value={slot.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value || undefined })}
            placeholder="Final, 3rd Place, B3 vs B4…"
          />
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <SideChooser
        title="Home"
        seed={slot.homeSeedLabel}
        fromSlotId={slot.homeFromSlotId}
        fromOutcome={slot.homeFromOutcome}
        slotOptions={slotOptions}
        onChange={({ seed, fromSlotId, fromOutcome }) =>
          onChange({
            homeSeedLabel: seed,
            homeFromSlotId: fromSlotId,
            homeFromOutcome: fromOutcome,
          })
        }
      />
      <SideChooser
        title="Away"
        seed={slot.awaySeedLabel}
        fromSlotId={slot.awayFromSlotId}
        fromOutcome={slot.awayFromOutcome}
        slotOptions={slotOptions}
        onChange={({ seed, fromSlotId, fromOutcome }) =>
          onChange({
            awaySeedLabel: seed,
            awayFromSlotId: fromSlotId,
            awayFromOutcome: fromOutcome,
          })
        }
      />

      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground"
          onClick={() => setPlacesOpen((o) => !o)}
        >
          {placesOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Medal places (optional — auto from title)
        </button>
        {placesOpen ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="w-20">
              <Label className="text-xs">Winner</Label>
              <Input
                inputMode="numeric"
                value={slot.winnerPlace ?? ''}
                onChange={(e) =>
                  onChange({ winnerPlace: parsePlaceInput(e.target.value) })
                }
                placeholder="auto"
              />
            </div>
            <div className="w-20">
              <Label className="text-xs">Loser</Label>
              <Input
                inputMode="numeric"
                value={slot.loserPlace ?? ''}
                onChange={(e) =>
                  onChange({ loserPlace: parsePlaceInput(e.target.value) })
                }
                placeholder="auto"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SideChooser({
  title,
  seed,
  fromSlotId,
  fromOutcome,
  slotOptions,
  onChange,
}: {
  title: string;
  seed?: string | null;
  fromSlotId?: string | null;
  fromOutcome?: BracketFromOutcome | null;
  slotOptions: BracketSlot[];
  onChange: (next: {
    seed: string | null;
    fromSlotId: string | null;
    fromOutcome: BracketFromOutcome | null;
  }) => void;
}) {
  const mode = sideModeFromSlot(fromSlotId, fromOutcome);

  const setMode = (next: SideMode) => {
    if (next === SIDE_SEED) {
      onChange({
        seed: seed ?? null,
        fromSlotId: null,
        fromOutcome: null,
      });
      return;
    }
    onChange({
      seed: null,
      fromSlotId: fromSlotId ?? slotOptions[0]?.id ?? null,
      fromOutcome: next === SIDE_LOSER ? 'loser' : 'winner',
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <span className="text-xs text-muted-foreground w-10 shrink-0">{title}</span>
      <div className="w-32">
        <Label className="text-xs">Type</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as SideMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIDE_SEED}>Seed</SelectItem>
            <SelectItem value={SIDE_WINNER}>Winner of</SelectItem>
            <SelectItem value={SIDE_LOSER}>Loser of</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === SIDE_SEED ? (
        <div className="min-w-[6rem] flex-1">
          <Label className="text-xs">Seed</Label>
          <Input
            value={seed ?? ''}
            onChange={(e) =>
              onChange({
                seed: e.target.value.trim() || null,
                fromSlotId: null,
                fromOutcome: null,
              })
            }
            placeholder="B3"
          />
        </div>
      ) : (
        <div className="min-w-[9rem] flex-1">
          <Label className="text-xs">Match</Label>
          <Select
            value={fromSlotId || SLOT_NONE}
            onValueChange={(v) =>
              onChange({
                seed: null,
                fromSlotId: v === SLOT_NONE ? null : v,
                fromOutcome: mode === SIDE_LOSER ? 'loser' : 'winner',
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick match" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SLOT_NONE}>Pick match</SelectItem>
              {slotOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label || s.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
