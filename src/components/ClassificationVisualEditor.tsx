/**
 * LE-113 — Combined visual classification editor (tree + match inspector).
 */
import React, { useMemo, useState } from 'react';
import type { Game, Team, Tournament, TournamentUpdate } from '../App';
import type {
  BracketFromOutcome,
  BracketRound,
  BracketSlot,
  TournamentStructure,
} from '../utils/tournamentStructure';
import {
  findBracketSlot,
  newStructureId,
  normalizeTournamentStructure,
} from '../utils/tournamentStructure';
import {
  buildEightTeamBracket,
  buildFourTeamBracket,
  buildLast16Bracket,
  buildTwelveTeamBracket,
} from '../utils/fourTeamBracket';
import {
  canRemoveBracketLeg,
  removeBracketLeg,
} from '../utils/bracketLegs';
import {
  gamesAvailableForBracketSlot,
  linkGameToBracketSlot,
  unlinkGameFromBracketSlot,
} from '../utils/bracketGameLink';
import { TournamentClassificationBracket } from './TournamentClassificationBracket';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
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

function gameOptionLabel(game: Game): string {
  const home = game.homeTeam?.abbreviation || game.homeTeam?.name || 'Home';
  const away = game.awayTeam?.abbreviation || game.awayTeam?.name || 'Away';
  return `${home} vs ${away} · ${game.date}`;
}

interface ClassificationVisualEditorProps {
  tournament: Tournament;
  games: Game[];
  teams?: Team[];
  onUpdateTournament: (update: TournamentUpdate) => void;
  onGamesUpdate: (games: Game[]) => void;
  onNavigateToGame: (gameId: string) => void;
}

export function ClassificationVisualEditor({
  tournament,
  games,
  teams,
  onUpdateTournament,
  onGamesUpdate,
  onNavigateToGame,
}: ClassificationVisualEditorProps) {
  const structure = normalizeTournamentStructure(tournament.structure);
  const [activeStageId, setActiveStageId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [pendingTemplate, setPendingTemplate] = useState<
    'four' | 'eight' | 'twelve' | 'sixteen' | null
  >(null);

  const classificationStages = useMemo(
    () =>
      (structure?.stages ?? []).filter((s) => s.kind === 'classification'),
    [structure]
  );

  const activeStage =
    classificationStages.find((s) => s.id === activeStageId) ??
    classificationStages[0];

  const selectedSlot =
    activeStage && selectedSlotId
      ? findBracketSlot(
          { stages: [activeStage] },
          selectedSlotId
        ) ??
        activeStage.bracket?.rounds
          .flatMap((r) => r.slots)
          .find((s) => s.id === selectedSlotId)
      : undefined;

  const slotOptions = useMemo(() => {
    const all = (activeStage?.bracket?.rounds ?? []).flatMap((r) => r.slots);
    return all.filter((s) => s.id !== selectedSlotId);
  }, [activeStage, selectedSlotId]);

  const availableGames = useMemo(() => {
    if (!structure || !activeStage || !selectedSlotId) return [];
    return gamesAvailableForBracketSlot(
      games,
      structure,
      activeStage.id,
      selectedSlotId
    );
  }, [games, structure, activeStage, selectedSlotId]);

  const patchStructure = (
    updater: (prev: TournamentStructure | undefined) => TournamentStructure | undefined
  ) => {
    onUpdateTournament({
      id: tournament.id,
      patch: (prev) => ({
        ...prev,
        structure: updater(normalizeTournamentStructure(prev.structure)),
      }),
    });
  };

  const updateActiveRounds = (rounds: BracketRound[]) => {
    if (!activeStage) return;
    patchStructure((prev) => {
      if (!prev) return prev;
      return {
        stages: prev.stages.map((s) =>
          s.id === activeStage.id
            ? { ...s, bracket: rounds.length > 0 ? { rounds } : undefined }
            : s
        ),
      };
    });
  };

  const updateSelectedSlot = (patch: Partial<BracketSlot>) => {
    if (!activeStage || !selectedSlotId) return;
    const rounds = activeStage.bracket?.rounds ?? [];
    updateActiveRounds(
      rounds.map((r) => ({
        ...r,
        slots: r.slots.map((s) =>
          s.id === selectedSlotId ? { ...s, ...patch } : s
        ),
      }))
    );
  };

  const applyTemplate = (kind: 'four' | 'eight' | 'twelve' | 'sixteen') => {
    if (!activeStage) return;
    const rounds =
      kind === 'sixteen'
        ? buildLast16Bracket(activeStage.id).rounds
        : kind === 'twelve'
          ? buildTwelveTeamBracket(activeStage.id).rounds
          : kind === 'eight'
            ? buildEightTeamBracket(activeStage.id).rounds
            : buildFourTeamBracket(activeStage.id).rounds;
    updateActiveRounds(rounds);
    setSelectedSlotId(null);
    setPendingTemplate(null);
  };

  const requestTemplate = (kind: 'four' | 'eight' | 'twelve' | 'sixteen') => {
    if (!activeStage) return;
    const hasMatches = (activeStage.bracket?.rounds ?? []).some(
      (r) => r.slots.length > 0
    );
    if (hasMatches) {
      setPendingTemplate(kind);
      return;
    }
    applyTemplate(kind);
  };

  const addSection = () => {
    if (!activeStage) return;
    const rounds = activeStage.bracket?.rounds ?? [];
    updateActiveRounds([
      ...rounds,
      {
        id: newStructureId('round'),
        name: rounds.length === 0 ? 'Finals' : `Section ${rounds.length + 1}`,
        slots: [emptySlot()],
      },
    ]);
  };

  const addMatch = () => {
    if (!activeStage) return;
    const rounds = [...(activeStage.bracket?.rounds ?? [])];
    if (rounds.length === 0) {
      updateActiveRounds([
        {
          id: newStructureId('round'),
          name: 'Finals',
          slots: [emptySlot()],
        },
      ]);
      return;
    }
    const last = rounds[rounds.length - 1];
    rounds[rounds.length - 1] = {
      ...last,
      slots: [...last.slots, emptySlot()],
    };
    updateActiveRounds(rounds);
  };

  const deleteSelectedMatch = () => {
    if (!activeStage || !selectedSlotId) return;
    const rounds = activeStage.bracket?.rounds ?? [];
    // LE-125b — first-round feeder match: soft-remove leg (bye); else hard-delete
    if (canRemoveBracketLeg(rounds, selectedSlotId)) {
      updateActiveRounds(removeBracketLeg(rounds, selectedSlotId));
      setSelectedSlotId(null);
      return;
    }
    const next = rounds
      .map((r) => ({
        ...r,
        slots: r.slots.filter((s) => s.id !== selectedSlotId),
      }))
      .filter((r) => r.slots.length > 0);
    updateActiveRounds(next);
    setSelectedSlotId(null);
  };

  const confirmLink = () => {
    if (!structure || !selectedSlotId || !selectedGameId) return;
    const result = linkGameToBracketSlot(
      structure,
      games,
      selectedSlotId,
      selectedGameId
    );
    onUpdateTournament({
      id: tournament.id,
      patch: (prev) => ({ ...prev, structure: result.structure }),
    });
    onGamesUpdate(result.games);
    setLinkOpen(false);
    setSelectedGameId('');
  };

  const unlinkSelected = () => {
    if (!structure || !selectedSlotId) return;
    const result = unlinkGameFromBracketSlot(structure, games, selectedSlotId);
    onUpdateTournament({
      id: tournament.id,
      patch: (prev) => ({ ...prev, structure: result.structure }),
    });
    onGamesUpdate(result.games);
  };

  if (classificationStages.length === 0) return null;

  const toolbar = activeStage ? (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Templates
            <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
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
      <Button type="button" variant="outline" size="sm" onClick={addMatch}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Match
      </Button>
    </>
  ) : null;

  const inspector = selectedSlot ? (
    <div className="classification-match-inspector rounded-md border p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Selected match</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={deleteSelectedMatch}
          aria-label="Delete match"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div>
        <Label className="text-xs">Title</Label>
        <Input
          value={selectedSlot.label ?? ''}
          onChange={(e) =>
            updateSelectedSlot({ label: e.target.value || undefined })
          }
          placeholder="Final, 3rd Place, B3 vs B4…"
        />
      </div>
      <InspectorSide
        title="Home"
        seed={selectedSlot.homeSeedLabel}
        fromSlotId={selectedSlot.homeFromSlotId}
        fromOutcome={selectedSlot.homeFromOutcome}
        slotOptions={slotOptions}
        onChange={({ seed, fromSlotId, fromOutcome }) =>
          updateSelectedSlot({
            homeSeedLabel: seed,
            homeFromSlotId: fromSlotId,
            homeFromOutcome: fromOutcome,
          })
        }
      />
      <InspectorSide
        title="Away"
        seed={selectedSlot.awaySeedLabel}
        fromSlotId={selectedSlot.awayFromSlotId}
        fromOutcome={selectedSlot.awayFromOutcome}
        slotOptions={slotOptions}
        onChange={({ seed, fromSlotId, fromOutcome }) =>
          updateSelectedSlot({
            awaySeedLabel: seed,
            awayFromSlotId: fromSlotId,
            awayFromOutcome: fromOutcome,
          })
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setSelectedGameId(selectedSlot.gameId ?? '');
            setLinkOpen(true);
          }}
        >
          {selectedSlot.gameId ? 'Change linked game' : 'Link game'}
        </Button>
        {selectedSlot.gameId ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onNavigateToGame(selectedSlot.gameId!)}
            >
              Open game
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={unlinkSelected}
            >
              Unlink
            </Button>
          </>
        ) : null}
      </div>
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
          Medal places (optional)
        </button>
        {placesOpen ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="w-20">
              <Label className="text-xs">Winner</Label>
              <Input
                inputMode="numeric"
                value={selectedSlot.winnerPlace ?? ''}
                onChange={(e) =>
                  updateSelectedSlot({
                    winnerPlace: parsePlaceInput(e.target.value),
                  })
                }
                placeholder="auto"
              />
            </div>
            <div className="w-20">
              <Label className="text-xs">Loser</Label>
              <Input
                inputMode="numeric"
                value={selectedSlot.loserPlace ?? ''}
                onChange={(e) =>
                  updateSelectedSlot({
                    loserPlace: parsePlaceInput(e.target.value),
                  })
                }
                placeholder="auto"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">
      Click a match in the bracket to edit title, seeds, feeders, or link a game.
    </p>
  );

  return (
    <div className="space-y-3">
      <TournamentClassificationBracket
        tournament={tournament}
        games={games}
        teams={teams}
        mode="edit"
        selectMode
        selectedSlotId={selectedSlotId}
        onSelectSlot={(stageId, slot) => {
          setActiveStageId(stageId);
          setSelectedSlotId(slot.id);
          setPlacesOpen(
            slot.winnerPlace != null || slot.loserPlace != null
          );
        }}
        activeStageId={activeStage?.id}
        onActiveStageIdChange={(id) => {
          setActiveStageId(id);
          setSelectedSlotId(null);
        }}
        canvasToolbar={toolbar}
        canvasInspector={inspector}
        hideTitle
        onUpdateTournament={onUpdateTournament}
        onGamesUpdate={onGamesUpdate}
        onNavigateToGame={onNavigateToGame}
      />

      <Dialog
        open={linkOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLinkOpen(false);
            setSelectedGameId('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link game</DialogTitle>
            <DialogDescription>
              Pick a tournament game for this match.
            </DialogDescription>
          </DialogHeader>
          {availableGames.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No available games. Retag games or create them first.
            </p>
          ) : (
            <Select
              value={selectedGameId || undefined}
              onValueChange={setSelectedGameId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a game" />
              </SelectTrigger>
              <SelectContent>
                {availableGames.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {gameOptionLabel(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedGameId}
              onClick={confirmLink}
            >
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              the current matches on this stage (linked games on slots will be
              cleared from the tree).
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

function InspectorSide({
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
      onChange({ seed: seed ?? null, fromSlotId: null, fromOutcome: null });
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
