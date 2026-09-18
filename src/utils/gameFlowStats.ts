import type { Game, GameEvent } from '../App';
import {
  getOptionalAdvancedStatValue,
  isScoreOnlyTeam,
} from './gameDisplay';

export interface ScoreAtMoment {
  home: number;
  away: number;
}

export interface GameFlowSideStats {
  biggestLead: number | null;
  /** Scoreboard when biggest lead was set; null if unknown (e.g. persisted-only). */
  biggestLeadScore: ScoreAtMoment | null;
  biggestScoringRun: number | null;
  /** Scoreboard when biggest scoring run was completed; null if unknown. */
  biggestScoringRunScore: ScoreAtMoment | null;
}

export interface GameFlowStats {
  home: GameFlowSideStats;
  away: GameFlowSideStats;
  /** Shared game-level count; null when no scoring timeline. */
  leadChanges: number | null;
  /** Shared game-level count; null when no scoring timeline. */
  timesTied: number | null;
}

const emptySide = (): GameFlowSideStats => ({
  biggestLead: null,
  biggestLeadScore: null,
  biggestScoringRun: null,
  biggestScoringRunScore: null,
});

const EMPTY_FLOW = (): GameFlowStats => ({
  home: emptySide(),
  away: emptySide(),
  leadChanges: null,
  timesTied: null,
});

type LeaderSide = 'home' | 'away' | 'tie';

function leaderOf(home: number, away: number): LeaderSide {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'tie';
}

/** Format `26 (58-32)` when score-at-moment is known; else plain number. */
export function formatGameFlowTeamDisplay(
  value: number | null,
  score: ScoreAtMoment | null
): string {
  if (value === null) return '—';
  if (score) return `${value} (${score.home}-${score.away})`;
  return String(value);
}

/**
 * Derive game-flow metrics from stamped event scores.
 * Returns nulls when there are no score-changing events.
 */
export function deriveGameFlowFromEvents(
  events: readonly GameEvent[] | null | undefined
): GameFlowStats {
  if (!events || events.length === 0) {
    return EMPTY_FLOW();
  }

  const sorted = [...events].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return 0;
  });

  let prevHome = 0;
  let prevAway = 0;
  let prevLeader: LeaderSide = 'tie';
  /** Last side that held a lead; opening take-from-tie is not a lead change. */
  let lastNonTieLeader: 'home' | 'away' | null = null;
  let homeBiggestLead = 0;
  let awayBiggestLead = 0;
  let homeLeadScore: ScoreAtMoment | null = null;
  let awayLeadScore: ScoreAtMoment | null = null;
  let homeRun = 0;
  let awayRun = 0;
  let homeBiggestRun = 0;
  let awayBiggestRun = 0;
  let homeRunScore: ScoreAtMoment | null = null;
  let awayRunScore: ScoreAtMoment | null = null;
  let leadChanges = 0;
  let timesTied = 0;
  let sawScoring = false;

  for (const ev of sorted) {
    const home = typeof ev.homeScore === 'number' ? ev.homeScore : prevHome;
    const away = typeof ev.awayScore === 'number' ? ev.awayScore : prevAway;
    if (home === prevHome && away === prevAway) continue;

    const homeDelta = home - prevHome;
    const awayDelta = away - prevAway;
    const scoreNow: ScoreAtMoment = { home, away };

    if (homeDelta > 0 && awayDelta <= 0) {
      sawScoring = true;
      homeRun += homeDelta;
      awayRun = 0;
      if (homeRun > homeBiggestRun) {
        homeBiggestRun = homeRun;
        homeRunScore = scoreNow;
      }
    } else if (awayDelta > 0 && homeDelta <= 0) {
      sawScoring = true;
      awayRun += awayDelta;
      homeRun = 0;
      if (awayRun > awayBiggestRun) {
        awayBiggestRun = awayRun;
        awayRunScore = scoreNow;
      }
    } else if (homeDelta > 0 && awayDelta > 0) {
      sawScoring = true;
      homeRun = homeDelta;
      awayRun = awayDelta;
      if (homeRun > homeBiggestRun) {
        homeBiggestRun = homeRun;
        homeRunScore = scoreNow;
      }
      if (awayRun > awayBiggestRun) {
        awayBiggestRun = awayRun;
        awayRunScore = scoreNow;
      }
    } else {
      // Score decreased (edit/correction) — reset runs, still update lead tracking
      homeRun = 0;
      awayRun = 0;
    }

    const currLeader = leaderOf(home, away);

    if (currLeader === 'home') {
      const margin = home - away;
      if (margin > homeBiggestLead) {
        homeBiggestLead = margin;
        homeLeadScore = scoreNow;
      }
    } else if (currLeader === 'away') {
      const margin = away - home;
      if (margin > awayBiggestLead) {
        awayBiggestLead = margin;
        awayLeadScore = scoreNow;
      }
    }

    // Lead change = other team takes the lead (through a tie still counts).
    // First lead from 0–0 / opening tie does not count.
    if (currLeader === 'home' || currLeader === 'away') {
      if (lastNonTieLeader !== null && lastNonTieLeader !== currLeader) {
        leadChanges += 1;
      }
      lastNonTieLeader = currLeader;
    }

    if (prevLeader !== 'tie' && currLeader === 'tie') {
      timesTied += 1;
    }

    prevHome = home;
    prevAway = away;
    prevLeader = currLeader;
  }

  if (!sawScoring) {
    return EMPTY_FLOW();
  }

  // Teams that never led / never scored still show 0 with no score context
  // when the opponent did establish a lead/run — keep score only when a max was set.
  return {
    home: {
      biggestLead: homeBiggestLead,
      biggestLeadScore: homeLeadScore,
      biggestScoringRun: homeBiggestRun,
      biggestScoringRunScore: homeRunScore,
    },
    away: {
      biggestLead: awayBiggestLead,
      biggestLeadScore: awayLeadScore,
      biggestScoringRun: awayBiggestRun,
      biggestScoringRunScore: awayRunScore,
    },
    leadChanges,
    timesTied,
  };
}

/**
 * Prefer event-derived values when the timeline has scoring; fall back to
 * persisted teamStats / game.gameFlow (imports, or numbers written during live).
 * Score-at-moment always comes from events when available (Option A).
 */
export function resolveGameFlowStats(game: Game): GameFlowStats {
  const derived = deriveGameFlowFromEvents(game.events);
  const homeScoreOnly = isScoreOnlyTeam(game, 'home');
  const awayScoreOnly = isScoreOnlyTeam(game, 'away');

  const homePersistedLead = getOptionalAdvancedStatValue(
    game.teamStats?.home,
    'biggest_lead',
    homeScoreOnly
  );
  const awayPersistedLead = getOptionalAdvancedStatValue(
    game.teamStats?.away,
    'biggest_lead',
    awayScoreOnly
  );
  const homePersistedRun = getOptionalAdvancedStatValue(
    game.teamStats?.home,
    'biggest_scoring_run',
    homeScoreOnly
  );
  const awayPersistedRun = getOptionalAdvancedStatValue(
    game.teamStats?.away,
    'biggest_scoring_run',
    awayScoreOnly
  );

  return {
    home: {
      biggestLead: derived.home.biggestLead ?? homePersistedLead,
      biggestLeadScore: derived.home.biggestLeadScore,
      biggestScoringRun: derived.home.biggestScoringRun ?? homePersistedRun,
      biggestScoringRunScore: derived.home.biggestScoringRunScore,
    },
    away: {
      biggestLead: derived.away.biggestLead ?? awayPersistedLead,
      biggestLeadScore: derived.away.biggestLeadScore,
      biggestScoringRun: derived.away.biggestScoringRun ?? awayPersistedRun,
      biggestScoringRunScore: derived.away.biggestScoringRunScore,
    },
    leadChanges: derived.leadChanges ?? game.gameFlow?.leadChanges ?? null,
    timesTied: derived.timesTied ?? game.gameFlow?.timesTied ?? null,
  };
}

/**
 * Write derived game-flow onto teamStats + game.gameFlow (idempotent).
 * Call after recordEvent / full event replay so live storage stays in sync.
 */
export function applyGameFlowToGame(game: Game): Game {
  const derived = deriveGameFlowFromEvents(game.events);
  return {
    ...game,
    teamStats: {
      home: {
        ...game.teamStats.home,
        biggest_lead: derived.home.biggestLead,
        biggest_scoring_run: derived.home.biggestScoringRun,
      },
      away: {
        ...game.teamStats.away,
        biggest_lead: derived.away.biggestLead,
        biggest_scoring_run: derived.away.biggestScoringRun,
      },
    },
    gameFlow: {
      leadChanges: derived.leadChanges,
      timesTied: derived.timesTied,
    },
  };
}
