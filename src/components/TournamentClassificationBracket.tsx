/**
 * LE-95.5 / LE-96 / LE-98 — Classification bracket: World Cup–style tree (view + edit).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Game, Team, Tournament } from '../App';
import type { TournamentUpdate } from '../App';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { autoLinkIubitBracketGames } from '../utils/autoLinkIubitBracket';
import {
  gamesAvailableForBracketSlot,
  linkGameToBracketSlot,
  unlinkGameFromBracketSlot,
} from '../utils/bracketGameLink';
import {
  classificationStagesWithBrackets,
} from '../utils/iubit2026Bracket';
import {
  classificationStagesNeedBracketSlots,
  ensureClassificationBrackets,
} from '../utils/fourTeamBracket';
import {
  normalizeTournamentStructure,
  tournamentHasStructure,
  type BracketRound,
  type BracketSlot,
  type TournamentStage,
} from '../utils/tournamentStructure';
import { TeamBadge } from './TeamBadge';
import { MoreHorizontal } from 'lucide-react';

export type ClassificationBracketMode = 'view' | 'edit';

interface TournamentClassificationBracketProps {
  tournament: Tournament;
  games: Game[];
  mode: ClassificationBracketMode;
  onUpdateTournament: (update: TournamentUpdate) => void;
  onGamesUpdate: (games: Game[]) => void;
  onNavigateToGame: (gameId: string) => void;
}

function resolveScore(game: Game): { home: number; away: number } | null {
  if (game.finalScore) return game.finalScore;
  const home = game.teamStats?.home?.total_points;
  const away = game.teamStats?.away?.total_points;
  if (typeof home === 'number' && typeof away === 'number') {
    return { home, away };
  }
  return null;
}

function gameOptionLabel(game: Game): string {
  const home = game.homeTeam?.abbreviation || game.homeTeam?.name || 'Home';
  const away = game.awayTeam?.abbreviation || game.awayTeam?.name || 'Away';
  const score = resolveScore(game);
  const scoreText = score ? `${score.home}–${score.away}` : game.isCompleted ? 'Final' : 'In progress';
  return `${home} vs ${away} · ${game.date} · ${scoreText}`;
}

function parseSeedSides(label: string | undefined): [string, string] | null {
  if (!label) return null;
  const m = label.match(/^(.+?)\s+vs\s+(.+)$/i);
  if (!m) return null;
  return [m[1].trim(), m[2].trim()];
}

function findSlotLabel(rounds: BracketRound[], slotId: string): string | null {
  for (const round of rounds) {
    const hit = round.slots.find((s) => s.id === slotId);
    if (hit) return hit.label ?? hit.id;
  }
  return null;
}

function isLoserPlacementLabel(label: string | undefined): boolean {
  const t = (label ?? '').toLowerCase();
  return t.includes('3rd') || t.includes('7th') || t.includes('11th');
}

function placeholderSides(
  slot: BracketSlot,
  rounds: BracketRound[]
): [string, string] {
  const seeds = parseSeedSides(slot.label);
  if (seeds) return seeds;
  const losers = isLoserPlacementLabel(slot.label);
  const prefix = losers ? 'Loser' : 'Winner';
  const a = slot.homeFromSlotId
    ? findSlotLabel(rounds, slot.homeFromSlotId)
    : null;
  const b = slot.awayFromSlotId
    ? findSlotLabel(rounds, slot.awayFromSlotId)
    : null;
  return [
    a ? `${prefix} · ${a}` : 'TBD',
    b ? `${prefix} · ${b}` : 'TBD',
  ];
}

function splitFinalsSlots(slots: BracketSlot[]): {
  championship?: BracketSlot;
  consolation?: BracketSlot;
} {
  if (slots.length === 0) return {};
  if (slots.length === 1) return { championship: slots[0] };
  return { championship: slots[0], consolation: slots[1] };
}

function preferredStageId(stages: TournamentStage[]): string {
  const semis = stages.find(
    (s) =>
      s.id === 'iubit-stage-1-4' ||
      /semis/i.test(s.name) ||
      /final/i.test(s.name)
  );
  return (semis ?? stages[0]).id;
}

type SideRow = {
  key: string;
  name: string;
  team?: Team;
  teamId?: string;
  scoreText: string;
  isWinner: boolean;
  isLoser: boolean;
};

function buildSideRows(
  slot: BracketSlot,
  game: Game | undefined,
  rounds: BracketRound[]
): SideRow[] {
  if (game) {
    const score = resolveScore(game);
    const homeScore = score?.home;
    const awayScore = score?.away;
    const decided =
      typeof homeScore === 'number' &&
      typeof awayScore === 'number' &&
      homeScore !== awayScore;
    const homeWins = decided && homeScore! > awayScore!;
    const awayWins = decided && awayScore! > homeScore!;
    return [
      {
        key: 'home',
        name: game.homeTeam?.name || game.homeTeam?.abbreviation || 'Home',
        team: game.homeTeam,
        teamId: game.homeTeamId,
        scoreText:
          typeof homeScore === 'number' ? String(homeScore) : '—',
        isWinner: homeWins,
        isLoser: awayWins,
      },
      {
        key: 'away',
        name: game.awayTeam?.name || game.awayTeam?.abbreviation || 'Away',
        team: game.awayTeam,
        teamId: game.awayTeamId,
        scoreText:
          typeof awayScore === 'number' ? String(awayScore) : '—',
        isWinner: awayWins,
        isLoser: homeWins,
      },
    ];
  }

  const [homeLabel, awayLabel] = placeholderSides(slot, rounds);
  return [
    {
      key: 'home',
      name: homeLabel,
      scoreText: '—',
      isWinner: false,
      isLoser: false,
    },
    {
      key: 'away',
      name: awayLabel,
      scoreText: '—',
      isWinner: false,
      isLoser: false,
    },
  ];
}

function MatchBox({
  slot,
  game,
  rounds,
  mode,
  showPill,
  pillLabelOverride,
  boxRef,
  onOpenGame,
  onLink,
  onUnlink,
}: {
  slot: BracketSlot;
  game: Game | undefined;
  rounds: BracketRound[];
  mode: ClassificationBracketMode;
  showPill?: boolean;
  pillLabelOverride?: string;
  boxRef?: React.Ref<HTMLDivElement>;
  onOpenGame: (gameId: string) => void;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const rows = buildSideRows(slot, game, rounds);
  const pill = showPill ? (pillLabelOverride ?? slot.label) : undefined;

  const body = (
    <div className="classification-match-box">
      {rows.map((row) => (
        <div
          key={row.key}
          className={
            row.isLoser
              ? 'classification-match-row classification-match-row--loser'
              : row.isWinner
                ? 'classification-match-row classification-match-row--winner'
                : 'classification-match-row'
          }
        >
          <div className="classification-match-team">
            {row.team ? (
              <TeamBadge team={row.team} teamId={row.teamId} size="sm" />
            ) : (
              <span className="classification-match-badge-placeholder" />
            )}
            <span className="classification-match-name" title={row.name}>
              {row.name}
            </span>
          </div>
          <span className="classification-match-score">{row.scoreText}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="classification-match-wrap" ref={boxRef}>
      <div className="classification-match-shell">
        {mode === 'edit' && !game ? (
          <button
            type="button"
            className="classification-match-hit"
            onClick={onLink}
            aria-label={`Link game for ${slot.label ?? slot.id}`}
          >
            {body}
          </button>
        ) : game ? (
          <button
            type="button"
            className="classification-match-hit"
            onClick={() => onOpenGame(game.id)}
            aria-label={`Open ${slot.label ?? 'game'}`}
          >
            {body}
          </button>
        ) : (
          body
        )}

        {mode === 'edit' && game && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="classification-match-menu"
                aria-label="Match actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  onOpenGame(game.id);
                }}
              >
                Open game
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLink}>Change link</DropdownMenuItem>
              <DropdownMenuItem onClick={onUnlink}>Unlink</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {pill && (
        <span
          className={
            isLoserPlacementLabel(pill)
              ? 'classification-match-pill classification-match-pill--muted'
              : 'classification-match-pill'
          }
        >
          {pill}
        </span>
      )}
    </div>
  );
}

/** Connector lines measured from actual Semis match centers (tracks gap changes). */
function BracketJoin({
  stackRef,
  boxRefs,
  onHeightChange,
}: {
  stackRef: React.RefObject<HTMLDivElement | null>;
  boxRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  onHeightChange?: (height: number) => void;
}) {
  const [geometry, setGeometry] = useState<{
    height: number;
    y1: number;
    y2: number;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const stack = stackRef.current;
      const a = boxRefs.current[0];
      const b = boxRefs.current[1];
      if (!stack || !a || !b) return;

      const stackRect = stack.getBoundingClientRect();
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();

      const y1 = aRect.top + aRect.height / 2 - stackRect.top;
      const y2 = bRect.top + bRect.height / 2 - stackRect.top;
      const height = Math.max(stackRect.height, 1);
      setGeometry({ height, y1, y2 });
      onHeightChange?.(height);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (stackRef.current) ro.observe(stackRef.current);
    boxRefs.current.forEach((el) => {
      if (el) ro.observe(el);
    });
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [stackRef, boxRefs, onHeightChange]);

  const mid = geometry ? (geometry.y1 + geometry.y2) / 2 : 0;

  return (
    <div
      className="classification-bracket-join"
      aria-hidden="true"
      style={geometry ? { height: `${geometry.height}px` } : undefined}
    >
      {geometry && (
        <svg
          className="classification-bracket-join-svg"
          width="48"
          height={geometry.height}
          viewBox={`0 0 48 ${geometry.height}`}
          preserveAspectRatio="none"
        >
          <path
            d={`M0 ${geometry.y1} H24 V${mid} H48`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d={`M0 ${geometry.y2} H24 V${mid}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      )}
    </div>
  );
}

function BracketTree({
  stage,
  gameById,
  mode,
  onOpenGame,
  onLink,
  onUnlink,
}: {
  stage: TournamentStage;
  gameById: Map<string, Game>;
  mode: ClassificationBracketMode;
  onOpenGame: (gameId: string) => void;
  onLink: (stageId: string, slot: BracketSlot) => void;
  onUnlink: (slotId: string) => void;
}) {
  const rounds = stage.bracket?.rounds ?? [];
  const stackRef = useRef<HTMLDivElement | null>(null);
  const boxRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [semisHeight, setSemisHeight] = useState<number | null>(null);

  if (rounds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No bracket slots yet.</p>
    );
  }

  // Single round (e.g. 13–14): one column.
  if (rounds.length === 1) {
    const isThirteenthPlaceStage = stage.id === 'iubit-stage-13-14';
    return (
      <div className="classification-bracket-scroll">
        <div className="classification-bracket-tree classification-bracket-tree--single">
          {rounds[0].slots.map((slot) => (
            <MatchBox
              key={slot.id}
              slot={slot}
              game={slot.gameId ? gameById.get(slot.gameId) : undefined}
              rounds={rounds}
              mode={mode}
              showPill
              pillLabelOverride={isThirteenthPlaceStage ? '13th Place' : undefined}
              onOpenGame={onOpenGame}
              onLink={() => onLink(stage.id, slot)}
              onUnlink={() => onUnlink(slot.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  const leftRound = rounds[0];
  const rightRound = rounds[rounds.length - 1];
  const { championship, consolation } = splitFinalsSlots(rightRound.slots);
  const showJoin = leftRound.slots.length === 2;

  return (
    <div className="classification-bracket-scroll">
      <div className="classification-bracket-tree">
        <div className="classification-bracket-round">
          <p className="classification-bracket-round-label">{leftRound.name}</p>
          <div className="classification-bracket-semis-row">
            <div className="classification-bracket-round-stack" ref={stackRef}>
              {leftRound.slots.map((slot, index) => (
                <MatchBox
                  key={slot.id}
                  slot={slot}
                  game={slot.gameId ? gameById.get(slot.gameId) : undefined}
                  rounds={rounds}
                  mode={mode}
                  boxRef={(el) => {
                    boxRefs.current[index] = el;
                  }}
                  onOpenGame={onOpenGame}
                  onLink={() => onLink(stage.id, slot)}
                  onUnlink={() => onUnlink(slot.id)}
                />
              ))}
            </div>
            {showJoin && (
              <BracketJoin
                stackRef={stackRef}
                boxRefs={boxRefs}
                onHeightChange={setSemisHeight}
              />
            )}
          </div>
        </div>

        <div className="classification-bracket-round classification-bracket-round--finals">
          <p className="classification-bracket-round-label">{rightRound.name}</p>
          <div
            className="classification-bracket-finals-anchor"
            style={semisHeight ? { height: `${semisHeight}px` } : undefined}
          >
            {championship && (
              <div className="classification-bracket-finals-main">
                <MatchBox
                  slot={championship}
                  game={
                    championship.gameId
                      ? gameById.get(championship.gameId)
                      : undefined
                  }
                  rounds={rounds}
                  mode={mode}
                  showPill
                  onOpenGame={onOpenGame}
                  onLink={() => onLink(stage.id, championship)}
                  onUnlink={() => onUnlink(championship.id)}
                />
              </div>
            )}
          </div>
          {consolation && (
            <div className="classification-bracket-finals-third">
              <MatchBox
                slot={consolation}
                game={
                  consolation.gameId
                    ? gameById.get(consolation.gameId)
                    : undefined
                }
                rounds={rounds}
                mode={mode}
                showPill
                onOpenGame={onOpenGame}
                onLink={() => onLink(stage.id, consolation)}
                onUnlink={() => onUnlink(consolation.id)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TournamentClassificationBracket({
  tournament,
  games,
  mode,
  onUpdateTournament,
  onGamesUpdate,
  onNavigateToGame,
}: TournamentClassificationBracketProps) {
  const structure = normalizeTournamentStructure(tournament.structure);
  const [linkTarget, setLinkTarget] = useState<{
    stageId: string;
    slotId: string;
  } | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [autoLinkSummary, setAutoLinkSummary] = useState<string | null>(null);
  const [activeStageId, setActiveStageId] = useState<string>('');

  const needsSlots = classificationStagesNeedBracketSlots(structure);
  const stages = useMemo(
    () => (structure ? classificationStagesWithBrackets(structure) : []),
    [structure]
  );
  const hasStructure = tournamentHasStructure(structure);
  const hasClassification =
    structure?.stages.some((s) => s.kind === 'classification') ?? false;

  useEffect(() => {
    if (stages.length === 0) {
      setActiveStageId('');
      return;
    }
    setActiveStageId((prev) =>
      prev && stages.some((s) => s.id === prev)
        ? prev
        : preferredStageId(stages)
    );
  }, [stages]);

  const activeStage = stages.find((s) => s.id === activeStageId) ?? stages[0];

  const gameById = useMemo(() => {
    const map = new Map<string, Game>();
    for (const g of games) map.set(g.id, g);
    return map;
  }, [games]);

  const availableGames = useMemo(() => {
    if (!linkTarget || !structure) return [];
    return gamesAvailableForBracketSlot(
      games,
      structure,
      linkTarget.stageId,
      linkTarget.slotId
    );
  }, [games, structure, linkTarget]);

  useEffect(() => {
    if (mode !== 'edit' || !structure || !needsSlots) return;
    const next = ensureClassificationBrackets(structure);
    if (JSON.stringify(next) !== JSON.stringify(structure)) {
      onUpdateTournament({
        id: tournament.id,
        patch: (prev) => ({ ...prev, structure: next }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, needsSlots, tournament.id]);

  if (!hasStructure || !hasClassification) return null;
  if (mode === 'view' && stages.length === 0) return null;

  const runAutoLink = () => {
    const result = autoLinkIubitBracketGames(structure, games, tournament.id);
    const structureChanged =
      JSON.stringify(result.structure) !==
      JSON.stringify(structure ?? { stages: [] });
    if (structureChanged) {
      onUpdateTournament({
        id: tournament.id,
        patch: (prev) => ({ ...prev, structure: result.structure }),
      });
    }
    if (result.report.linked > 0) {
      onGamesUpdate(result.games);
    }
    setAutoLinkSummary(
      result.report.linked > 0
        ? `Auto-linked ${result.report.linked} game${result.report.linked === 1 ? '' : 's'} to bracket slots${
            result.report.skipped ? ` (${result.report.skipped} skipped)` : ''
          }.`
        : `No new links (${result.report.skipped} skipped). Check group standings / scores if slots are empty.`
    );
  };

  const confirmLink = () => {
    if (!structure || !linkTarget || !selectedGameId) return;
    const result = linkGameToBracketSlot(
      structure,
      games,
      linkTarget.slotId,
      selectedGameId
    );
    onUpdateTournament({
      id: tournament.id,
      patch: (prev) => ({ ...prev, structure: result.structure }),
    });
    onGamesUpdate(result.games);
    setLinkTarget(null);
    setSelectedGameId('');
  };

  const unlink = (slotId: string) => {
    if (!structure) return;
    const result = unlinkGameFromBracketSlot(structure, games, slotId);
    onUpdateTournament({
      id: tournament.id,
      patch: (prev) => ({ ...prev, structure: result.structure }),
    });
    onGamesUpdate(result.games);
  };

  const openLink = (stageId: string, slot: BracketSlot) => {
    setLinkTarget({ stageId, slotId: slot.id });
    setSelectedGameId(slot.gameId ?? '');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-medium">Brackets</h3>
        {mode === 'edit' && (
          <Button type="button" variant="secondary" onClick={runAutoLink}>
            Auto-link games
          </Button>
        )}
      </div>

      {mode === 'edit' && autoLinkSummary && (
        <p className="text-sm text-muted-foreground">{autoLinkSummary}</p>
      )}

      {mode === 'edit' && needsSlots && stages.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Setting up classification brackets…
            </p>
          </CardContent>
        </Card>
      )}

      {stages.length > 0 && (
        <div className="classification-stage-pills">
          {stages.map((stage) => (
            <Button
              key={stage.id}
              type="button"
              size="sm"
              variant={stage.id === activeStage?.id ? 'default' : 'outline'}
              onClick={() => setActiveStageId(stage.id)}
            >
              {stage.name}
            </Button>
          ))}
        </div>
      )}

      {activeStage && (
        <Card className="classification-bracket-card">
          <CardContent className="pt-6">
            <BracketTree
              stage={activeStage}
              gameById={gameById}
              mode={mode}
              onOpenGame={onNavigateToGame}
              onLink={openLink}
              onUnlink={unlink}
            />
          </CardContent>
        </Card>
      )}

      {mode === 'edit' && (
        <Dialog
          open={linkTarget != null}
          onOpenChange={(open) => {
            if (!open) {
              setLinkTarget(null);
              setSelectedGameId('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link game to slot</DialogTitle>
              <DialogDescription>
                Pick a tournament game for this bracket slot. Prefer games already
                tagged to this classification stage.
              </DialogDescription>
            </DialogHeader>
            {availableGames.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No available games. Retag classification games above, or create
                games first.
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
                onClick={() => {
                  setLinkTarget(null);
                  setSelectedGameId('');
                }}
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
      )}
    </div>
  );
}
