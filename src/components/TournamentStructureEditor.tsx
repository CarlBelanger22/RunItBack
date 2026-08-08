import React, { useEffect, useMemo, useState } from 'react';
import type { Team, Tournament } from '../App';
import type {
  TournamentStage,
  TournamentStageKind,
  TournamentStructure,
} from '../utils/tournamentStructure';
import {
  newStructureId,
  normalizeTournamentStructure,
  tournamentHasStructure,
} from '../utils/tournamentStructure';
import {
  buildIubit2026Structure,
  canBuildIubit2026Structure,
  applyIubitClassificationDisplayNames,
} from '../utils/iubit2026Structure';
import { buildEmptyClassificationBracket } from '../utils/fourTeamBracket';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Checkbox } from './ui/checkbox';
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
import { Layers, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

interface TournamentStructureEditorProps {
  tournament: Tournament;
  teams: Team[];
  onSaveStructure: (
    next:
      | TournamentStructure
      | undefined
      | ((
          prev: TournamentStructure | undefined
        ) => TournamentStructure | undefined)
  ) => void;
  /** LE-95.3 — auto-assign stage/group on existing tournament games. */
  onRetagGames?: () => { groupTagged: number; classificationTagged: number; skipped: number };
  /** LE-114 — lock group places, fill bracket seeds, auto-link matching KO games. */
  onFinalizeSeedings?: () => {
    seeds: number;
    slotsFilled: number;
    gamesLinked: number;
    details: string[];
  };
  /** LE-114 — unlock frozen seeds (keeps linked games). */
  onUnlockSeedings?: () => void;
  /** Optional classification bracket editor (link/auto-link) below stages. */
  classificationEditor?: React.ReactNode;
}

function sortStages(stages: TournamentStage[]): TournamentStage[] {
  return [...stages].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function withReindexedOrders(stages: TournamentStage[]): TournamentStage[] {
  return sortStages(stages).map((stage, index) => ({
    ...stage,
    order: index + 1,
  }));
}

function assignedTeamIdsInStage(stage: TournamentStage): Set<string> {
  const ids = new Set<string>();
  for (const group of stage.groups ?? []) {
    for (const id of group.teamIds) ids.add(id);
  }
  return ids;
}

export function TournamentStructureEditor({
  tournament,
  teams,
  onSaveStructure,
  onRetagGames,
  onFinalizeSeedings,
  onUnlockSeedings,
  classificationEditor,
}: TournamentStructureEditorProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [retagSummary, setRetagSummary] = useState<string | null>(null);
  const [seedSummary, setSeedSummary] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [newStageKind, setNewStageKind] =
    useState<TournamentStageKind>('round_robin');
  const [newGroupNameByStage, setNewGroupNameByStage] = useState<
    Record<string, string>
  >({});

  const structure = normalizeTournamentStructure(tournament.structure);
  const hasStructure = tournamentHasStructure(structure);
  const stages = structure?.stages ?? [];
  const groupStageLocked = structure?.groupStageLocked === true;

  // Rename legacy IUBIT "1–4" labels → Semis & Finals, etc. (by stable stage id).
  useEffect(() => {
    if (!structure || !canBuildIubit2026Structure(teams)) return;
    const renamed = applyIubitClassificationDisplayNames(structure);
    const changed = renamed.stages.some(
      (stage, i) => stage.name !== structure.stages[i]?.name
    );
    if (changed) onSaveStructure(renamed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when structure stage names/ids change
  }, [
    tournament.id,
    structure?.stages.map((s) => `${s.id}:${s.name}`).join('|'),
    teams,
  ]);

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  const canApplyGroupDraw = canBuildIubit2026Structure(teams);
  const tournamentLooksLikeIubit = /iubit/i.test(tournament.name);
  const groupDrawHint = tournamentLooksLikeIubit
    ? `Fills Groups A–D from ${tournament.name}'s known draw.`
    : 'Fills Groups A–D from the known draw when team abbreviations match.';

  const persist = (
    next:
      | TournamentStructure
      | undefined
      | ((
          prev: TournamentStructure | undefined
        ) => TournamentStructure | undefined)
  ) => {
    if (typeof next === 'function') {
      onSaveStructure((prev) => normalizeTournamentStructure(next(prev)));
      return;
    }
    onSaveStructure(normalizeTournamentStructure(next));
  };

  const updateStages = (updater: (prev: TournamentStage[]) => TournamentStage[]) => {
    persist((prevStructure) => {
      const prevStages = prevStructure?.stages ?? [];
      const nextStages = withReindexedOrders(updater(prevStages));
      return nextStages.length > 0 ? { stages: nextStages } : undefined;
    });
  };

  const enableEmpty = () => {
    persist({
      stages: [
        {
          id: newStructureId('stage'),
          name: 'Group stage',
          kind: 'round_robin',
          order: 1,
          groups: [],
        },
      ],
    });
  };

  const applyIubit = () => {
    const built = buildIubit2026Structure(teams);
    if (built) persist(built);
  };

  const addStage = () => {
    const name = newStageName.trim() || (newStageKind === 'round_robin' ? 'Group stage' : 'Classification');
    const stageId = newStructureId('stage');
    updateStages((prev) => [
      ...prev,
      {
        id: stageId,
        name,
        kind: newStageKind,
        order: prev.length + 1,
        groups: newStageKind === 'round_robin' ? [] : undefined,
        bracket:
          newStageKind === 'classification'
            ? buildEmptyClassificationBracket(stageId)
            : undefined,
      },
    ]);
    setNewStageName('');
  };

  const renameStage = (stageId: string, name: string) => {
    updateStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, name } : s))
    );
  };

  const moveStage = (stageId: string, direction: -1 | 1) => {
    const sorted = sortStages(stages);
    const index = sorted.findIndex((s) => s.id === stageId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    persist({ stages: withReindexedOrders(next) });
  };

  const deleteStage = (stageId: string) => {
    updateStages((prev) => prev.filter((s) => s.id !== stageId));
  };

  const addGroup = (stageId: string) => {
    const groupCount =
      stages.find((s) => s.id === stageId)?.groups?.length ?? 0;
    const letter =
      groupCount < 26
        ? String.fromCharCode(65 + groupCount)
        : String(groupCount + 1);
    const name =
      (newGroupNameByStage[stageId] ?? '').trim() || `Group ${letter}`;
    updateStages((prev) =>
      prev.map((s) => {
        if (s.id !== stageId) return s;
        return {
          ...s,
          groups: [
            ...(s.groups ?? []),
            { id: newStructureId('group'), name, teamIds: [] },
          ],
        };
      })
    );
    setNewGroupNameByStage((prev) => ({ ...prev, [stageId]: '' }));
  };

  const renameGroup = (stageId: string, groupId: string, name: string) => {
    updateStages((prev) =>
      prev.map((s) => {
        if (s.id !== stageId) return s;
        return {
          ...s,
          groups: (s.groups ?? []).map((g) =>
            g.id === groupId ? { ...g, name } : g
          ),
        };
      })
    );
  };

  const deleteGroup = (stageId: string, groupId: string) => {
    updateStages((prev) =>
      prev.map((s) => {
        if (s.id !== stageId) return s;
        return {
          ...s,
          groups: (s.groups ?? []).filter((g) => g.id !== groupId),
        };
      })
    );
  };

  const setTeamInGroup = (
    stageId: string,
    groupId: string,
    teamId: string,
    checked: boolean
  ) => {
    updateStages((prev) =>
      prev.map((s) => {
        if (s.id !== stageId) return s;
        const groups = (s.groups ?? []).map((g) => {
          let teamIds = g.teamIds.filter((id) => id !== teamId);
          if (checked && g.id === groupId) {
            teamIds = [...teamIds, teamId];
          }
          return { ...g, teamIds };
        });
        return { ...s, groups };
      })
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            Tournament structure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Optional stages and groups. Leave empty for a single overall
            standings table. Classification brackets appear on Standings (view)
            once slots are set up and games are linked here.
          </p>

          {!hasStructure ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={enableEmpty}>
                Enable structure
              </Button>
              {canApplyGroupDraw && (
                <Button type="button" variant="secondary" onClick={applyIubit}>
                  Apply group draw (A–D)
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canApplyGroupDraw && (
                <Button type="button" variant="secondary" onClick={applyIubit}>
                  Reset to group draw (A–D)
                </Button>
              )}
              {onRetagGames && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const report = onRetagGames();
                    setRetagSummary(
                      `Tagged ${report.groupTagged} group + ${report.classificationTagged} classification games (${report.skipped} skipped).`
                    );
                  }}
                >
                  Retag games from structure
                </Button>
              )}
              {onFinalizeSeedings && !groupStageLocked && (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setConfirmFinalize(true)}
                >
                  Finalize group seedings
                </Button>
              )}
              {onUnlockSeedings && groupStageLocked && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmUnlock(true)}
                >
                  Unlock group seedings
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                onClick={() => setConfirmClear(true)}
              >
                Clear structure
              </Button>
            </div>
          )}
          {canApplyGroupDraw && (
            <p className="text-xs text-muted-foreground">{groupDrawHint}</p>
          )}
          {groupStageLocked && (
            <p className="text-sm text-muted-foreground">
              Group seedings are locked
              {structure?.seedSnapshot
                ? ` (${Object.keys(structure.seedSnapshot).sort().join(', ')})`
                : ''}
              . Unlock to recompute from current standings.
            </p>
          )}
          {retagSummary && (
            <p className="text-sm text-muted-foreground">{retagSummary}</p>
          )}
          {seedSummary && (
            <p className="text-sm text-muted-foreground">{seedSummary}</p>
          )}
        </CardContent>
      </Card>

      {hasStructure && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add stage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="stage-name">Name</Label>
                <Input
                  id="stage-name"
                  placeholder="e.g. Group stage, Semis & Finals"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                />
              </div>
              <div className="space-y-2 w-full sm:w-48">
                <Label>Kind</Label>
                <Select
                  value={newStageKind}
                  onValueChange={(v) => setNewStageKind(v as TournamentStageKind)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Group / round robin</SelectItem>
                    <SelectItem value="classification">Classification</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={addStage}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </CardContent>
          </Card>

          {stages.map((stage, index) => {
            const assigned = assignedTeamIdsInStage(stage);
            const unassigned = teams.filter((t) => !assigned.has(t.id));
            return (
              <Card key={stage.id}>
                <CardHeader className="pb-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Input
                        value={stage.name}
                        onChange={(e) => renameStage(stage.id, e.target.value)}
                        className="max-w-sm font-medium"
                        aria-label="Stage name"
                        placeholder="Untitled stage"
                      />
                      <Badge variant="secondary">{stage.kind}</Badge>
                      <Badge variant="outline">#{stage.order}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => moveStage(stage.id, -1)}
                        aria-label="Move stage up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={index === stages.length - 1}
                        onClick={() => moveStage(stage.id, 1)}
                        aria-label="Move stage down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteStage(stage.id)}
                        aria-label="Delete stage"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stage.kind === 'round_robin' ? (
                    <>
                      {(stage.groups ?? []).length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No groups yet. Add Group A, B, … then assign teams.
                          Unequal sizes are allowed.
                        </p>
                      )}
                      <div className="grid gap-4 md:grid-cols-2">
                        {(stage.groups ?? []).map((group) => (
                          <div
                            key={group.id}
                            className="rounded-lg border p-3 space-y-3"
                          >
                            <div className="flex items-center gap-2">
                              <Input
                                value={group.name}
                                onChange={(e) =>
                                  renameGroup(stage.id, group.id, e.target.value)
                                }
                                className="font-medium"
                                aria-label="Group name"
                              />
                              <Badge variant="outline">
                                {group.teamIds.length}
                              </Badge>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-destructive shrink-0"
                                onClick={() => deleteGroup(stage.id, group.id)}
                                aria-label="Delete group"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {teams.map((team) => {
                                const checked = group.teamIds.includes(team.id);
                                const elsewhere =
                                  !checked && assigned.has(team.id);
                                return (
                                  <label
                                    key={team.id}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      disabled={elsewhere}
                                      onCheckedChange={(v) =>
                                        setTeamInGroup(
                                          stage.id,
                                          group.id,
                                          team.id,
                                          v === true
                                        )
                                      }
                                    />
                                    <span className="font-mono text-xs text-muted-foreground w-12">
                                      {team.abbreviation}
                                    </span>
                                    <span className="truncate">{team.name}</span>
                                    {elsewhere && (
                                      <span className="text-xs text-muted-foreground">
                                        (other group)
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="space-y-2 flex-1">
                          <Label>New group</Label>
                          <Input
                            placeholder="Group A"
                            value={newGroupNameByStage[stage.id] ?? ''}
                            onChange={(e) =>
                              setNewGroupNameByStage((prev) => ({
                                ...prev,
                                [stage.id]: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <Button type="button" onClick={() => addGroup(stage.id)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add group
                        </Button>
                      </div>
                      {unassigned.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Unassigned ({unassigned.length}):{' '}
                          {unassigned.map((t) => t.abbreviation).join(', ')}
                        </p>
                      )}
                    </>
                  ) : stage.kind === 'classification' ? (
                    <p className="text-sm text-muted-foreground">
                      Edit this stage’s bracket in the visual editor below —
                      click a match to set seeds, feeders, and link games.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Custom stage — use Classification for brackets.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {classificationEditor}
        </>
      )}

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear tournament structure?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes all stages and groups. Existing games keep any stage tags
              until you clear them separately. Standings return to one overall
              table.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                persist(undefined);
                setConfirmClear(false);
              }}
            >
              Clear structure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmFinalize} onOpenChange={setConfirmFinalize}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize group seedings?</AlertDialogTitle>
            <AlertDialogDescription>
              Freezes current group places (A1, B2, …), fills classification
              bracket slots with those teams, and links existing games that
              match. Seeds stay frozen until you unlock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!onFinalizeSeedings) return;
                const report = onFinalizeSeedings();
                setSeedSummary(
                  `Finalized ${report.seeds} seeds · filled ${report.slotsFilled} slots · linked ${report.gamesLinked} games.`
                );
                setConfirmFinalize(false);
              }}
            >
              Finalize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUnlock} onOpenChange={setConfirmUnlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock group seedings?</AlertDialogTitle>
            <AlertDialogDescription>
              Clears the frozen seed snapshot and unfilled seed team names on
              bracket slots. Linked games stay linked. You can finalize again
              after standings change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onUnlockSeedings?.();
                setSeedSummary('Group seedings unlocked.');
                setConfirmUnlock(false);
              }}
            >
              Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
