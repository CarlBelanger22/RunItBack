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
import {
  formatFinishPlace,
  placeForMatchSide,
} from '../utils/bracketPlaces';
import {
  isSlotInactive,
} from '../utils/bracketLegs';
import {
  autoLinkBracketByResolvedTeams,
  resolveBracketSideTeamId,
} from '../utils/resolveBracketFeeders';
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
  /** Used to resolve seeded slot team ids before a game is linked (LE-114). */
  teams?: Team[];
  /** LE-113 — click matches to select (structure canvas). */
  selectMode?: boolean;
  selectedSlotId?: string | null;
  onSelectSlot?: (stageId: string, slot: BracketSlot) => void;
  activeStageId?: string;
  onActiveStageIdChange?: (stageId: string) => void;
  /** Extra toolbar beside Auto-link (structure canvas). */
  canvasToolbar?: React.ReactNode;
  /** Inspector under the tree (structure canvas). */
  canvasInspector?: React.ReactNode;
  hideTitle?: boolean;
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

/** Terminal place matches (Final, 3rd Place, 5th/7th, …) — not QF/SF feeders. */
function isEndingPlaceSlot(slot: BracketSlot): boolean {
  return slot.winnerPlace != null || slot.loserPlace != null;
}

function feederLabel(
  rounds: BracketRound[],
  fromSlotId: string | null | undefined,
  outcome: 'winner' | 'loser' | null | undefined
): string | null {
  if (!fromSlotId) return null;
  const label = findSlotLabel(rounds, fromSlotId);
  if (!label) return null;
  const prefix = outcome === 'loser' ? 'Loser' : 'Winner';
  return `${prefix} · ${label}`;
}

function placeholderSides(
  slot: BracketSlot,
  rounds: BracketRound[]
): [string, string] {
  const homeSeed = slot.homeSeedLabel?.trim();
  const awaySeed = slot.awaySeedLabel?.trim();
  const homeFeeder = feederLabel(rounds, slot.homeFromSlotId, slot.homeFromOutcome);
  const awayFeeder = feederLabel(rounds, slot.awayFromSlotId, slot.awayFromOutcome);

  if (homeSeed || awaySeed || homeFeeder || awayFeeder) {
    return [
      homeSeed || homeFeeder || 'TBD',
      awaySeed || awayFeeder || 'TBD',
    ];
  }

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

function teamDisplayName(team: Team | undefined, fallback: string): string {
  return team?.name || team?.abbreviation || fallback;
}

function buildSideRows(
  slot: BracketSlot,
  game: Game | undefined,
  rounds: BracketRound[],
  teamById?: Map<string, Team>,
  gameById?: Map<string, Game>
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
  const gamesMap = gameById ?? new Map<string, Game>();

  // LE-115 — resolve Winner/Loser feeders; LE-114 — seed team ids
  const homeTeamId =
    resolveBracketSideTeamId(slot, 'home', rounds, gamesMap) ??
    slot.homeTeamId ??
    null;
  const awayTeamId =
    resolveBracketSideTeamId(slot, 'away', rounds, gamesMap) ??
    slot.awayTeamId ??
    null;
  const homeTeam = (homeTeamId && teamById?.get(homeTeamId)) || undefined;
  const awayTeam = (awayTeamId && teamById?.get(awayTeamId)) || undefined;

  if (homeTeam || awayTeam || homeTeamId || awayTeamId) {
    return [
      {
        key: 'home',
        name: homeTeam
          ? teamDisplayName(homeTeam, homeLabel)
          : homeLabel,
        team: homeTeam,
        teamId: homeTeamId ?? undefined,
        scoreText: '—',
        isWinner: false,
        isLoser: false,
      },
      {
        key: 'away',
        name: awayTeam
          ? teamDisplayName(awayTeam, awayLabel)
          : awayLabel,
        team: awayTeam,
        teamId: awayTeamId ?? undefined,
        scoreText: '—',
        isWinner: false,
        isLoser: false,
      },
    ];
  }

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
  teamById,
  gameById,
  mode,
  showPill,
  pillLabelOverride,
  boxRef,
  selected,
  selectMode,
  onSelect,
  onOpenGame,
  onLink,
  onUnlink,
}: {
  slot: BracketSlot;
  game: Game | undefined;
  rounds: BracketRound[];
  teamById?: Map<string, Team>;
  gameById?: Map<string, Game>;
  mode: ClassificationBracketMode;
  showPill?: boolean;
  pillLabelOverride?: string;
  boxRef?: React.Ref<HTMLDivElement>;
  selected?: boolean;
  selectMode?: boolean;
  onSelect?: () => void;
  onOpenGame: (gameId: string) => void;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const rows = buildSideRows(slot, game, rounds, teamById, gameById);
  const showEndingPill = showPill ?? isEndingPlaceSlot(slot);
  const pill = showEndingPill
    ? (pillLabelOverride ?? slot.label)
    : undefined;
  const placeHints = [pillLabelOverride, pill, slot.label];
  const hasOutsidePlaces = rows.some(
    (row) =>
      placeForMatchSide(slot, row.isWinner, row.isLoser, placeHints, rounds) !=
      null
  );

  const body = (
    <div
      className={
        selected
          ? 'classification-match-box classification-match-box--selected'
          : 'classification-match-box'
      }
    >
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

  const placesColumn = hasOutsidePlaces ? (
    <div className="classification-match-places" aria-hidden={false}>
      {rows.map((row) => {
        const place = placeForMatchSide(
          slot,
          row.isWinner,
          row.isLoser,
          placeHints,
          rounds
        );
        return (
          <div key={`place-${row.key}`} className="classification-match-place-slot">
            {place != null ? (
              <span
                className={
                  place <= 3
                    ? `classification-place-medal classification-place-medal--${place}`
                    : 'classification-place-medal'
                }
                title={`${formatFinishPlace(place)} place`}
              >
                {formatFinishPlace(place)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  ) : null;

  const hit = (() => {
    if (selectMode && onSelect) {
      return (
        <button
          type="button"
          className="classification-match-hit"
          onClick={onSelect}
          aria-label={`Edit ${slot.label ?? 'match'}`}
          aria-pressed={selected}
        >
          {body}
        </button>
      );
    }
    if (mode === 'edit' && !game) {
      return (
        <button
          type="button"
          className="classification-match-hit"
          onClick={onLink}
          aria-label={`Link game for ${slot.label ?? slot.id}`}
        >
          {body}
        </button>
      );
    }
    if (game) {
      return (
        <button
          type="button"
          className="classification-match-hit"
          onClick={() => onOpenGame(game.id)}
          aria-label={`Open ${slot.label ?? 'game'}`}
        >
          {body}
        </button>
      );
    }
    return body;
  })();

  return (
    <div className="classification-match-wrap" ref={boxRef}>
      <div className="classification-match-main">
        <div className="classification-match-shell">
          {hit}

          {mode === 'edit' && !selectMode && game && (
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
        {placesColumn}
      </div>
      {pill && (
        <div className="classification-match-pill-row">
          <span
            className={
              isLoserPlacementLabel(pill)
                ? 'classification-match-pill classification-match-pill--muted'
                : 'classification-match-pill'
            }
          >
            {pill}
          </span>
        </div>
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
  onHeightChange?: (height: number, mid: number) => void;
}) {
  const [geometry, setGeometry] = useState<{
    height: number;
    y1: number;
    y2: number;
  } | null>(null);
  const onHeightChangeRef = useRef(onHeightChange);
  onHeightChangeRef.current = onHeightChange;
  const lastNotifiedRef = useRef<{ height: number; mid: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const stack = stackRef.current;
      const a = boxRefs.current[0];
      const b = boxRefs.current[1];
      if (!stack || !a || !b) return;

      const stackRect = stack.getBoundingClientRect();
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();

      // Round to avoid sub-pixel ResizeObserver feedback loops
      const y1 = Math.round(aRect.top + aRect.height / 2 - stackRect.top);
      const y2 = Math.round(bRect.top + bRect.height / 2 - stackRect.top);
      const height = Math.max(Math.round(stackRect.height), 1);
      const midY = Math.round((y1 + y2) / 2);

      setGeometry((prev) => {
        if (
          prev &&
          prev.height === height &&
          prev.y1 === y1 &&
          prev.y2 === y2
        ) {
          return prev;
        }
        return { height, y1, y2 };
      });
      const prevNotify = lastNotifiedRef.current;
      if (
        !prevNotify ||
        prevNotify.height !== height ||
        prevNotify.mid !== midY
      ) {
        lastNotifiedRef.current = { height, mid: midY };
        onHeightChangeRef.current?.(height, midY);
      }
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
    // Intentionally omit onHeightChange — kept in a ref to avoid effect churn
  }, [stackRef, boxRefs]);

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

/** LE-126 — One feeder → stepped elbow into QF/SF home or away row. */
function matchBoxCenterEl(wrap: HTMLElement): HTMLElement {
  return (
    (wrap.querySelector('.classification-match-main') as HTMLElement | null) ??
    wrap
  );
}

/** Single feeder → next match: stepped path, box-center to box-center. */
function SingleSideJoin({
  sourceRef,
  targetRef,
}: {
  sourceRef: React.RefObject<HTMLElement | null>;
  targetRef: React.RefObject<HTMLElement | null>;
}) {
  const joinRef = useRef<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = useState<{
    height: number;
    ySrc: number;
    yTgt: number;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const join = joinRef.current;
      const source = sourceRef.current;
      const target = targetRef.current;
      if (!join || !source || !target) return;

      const srcEl = matchBoxCenterEl(source);
      const tgtEl = matchBoxCenterEl(target);

      const joinRect = join.getBoundingClientRect();
      const srcRect = srcEl.getBoundingClientRect();
      const tgtRect = tgtEl.getBoundingClientRect();

      const ySrc = Math.round(srcRect.top + srcRect.height / 2 - joinRect.top);
      const yTgt = Math.round(tgtRect.top + tgtRect.height / 2 - joinRect.top);
      const height = Math.max(Math.round(joinRect.height), 1);

      setGeometry((prev) => {
        if (
          prev &&
          prev.height === height &&
          prev.ySrc === ySrc &&
          prev.yTgt === yTgt
        ) {
          return prev;
        }
        return { height, ySrc, yTgt };
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (joinRef.current) ro.observe(joinRef.current);
    if (sourceRef.current) ro.observe(sourceRef.current);
    if (targetRef.current) ro.observe(targetRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sourceRef, targetRef]);

  return (
    <div
      ref={joinRef}
      className="classification-bracket-join classification-bracket-join--single"
      aria-hidden="true"
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
            d={`M0 ${geometry.ySrc} H24 V${geometry.yTgt} H48`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      )}
    </div>
  );
}

function activeFirstRoundCount(a: BracketSlot, b: BracketSlot): number {
  return [a, b].filter((s) => !isSlotInactive(s)).length;
}

/**
 * LE-126b — Bye / 12-Team layout: L16 sit between the two QFs (not parallel
 * side-by-side); stepped links are box-center → box-center.
 */
function ByeInterleavedBand({
  a0,
  b0,
  next0,
  a1,
  b1,
  next1,
  nextBoxRef0,
  nextBoxRef1,
  matchProps,
}: {
  a0?: BracketSlot | null;
  b0?: BracketSlot | null;
  next0: BracketSlot;
  a1?: BracketSlot | null;
  b1?: BracketSlot | null;
  next1: BracketSlot;
  nextBoxRef0?: (el: HTMLDivElement | null) => void;
  nextBoxRef1?: (el: HTMLDivElement | null) => void;
  matchProps: (slot: BracketSlot) => React.ComponentProps<typeof MatchBox>;
}) {
  const joinRef = useRef<HTMLDivElement | null>(null);
  const qf0Ref = useRef<HTMLDivElement | null>(null);
  const qf1Ref = useRef<HTMLDivElement | null>(null);
  const feederRefs = useRef<Array<HTMLDivElement | null>>([]);

  const feeders = [
    ...[a0, b0]
      .filter((s): s is BracketSlot => !!s && !isSlotInactive(s))
      .map((slot) => ({
        slot,
        targetRef: qf0Ref,
      })),
    ...[a1, b1]
      .filter((s): s is BracketSlot => !!s && !isSlotInactive(s))
      .map((slot) => ({
        slot,
        targetRef: qf1Ref,
      })),
  ];

  const [geometry, setGeometry] = useState<{
    height: number;
    paths: Array<{ ySrc: number; yTgt: number }>;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const join = joinRef.current;
      if (!join) return;
      const joinRect = join.getBoundingClientRect();
      const height = Math.max(Math.round(joinRect.height), 1);
      const paths = feeders.map((f, i) => {
        const source = feederRefs.current[i];
        const target = f.targetRef.current;
        if (!source || !target) return { ySrc: 0, yTgt: 0 };
        const srcEl = matchBoxCenterEl(source);
        const tgtEl = matchBoxCenterEl(target);
        const srcRect = srcEl.getBoundingClientRect();
        const tgtRect = tgtEl.getBoundingClientRect();
        return {
          ySrc: Math.round(srcRect.top + srcRect.height / 2 - joinRect.top),
          yTgt: Math.round(tgtRect.top + tgtRect.height / 2 - joinRect.top),
        };
      });
      setGeometry((prev) => {
        if (
          prev &&
          prev.height === height &&
          prev.paths.length === paths.length &&
          prev.paths.every(
            (p, i) => p.ySrc === paths[i].ySrc && p.yTgt === paths[i].yTgt
          )
        ) {
          return prev;
        }
        return { height, paths };
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (joinRef.current) ro.observe(joinRef.current);
    feederRefs.current.forEach((el) => {
      if (el) ro.observe(el);
    });
    if (qf0Ref.current) ro.observe(qf0Ref.current);
    if (qf1Ref.current) ro.observe(qf1Ref.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [feeders.map((f) => f.slot.id).join('|'), next0.id, next1.id]);

  return (
    <div className="classification-bracket-bye-band">
      <div className="classification-bracket-bye-feeders">
        {feeders.map((f, i) => (
          <MatchBox
            key={f.slot.id}
            {...matchProps(f.slot)}
            boxRef={(el) => {
              feederRefs.current[i] = el;
            }}
          />
        ))}
      </div>
      <div
        ref={joinRef}
        className="classification-bracket-join classification-bracket-join--bye-band"
        aria-hidden="true"
      >
        {geometry && (
          <svg
            className="classification-bracket-join-svg"
            width="48"
            height={geometry.height}
            viewBox={`0 0 48 ${geometry.height}`}
            preserveAspectRatio="none"
          >
            {geometry.paths.map((p, i) => (
              <path
                key={feeders[i]?.slot.id ?? i}
                d={`M0 ${p.ySrc} H24 V${p.yTgt} H48`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            ))}
          </svg>
        )}
      </div>
      <div className="classification-bracket-bye-targets">
        <MatchBox
          {...matchProps(next0)}
          boxRef={(el) => {
            qf0Ref.current = el;
            nextBoxRef0?.(el);
          }}
        />
        <MatchBox
          {...matchProps(next1)}
          boxRef={(el) => {
            qf1Ref.current = el;
            nextBoxRef1?.(el);
          }}
        />
      </div>
    </div>
  );
}

function FirstRoundPairOrByeBand({
  stackRef0,
  boxRefs0,
  stackRef1,
  boxRefs1,
  a0,
  b0,
  next0,
  a1,
  b1,
  next1,
  nextBoxRef0,
  nextBoxRef1,
  matchProps,
}: {
  stackRef0: React.MutableRefObject<HTMLDivElement | null>;
  boxRefs0: React.MutableRefObject<Array<HTMLDivElement | null>>;
  stackRef1: React.MutableRefObject<HTMLDivElement | null>;
  boxRefs1: React.MutableRefObject<Array<HTMLDivElement | null>>;
  a0: BracketSlot;
  b0: BracketSlot;
  next0: BracketSlot;
  a1: BracketSlot;
  b1: BracketSlot;
  next1: BracketSlot;
  nextBoxRef0?: (el: HTMLDivElement | null) => void;
  nextBoxRef1?: (el: HTMLDivElement | null) => void;
  matchProps: (slot: BracketSlot) => React.ComponentProps<typeof MatchBox>;
}) {
  const n0 = activeFirstRoundCount(a0, b0);
  const n1 = activeFirstRoundCount(a1, b1);
  // IVP-style: each QF has at most one L16 feeder → interleave L16 between QFs
  if (n0 <= 1 && n1 <= 1 && n0 + n1 > 0) {
    return (
      <ByeInterleavedBand
        a0={a0}
        b0={b0}
        next0={next0}
        a1={a1}
        b1={b1}
        next1={next1}
        nextBoxRef0={nextBoxRef0}
        nextBoxRef1={nextBoxRef1}
        matchProps={matchProps}
      />
    );
  }
  return (
    <>
      <div className="classification-bracket-semis-row classification-bracket-semis-row--eight">
        <FirstRoundPairColumn
          stackRef={stackRef0}
          boxRefs={boxRefs0}
          a={a0}
          b={b0}
          next={next0}
          nextBoxRef={nextBoxRef0}
          matchProps={matchProps}
        />
      </div>
      <div className="classification-bracket-semis-row classification-bracket-semis-row--eight">
        <FirstRoundPairColumn
          stackRef={stackRef1}
          boxRefs={boxRefs1}
          a={a1}
          b={b1}
          next={next1}
          nextBoxRef={nextBoxRef1}
          matchProps={matchProps}
        />
      </div>
    </>
  );
}

/**
 * LE-125b / LE-126 — First-round pair → next match.
 * Dual legs: fork join. Single leg: elbow into home/away row. None: next only.
 */
function FirstRoundPairColumn({
  stackRef,
  boxRefs,
  a,
  b,
  next,
  nextBoxRef,
  matchProps,
}: {
  stackRef: React.MutableRefObject<HTMLDivElement | null>;
  boxRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  a: BracketSlot;
  b: BracketSlot;
  next: BracketSlot;
  nextBoxRef?: (el: HTMLDivElement | null) => void;
  matchProps: (slot: BracketSlot) => React.ComponentProps<typeof MatchBox>;
}) {
  const sourceOnlyRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const active = [a, b].filter((s) => !isSlotInactive(s));

  const setNextRef = (el: HTMLDivElement | null) => {
    targetRef.current = el;
    nextBoxRef?.(el);
  };

  if (active.length === 0) {
    return (
      <MatchBox {...matchProps(next)} boxRef={setNextRef} />
    );
  }

  if (active.length === 1) {
    const only = active[0];
    return (
      <>
        <MatchBox
          {...matchProps(only)}
          boxRef={(el) => {
            sourceOnlyRef.current = el;
            boxRefs.current[0] = el;
            boxRefs.current[1] = el;
          }}
        />
        <SingleSideJoin sourceRef={sourceOnlyRef} targetRef={targetRef} />
        <MatchBox {...matchProps(next)} boxRef={setNextRef} />
      </>
    );
  }

  return (
    <>
      <div
        className="classification-bracket-round-stack classification-bracket-round-stack--dense"
        ref={stackRef}
      >
        <MatchBox
          {...matchProps(active[0])}
          boxRef={(el) => {
            boxRefs.current[0] = el;
          }}
        />
        <MatchBox
          {...matchProps(active[1])}
          boxRef={(el) => {
            boxRefs.current[1] = el;
          }}
        />
      </div>
      <BracketJoin stackRef={stackRef} boxRefs={boxRefs} />
      <MatchBox {...matchProps(next)} boxRef={setNextRef} />
    </>
  );
}

/** LE-122 — Last 16 → QF → SF → Final (nested joins; Final on mid; 3rd below). */
function SixteenTeamBracketTree({
  r16Round,
  qfRound,
  sfRound,
  finalsRound,
  matchProps,
}: {
  r16Round: BracketRound;
  qfRound: BracketRound;
  sfRound: BracketRound;
  finalsRound: BracketRound;
  matchProps: (slot: BracketSlot) => React.ComponentProps<typeof MatchBox>;
}) {
  const halvesRef = useRef<HTMLDivElement | null>(null);
  const sfBoxRefs = useRef<Array<HTMLDivElement | null>>([null, null]);

  const r16Pair0Stack = useRef<HTMLDivElement | null>(null);
  const r16Pair0Boxes = useRef<Array<HTMLDivElement | null>>([null, null]);
  const r16Pair1Stack = useRef<HTMLDivElement | null>(null);
  const r16Pair1Boxes = useRef<Array<HTMLDivElement | null>>([null, null]);
  const r16Pair2Stack = useRef<HTMLDivElement | null>(null);
  const r16Pair2Boxes = useRef<Array<HTMLDivElement | null>>([null, null]);
  const r16Pair3Stack = useRef<HTMLDivElement | null>(null);
  const r16Pair3Boxes = useRef<Array<HTMLDivElement | null>>([null, null]);

  const qfCol0Ref = useRef<HTMLDivElement | null>(null);
  const qfCol0Boxes = useRef<Array<HTMLDivElement | null>>([null, null]);
  const qfCol1Ref = useRef<HTMLDivElement | null>(null);
  const qfCol1Boxes = useRef<Array<HTMLDivElement | null>>([null, null]);

  const finalWrapRef = useRef<HTMLDivElement | null>(null);
  const [finalsGeom, setFinalsGeom] = useState<{
    height: number;
    mid: number;
  } | null>(null);
  const [finalTop, setFinalTop] = useState<number | null>(null);
  const [thirdTop, setThirdTop] = useState<number | null>(null);

  const { championship, consolation } = splitFinalsSlots(finalsRound.slots);
  const r16 = r16Round.slots;
  const qf = qfRound.slots;
  const sf = sfRound.slots;

  useLayoutEffect(() => {
    if (!finalsGeom || !finalWrapRef.current) {
      setFinalTop(null);
      setThirdTop(null);
      return;
    }
    const wrap = finalWrapRef.current;
    const main = wrap.querySelector(
      '.classification-match-main'
    ) as HTMLElement | null;
    const wrapH = wrap.getBoundingClientRect().height;
    const mainH = main?.getBoundingClientRect().height ?? wrapH;
    // Pin Final match box (not pill) to the SF→Final join mid
    const nextFinal = Math.round(finalsGeom.mid - mainH / 2);
    const nextThird = Math.round(nextFinal + wrapH + 128);
    setFinalTop((prev) => (prev === nextFinal ? prev : nextFinal));
    setThirdTop((prev) => (prev === nextThird ? prev : nextThird));
  }, [finalsGeom, championship?.id, championship?.gameId, championship?.label]);

  return (
    <div className="classification-bracket-scroll">
      <div className="classification-bracket-tree classification-bracket-tree--sixteen">
        <div className="classification-bracket-sixteen-labels">
          <span className="classification-bracket-round-label">
            {r16Round.name}
          </span>
          <span
            className="classification-bracket-eight-label-spacer"
            aria-hidden
          />
          <span className="classification-bracket-round-label">
            {qfRound.name}
          </span>
          <span
            className="classification-bracket-eight-label-spacer"
            aria-hidden
          />
          <span className="classification-bracket-round-label">
            {sfRound.name}
          </span>
          <span
            className="classification-bracket-eight-label-spacer"
            aria-hidden
          />
          <span className="classification-bracket-round-label classification-bracket-round-label--finals-head">
            {finalsRound.name}
          </span>
        </div>

        <div className="classification-bracket-sixteen-body">
          <div className="classification-bracket-sixteen-halves" ref={halvesRef}>
            <div className="classification-bracket-sixteen-half">
              <div
                className="classification-bracket-sixteen-qf-col"
                ref={qfCol0Ref}
              >
                <FirstRoundPairOrByeBand
                  stackRef0={r16Pair0Stack}
                  boxRefs0={r16Pair0Boxes}
                  stackRef1={r16Pair1Stack}
                  boxRefs1={r16Pair1Boxes}
                  a0={r16[0]}
                  b0={r16[1]}
                  next0={qf[0]}
                  a1={r16[2]}
                  b1={r16[3]}
                  next1={qf[1]}
                  nextBoxRef0={(el) => {
                    qfCol0Boxes.current[0] = el;
                  }}
                  nextBoxRef1={(el) => {
                    qfCol0Boxes.current[1] = el;
                  }}
                  matchProps={matchProps}
                />
              </div>
              <BracketJoin stackRef={qfCol0Ref} boxRefs={qfCol0Boxes} />
              <MatchBox
                {...matchProps(sf[0])}
                boxRef={(el) => {
                  sfBoxRefs.current[0] = el;
                }}
              />
            </div>

            <div className="classification-bracket-sixteen-half">
              <div
                className="classification-bracket-sixteen-qf-col"
                ref={qfCol1Ref}
              >
                <FirstRoundPairOrByeBand
                  stackRef0={r16Pair2Stack}
                  boxRefs0={r16Pair2Boxes}
                  stackRef1={r16Pair3Stack}
                  boxRefs1={r16Pair3Boxes}
                  a0={r16[4]}
                  b0={r16[5]}
                  next0={qf[2]}
                  a1={r16[6]}
                  b1={r16[7]}
                  next1={qf[3]}
                  nextBoxRef0={(el) => {
                    qfCol1Boxes.current[0] = el;
                  }}
                  nextBoxRef1={(el) => {
                    qfCol1Boxes.current[1] = el;
                  }}
                  matchProps={matchProps}
                />
              </div>
              <BracketJoin stackRef={qfCol1Ref} boxRefs={qfCol1Boxes} />
              <MatchBox
                {...matchProps(sf[1])}
                boxRef={(el) => {
                  sfBoxRefs.current[1] = el;
                }}
              />
            </div>
          </div>

          <BracketJoin
            stackRef={halvesRef}
            boxRefs={sfBoxRefs}
            onHeightChange={(height, mid) =>
              setFinalsGeom((prev) =>
                prev && prev.height === height && prev.mid === mid
                  ? prev
                  : { height, mid }
              )
            }
          />

          <div className="classification-bracket-eight-finals">
            <div
              className="classification-bracket-eight-finals-anchor"
              style={
                finalsGeom ? { height: `${finalsGeom.height}px` } : undefined
              }
            >
              {championship && (
                <div
                  className="classification-bracket-eight-finals-main"
                  ref={finalWrapRef}
                  style={
                    finalTop != null
                      ? {
                          top: `${finalTop}px`,
                        }
                      : undefined
                  }
                >
                  <MatchBox {...matchProps(championship)} />
                </div>
              )}
              {consolation && (
                <div
                  className="classification-bracket-eight-third"
                  style={
                    thirdTop != null ? { top: `${thirdTop}px` } : undefined
                  }
                >
                  <MatchBox {...matchProps(consolation)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** LE-127 — 12-Team: 4 L16 (bye feeders) → QF → SF → Final. */
function TwelveTeamBracketTree({
  r16Round,
  qfRound,
  sfRound,
  finalsRound,
  matchProps,
}: {
  r16Round: BracketRound;
  qfRound: BracketRound;
  sfRound: BracketRound;
  finalsRound: BracketRound;
  matchProps: (slot: BracketSlot) => React.ComponentProps<typeof MatchBox>;
}) {
  const halvesRef = useRef<HTMLDivElement | null>(null);
  const sfBoxRefs = useRef<Array<HTMLDivElement | null>>([null, null]);
  const qfCol0Ref = useRef<HTMLDivElement | null>(null);
  const qfCol0Boxes = useRef<Array<HTMLDivElement | null>>([null, null]);
  const qfCol1Ref = useRef<HTMLDivElement | null>(null);
  const qfCol1Boxes = useRef<Array<HTMLDivElement | null>>([null, null]);
  const finalWrapRef = useRef<HTMLDivElement | null>(null);
  const [finalsGeom, setFinalsGeom] = useState<{
    height: number;
    mid: number;
  } | null>(null);
  const [finalTop, setFinalTop] = useState<number | null>(null);
  const [thirdTop, setThirdTop] = useState<number | null>(null);

  const { championship, consolation } = splitFinalsSlots(finalsRound.slots);
  const r16 = r16Round.slots;
  const qf = qfRound.slots;
  const sf = sfRound.slots;

  useLayoutEffect(() => {
    if (!finalsGeom || !finalWrapRef.current) {
      setFinalTop(null);
      setThirdTop(null);
      return;
    }
    const wrap = finalWrapRef.current;
    const main = wrap.querySelector(
      '.classification-match-main'
    ) as HTMLElement | null;
    const wrapH = wrap.getBoundingClientRect().height;
    const mainH = main?.getBoundingClientRect().height ?? wrapH;
    const nextFinal = Math.round(finalsGeom.mid - mainH / 2);
    const nextThird = Math.round(nextFinal + wrapH + 128);
    setFinalTop((prev) => (prev === nextFinal ? prev : nextFinal));
    setThirdTop((prev) => (prev === nextThird ? prev : nextThird));
  }, [finalsGeom, championship?.id, championship?.gameId, championship?.label]);

  return (
    <div className="classification-bracket-scroll">
      <div className="classification-bracket-tree classification-bracket-tree--sixteen">
        <div className="classification-bracket-sixteen-labels">
          <span className="classification-bracket-round-label">
            {r16Round.name}
          </span>
          <span
            className="classification-bracket-eight-label-spacer"
            aria-hidden
          />
          <span className="classification-bracket-round-label">
            {qfRound.name}
          </span>
          <span
            className="classification-bracket-eight-label-spacer"
            aria-hidden
          />
          <span className="classification-bracket-round-label">
            {sfRound.name}
          </span>
          <span
            className="classification-bracket-eight-label-spacer"
            aria-hidden
          />
          <span className="classification-bracket-round-label classification-bracket-round-label--finals-head">
            {finalsRound.name}
          </span>
        </div>

        <div className="classification-bracket-sixteen-body">
          <div className="classification-bracket-sixteen-halves" ref={halvesRef}>
            <div className="classification-bracket-sixteen-half">
              <div
                className="classification-bracket-sixteen-qf-col"
                ref={qfCol0Ref}
              >
                <ByeInterleavedBand
                  a0={r16[0]}
                  next0={qf[0]}
                  a1={r16[1]}
                  next1={qf[1]}
                  nextBoxRef0={(el) => {
                    qfCol0Boxes.current[0] = el;
                  }}
                  nextBoxRef1={(el) => {
                    qfCol0Boxes.current[1] = el;
                  }}
                  matchProps={matchProps}
                />
              </div>
              <BracketJoin stackRef={qfCol0Ref} boxRefs={qfCol0Boxes} />
              <MatchBox
                {...matchProps(sf[0])}
                boxRef={(el) => {
                  sfBoxRefs.current[0] = el;
                }}
              />
            </div>

            <div className="classification-bracket-sixteen-half">
              <div
                className="classification-bracket-sixteen-qf-col"
                ref={qfCol1Ref}
              >
                <ByeInterleavedBand
                  a0={r16[2]}
                  next0={qf[2]}
                  a1={r16[3]}
                  next1={qf[3]}
                  nextBoxRef0={(el) => {
                    qfCol1Boxes.current[0] = el;
                  }}
                  nextBoxRef1={(el) => {
                    qfCol1Boxes.current[1] = el;
                  }}
                  matchProps={matchProps}
                />
              </div>
              <BracketJoin stackRef={qfCol1Ref} boxRefs={qfCol1Boxes} />
              <MatchBox
                {...matchProps(sf[1])}
                boxRef={(el) => {
                  sfBoxRefs.current[1] = el;
                }}
              />
            </div>
          </div>

          <BracketJoin
            stackRef={halvesRef}
            boxRefs={sfBoxRefs}
            onHeightChange={(height, mid) =>
              setFinalsGeom((prev) =>
                prev && prev.height === height && prev.mid === mid
                  ? prev
                  : { height, mid }
              )
            }
          />

          <div className="classification-bracket-eight-finals">
            <div
              className="classification-bracket-eight-finals-anchor"
              style={
                finalsGeom ? { height: `${finalsGeom.height}px` } : undefined
              }
            >
              {championship && (
                <div
                  className="classification-bracket-eight-finals-main"
                  ref={finalWrapRef}
                  style={
                    finalTop != null
                      ? {
                          top: `${finalTop}px`,
                        }
                      : undefined
                  }
                >
                  <MatchBox {...matchProps(championship)} />
                </div>
              )}
              {consolation && (
                <div
                  className="classification-bracket-eight-third"
                  style={
                    thirdTop != null ? { top: `${thirdTop}px` } : undefined
                  }
                >
                  <MatchBox {...matchProps(consolation)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** LE-119 / LE-120 — Quarters→Semis joins + Semis→Final (Final on mid; 3rd just below). */
function EightTeamBracketTree({
  qfRound,
  sfRound,
  finalsRound,
  matchProps,
}: {
  qfRound: BracketRound;
  sfRound: BracketRound;
  finalsRound: BracketRound;
  matchProps: (slot: BracketSlot) => React.ComponentProps<typeof MatchBox>;
}) {
  const pairsRef = useRef<HTMLDivElement | null>(null);
  const sfBoxRefs = useRef<Array<HTMLDivElement | null>>([null, null]);
  const qfPair0Stack = useRef<HTMLDivElement | null>(null);
  const qfPair0Boxes = useRef<Array<HTMLDivElement | null>>([null, null]);
  const qfPair1Stack = useRef<HTMLDivElement | null>(null);
  const qfPair1Boxes = useRef<Array<HTMLDivElement | null>>([null, null]);
  const finalWrapRef = useRef<HTMLDivElement | null>(null);
  const [finalsGeom, setFinalsGeom] = useState<{
    height: number;
    mid: number;
  } | null>(null);
  const [thirdTop, setThirdTop] = useState<number | null>(null);

  const { championship, consolation } = splitFinalsSlots(finalsRound.slots);
  const qf = qfRound.slots;
  const sf = sfRound.slots;

  useLayoutEffect(() => {
    if (!finalsGeom || !finalWrapRef.current) {
      setThirdTop(null);
      return;
    }
    const h = finalWrapRef.current.getBoundingClientRect().height;
    // Gap below Final (incl. pill) before 3rd Place
    const next = Math.round(finalsGeom.mid + h / 2 + 48);
    setThirdTop((prev) => (prev === next ? prev : next));
  }, [finalsGeom, championship?.id, championship?.gameId, championship?.label]);

  return (
    <div className="classification-bracket-scroll">
      <div className="classification-bracket-tree classification-bracket-tree--eight">
        <div className="classification-bracket-eight-labels">
          <span className="classification-bracket-round-label">
            {qfRound.name}
          </span>
          <span
            className="classification-bracket-eight-label-spacer"
            aria-hidden
          />
          <span className="classification-bracket-round-label">
            {sfRound.name}
          </span>
          <span
            className="classification-bracket-eight-label-spacer"
            aria-hidden
          />
          <span className="classification-bracket-round-label classification-bracket-round-label--finals-head">
            {finalsRound.name}
          </span>
        </div>

        <div className="classification-bracket-eight-body">
          <div className="classification-bracket-eight-pairs" ref={pairsRef}>
            <div className="classification-bracket-semis-row classification-bracket-semis-row--eight">
              <FirstRoundPairColumn
                stackRef={qfPair0Stack}
                boxRefs={qfPair0Boxes}
                a={qf[0]}
                b={qf[1]}
                next={sf[0]}
                nextBoxRef={(el) => {
                  sfBoxRefs.current[0] = el;
                }}
                matchProps={matchProps}
              />
            </div>

            <div className="classification-bracket-semis-row classification-bracket-semis-row--eight">
              <FirstRoundPairColumn
                stackRef={qfPair1Stack}
                boxRefs={qfPair1Boxes}
                a={qf[2]}
                b={qf[3]}
                next={sf[1]}
                nextBoxRef={(el) => {
                  sfBoxRefs.current[1] = el;
                }}
                matchProps={matchProps}
              />
            </div>
          </div>

          <BracketJoin
            stackRef={pairsRef}
            boxRefs={sfBoxRefs}
            onHeightChange={(height, mid) =>
              setFinalsGeom((prev) =>
                prev && prev.height === height && prev.mid === mid
                  ? prev
                  : { height, mid }
              )
            }
          />

          <div className="classification-bracket-eight-finals">
            <div
              className="classification-bracket-eight-finals-anchor"
              style={
                finalsGeom ? { height: `${finalsGeom.height}px` } : undefined
              }
            >
              {championship && (
                <div
                  className="classification-bracket-eight-finals-main"
                  ref={finalWrapRef}
                  style={
                    finalsGeom
                      ? {
                          top: `${finalsGeom.mid}px`,
                          transform: 'translateY(-50%)',
                        }
                      : undefined
                  }
                >
                  <MatchBox {...matchProps(championship)} />
                </div>
              )}
              {consolation && (
                <div
                  className="classification-bracket-eight-third"
                  style={
                    thirdTop != null ? { top: `${thirdTop}px` } : undefined
                  }
                >
                  <MatchBox {...matchProps(consolation)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BracketTree({
  stage,
  gameById,
  teamById,
  mode,
  selectMode,
  selectedSlotId,
  onSelectSlot,
  onOpenGame,
  onLink,
  onUnlink,
}: {
  stage: TournamentStage;
  gameById: Map<string, Game>;
  teamById?: Map<string, Team>;
  mode: ClassificationBracketMode;
  selectMode?: boolean;
  selectedSlotId?: string | null;
  onSelectSlot?: (stageId: string, slot: BracketSlot) => void;
  onOpenGame: (gameId: string) => void;
  onLink: (stageId: string, slot: BracketSlot) => void;
  onUnlink: (slotId: string) => void;
}) {
  const rounds = stage.bracket?.rounds ?? [];
  const stackRef = useRef<HTMLDivElement | null>(null);
  const boxRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [semisHeight, setSemisHeight] = useState<number | null>(null);

  const matchProps = (slot: BracketSlot) => ({
    slot,
    game: slot.gameId ? gameById.get(slot.gameId) : undefined,
    rounds,
    teamById,
    gameById,
    mode,
    selectMode,
    selected: selectedSlotId === slot.id,
    onSelect: onSelectSlot ? () => onSelectSlot(stage.id, slot) : undefined,
    onOpenGame,
    onLink: () => onLink(stage.id, slot),
    onUnlink: () => onUnlink(slot.id),
  });

  if (rounds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No bracket slots yet.</p>
    );
  }

  // Single round (e.g. 13–14): one column — ending place pill when set.
  if (rounds.length === 1) {
    const isThirteenthPlaceStage = stage.id === 'iubit-stage-13-14';
    return (
      <div className="classification-bracket-scroll">
        <div className="classification-bracket-tree classification-bracket-tree--single">
          {rounds[0].slots.map((slot) => (
            <MatchBox
              key={slot.id}
              {...matchProps(slot)}
              pillLabelOverride={
                isThirteenthPlaceStage ? '13th Place' : undefined
              }
            />
          ))}
        </div>
      </div>
    );
  }

  // LE-122 / LE-127 — 4 rounds: R16→QF→SF→Finals with joins
  if (rounds.length === 4) {
    const r16Round = rounds[0];
    const qfRound = rounds[1];
    const sfRound = rounds[2];
    const finalsRound = rounds[3];
    const canWireTwelve =
      r16Round.slots.length === 4 &&
      qfRound.slots.length >= 4 &&
      sfRound.slots.length >= 2;
    const canWireSixteen =
      r16Round.slots.length >= 8 &&
      qfRound.slots.length >= 4 &&
      sfRound.slots.length >= 2;

    if (canWireTwelve) {
      return (
        <TwelveTeamBracketTree
          r16Round={r16Round}
          qfRound={qfRound}
          sfRound={sfRound}
          finalsRound={finalsRound}
          matchProps={matchProps}
        />
      );
    }

    if (canWireSixteen) {
      return (
        <SixteenTeamBracketTree
          r16Round={r16Round}
          qfRound={qfRound}
          sfRound={sfRound}
          finalsRound={finalsRound}
          matchProps={matchProps}
        />
      );
    }
  }

  // LE-118 / LE-119 — 8-Team (exactly 3 rounds): Quarters→Semis→Finals with joins
  if (rounds.length === 3) {
    const qfRound = rounds[0];
    const sfRound = rounds[1];
    const finalsRound = rounds[2];
    const canWireEight =
      qfRound.slots.length >= 4 && sfRound.slots.length >= 2;

    if (canWireEight) {
      return (
        <EightTeamBracketTree
          qfRound={qfRound}
          sfRound={sfRound}
          finalsRound={finalsRound}
          matchProps={matchProps}
        />
      );
    }
  }

  // Fallback: columns only (unusual round shapes / 3+ rounds that don't match)
  if (rounds.length >= 3) {
    return (
      <div className="classification-bracket-scroll">
        <div className="classification-bracket-tree classification-bracket-tree--multi">
          {rounds.map((round, roundIndex) => {
            const isLast = roundIndex === rounds.length - 1;
            const dense = round.slots.length >= 4;
            if (isLast) {
              const { championship, consolation } = splitFinalsSlots(round.slots);
              return (
                <div
                  key={round.id}
                  className="classification-bracket-round classification-bracket-round--finals"
                >
                  <p className="classification-bracket-round-label">{round.name}</p>
                  <div className="classification-bracket-round-stack classification-bracket-round-stack--finals-multi">
                    {championship && (
                      <MatchBox {...matchProps(championship)} />
                    )}
                    {consolation && (
                      <MatchBox {...matchProps(consolation)} />
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div key={round.id} className="classification-bracket-round">
                <p className="classification-bracket-round-label">{round.name}</p>
                <div
                  className={
                    dense
                      ? 'classification-bracket-round-stack classification-bracket-round-stack--dense'
                      : 'classification-bracket-round-stack'
                  }
                >
                  {round.slots.map((slot) => (
                    <MatchBox key={slot.id} {...matchProps(slot)} />
                  ))}
                </div>
              </div>
            );
          })}
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
              {leftRound.slots
                .filter((slot) => !isSlotInactive(slot))
                .map((slot, index, active) => (
                  <MatchBox
                    key={slot.id}
                    {...matchProps(slot)}
                    boxRef={(el) => {
                      if (active.length === 1) {
                        boxRefs.current[0] = el;
                        boxRefs.current[1] = el;
                      } else {
                        boxRefs.current[index] = el;
                      }
                    }}
                  />
                ))}
            </div>
            {showJoin &&
              leftRound.slots.some((s) => !isSlotInactive(s)) && (
              <BracketJoin
                stackRef={stackRef}
                boxRefs={boxRefs}
                onHeightChange={(height) =>
                  setSemisHeight((prev) => (prev === height ? prev : height))
                }
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
                <MatchBox {...matchProps(championship)} />
              </div>
            )}
          </div>
          {consolation && (
            <div className="classification-bracket-finals-third">
              <MatchBox {...matchProps(consolation)} />
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
  teams,
  selectMode = false,
  selectedSlotId = null,
  onSelectSlot,
  activeStageId: activeStageIdProp,
  onActiveStageIdChange,
  canvasToolbar,
  canvasInspector,
  hideTitle = false,
}: TournamentClassificationBracketProps) {
  const structure = normalizeTournamentStructure(tournament.structure);
  const [linkTarget, setLinkTarget] = useState<{
    stageId: string;
    slotId: string;
  } | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [autoLinkSummary, setAutoLinkSummary] = useState<string | null>(null);
  const [activeStageIdLocal, setActiveStageIdLocal] = useState<string>('');

  const activeStageId = activeStageIdProp ?? activeStageIdLocal;
  const setActiveStageId = (id: string) => {
    onActiveStageIdChange?.(id);
    if (activeStageIdProp == null) setActiveStageIdLocal(id);
  };

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
    const next =
      activeStageId && stages.some((s) => s.id === activeStageId)
        ? activeStageId
        : preferredStageId(stages);
    if (next !== activeStageId) setActiveStageId(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when stage list changes
  }, [stages.map((s) => s.id).join('|')]);

  const activeStage = stages.find((s) => s.id === activeStageId) ?? stages[0];

  const gameById = useMemo(() => {
    const map = new Map<string, Game>();
    for (const g of games) map.set(g.id, g);
    return map;
  }, [games]);

  const teamById = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams ?? []) map.set(t.id, t);
    for (const g of games) {
      if (g.homeTeam && !map.has(g.homeTeamId)) map.set(g.homeTeamId, g.homeTeam);
      if (g.awayTeam && !map.has(g.awayTeamId)) map.set(g.awayTeamId, g.awayTeam);
    }
    return map;
  }, [teams, games]);

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
    let nextStructure = structure;
    let nextGames = games;
    let linked = 0;
    let skipped = 0;

    const iubit = autoLinkIubitBracketGames(
      nextStructure,
      nextGames,
      tournament.id
    );
    nextStructure = iubit.structure;
    nextGames = iubit.games;
    linked += iubit.report.linked;
    skipped += iubit.report.skipped;

    // LE-115 — generic: link by Winner/Loser + seed resolution (Format A, placement)
    const resolved = autoLinkBracketByResolvedTeams(
      nextStructure,
      nextGames,
      tournament.id
    );
    nextStructure = resolved.structure;
    nextGames = resolved.games;
    linked += resolved.report.linked;
    skipped += resolved.report.skipped;

    const structureChanged =
      JSON.stringify(nextStructure) !==
      JSON.stringify(structure ?? { stages: [] });
    if (structureChanged) {
      onUpdateTournament({
        id: tournament.id,
        patch: (prev) => ({ ...prev, structure: nextStructure }),
      });
    }
    if (linked > 0) {
      onGamesUpdate(nextGames);
    }
    setAutoLinkSummary(
      linked > 0
        ? `Auto-linked ${linked} game${linked === 1 ? '' : 's'} to bracket slots${
            skipped ? ` (${skipped} skipped)` : ''
          }.`
        : `No new links (${skipped} skipped). Check group standings / scores if slots are empty.`
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
        {!hideTitle && <h3 className="text-lg font-medium">Brackets</h3>}
        <div className="flex flex-wrap gap-2 ml-auto">
          {canvasToolbar}
          {mode === 'edit' && (
            <Button type="button" variant="secondary" onClick={runAutoLink}>
              Auto-link games
            </Button>
          )}
        </div>
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
              teamById={teamById}
              mode={mode}
              selectMode={selectMode}
              selectedSlotId={selectedSlotId}
              onSelectSlot={onSelectSlot}
              onOpenGame={onNavigateToGame}
              onLink={openLink}
              onUnlink={unlink}
            />
          </CardContent>
        </Card>
      )}

      {canvasInspector}

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
