import type { Game, GameEvent, GameStats, TeamStats, Shot } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';
import { possessionContextForScoringTeam } from '../liveEntry/possessionEngine';

/**
 * GameLogic provides utility functions to update game state based on events.
 */
export class GameLogic {
  static recordEvent(game: Game, event: GameEvent): Game {
    const updatedGame = { ...game };

    this.annotatePossessionContext(updatedGame, event);

    updatedGame.events = [...game.events, event];

    if (event.type === 'shot_attempt' && event.details.made) {
      const points = event.details.isThree ? 3 : 2;
      this.updateScore(updatedGame, event.teamId, points);
    } else if (event.type === 'free_throw') {
      const points = this.freeThrowPoints(event.details);
      this.updateScore(updatedGame, event.teamId, points);
    }

    event.homeScore = updatedGame.teamStats.home.total_points;
    event.awayScore = updatedGame.teamStats.away.total_points;

    this.updateStats(updatedGame, event);

    return updatedGame;
  }

  private static annotatePossessionContext(game: Game, event: GameEvent): void {
    const willScore =
      (event.type === 'shot_attempt' && event.details.made) ||
      (event.type === 'free_throw' && this.freeThrowPoints(event.details) > 0);

    if (!willScore || event.details.possessionContext) return;

    event.details.possessionContext = possessionContextForScoringTeam(
      game,
      game.events,
      event.teamId
    );
  }

  private static freeThrowPoints(details: Record<string, unknown>): number {
    if (typeof details.made === 'boolean') return details.made ? 1 : 0;
    const attempts = details.attempts as boolean[] | undefined;
    return attempts?.filter(Boolean).length ?? 0;
  }

  private static updateScore(game: Game, teamId: string, points: number) {
    if (points === 0) return;

    const teamStats =
      teamId === game.homeTeamId ? game.teamStats.home : game.teamStats.away;

    teamStats.total_points += points;

    const periodKey = `q${game.currentPeriod}_points` as keyof TeamStats;
    if (typeof teamStats[periodKey] === 'number') {
      (teamStats[periodKey] as number) += points;
    } else if (game.currentPeriod > 4) {
      teamStats.ot_points += points;
    }
  }

  private static updateStats(game: Game, event: GameEvent) {
    const isHome = event.teamId === game.homeTeamId;
    const teamStats = isHome ? game.teamStats.home : game.teamStats.away;
    const playerStats = event.playerId
      ? this.getOrCreatePlayerStats(game, event.playerId)
      : null;

    switch (event.type) {
      case 'shot_attempt':
        this.handleShotAttempt(teamStats, playerStats, event.details);
        if (event.details.made && event.details.assistedBy) {
          const assistantStats = this.getOrCreatePlayerStats(
            game,
            event.details.assistedBy
          );
          assistantStats.assists += 1;
          teamStats.assists += 1;
        }
        if (!event.details.made && event.details.blockedBy) {
          const blockerStats = this.getOrCreatePlayerStats(
            game,
            event.details.blockedBy
          );
          blockerStats.blocks += 1;
          teamStats.blocks += 1;
          if (playerStats) playerStats.blocks_received += 1;
        }
        break;

      case 'free_throw':
        this.handleFreeThrow(teamStats, playerStats, event.details);
        break;

      case 'rebound':
        this.handleRebound(game, teamStats, playerStats, event);
        break;

      case 'turnover':
        this.handleTurnover(game, teamStats, playerStats, event);
        break;

      case 'jump_ball':
        this.handleJumpBall(game, teamStats, playerStats, event);
        break;

      case 'foul':
        this.handleFoul(teamStats, playerStats, event.details);
        if (event.details.drawnBy) {
          const drawerStats = this.getOrCreatePlayerStats(
            game,
            event.details.drawnBy
          );
          drawerStats.fouls_drawn += 1;
        }
        break;

      case 'substitution':
        break;
    }
  }

  private static handleShotAttempt(
    team: TeamStats,
    player: GameStats | null,
    details: Record<string, unknown>
  ) {
    const points = details.isThree ? 3 : 2;
    const made = !!details.made;
    const ctx = details.possessionContext as
      | { secondChance?: boolean; offTurnover?: boolean }
      | undefined;

    team.fg_attempted += 1;
    if (player) player.fg_attempted += 1;

    if (details.isThree) {
      team.three_attempted += 1;
      if (player) player.three_attempted += 1;
    } else {
      team.two_attempted += 1;
      if (player) player.two_attempted += 1;
    }

    if (made) {
      team.fg_made += 1;
      if (player) {
        player.fg_made += 1;
        player.points += points;
      }

      if (details.isThree) {
        team.three_made += 1;
        if (player) player.three_made += 1;
      } else {
        team.two_made += 1;
      }

      if (details.inPaint) {
        team.points_in_paint = (team.points_in_paint ?? 0) + points;
      }
      if (details.isTransition) {
        team.fastbreak_points = (team.fastbreak_points ?? 0) + points;
      }
      if (ctx?.secondChance) {
        team.second_chance_points = (team.second_chance_points ?? 0) + points;
      }
      if (ctx?.offTurnover) {
        team.points_off_turnovers = (team.points_off_turnovers ?? 0) + points;
      }
    }
  }

  private static handleFreeThrow(
    team: TeamStats,
    player: GameStats | null,
    details: Record<string, unknown>
  ) {
    const ctx = details.possessionContext as
      | { secondChance?: boolean; offTurnover?: boolean }
      | undefined;

    let madeCount = 0;
    let totalCount = 1;

    if (typeof details.made === 'boolean') {
      madeCount = details.made ? 1 : 0;
    } else {
      const attempts = (details.attempts as boolean[]) || [];
      madeCount = attempts.filter(Boolean).length;
      totalCount = attempts.length;
    }

    team.ft_attempted += totalCount;
    team.ft_made += madeCount;

    if (player) {
      player.ft_attempted += totalCount;
      player.ft_made += madeCount;
      player.points += madeCount;
    }

    if (madeCount > 0) {
      if (ctx?.secondChance) {
        team.second_chance_points =
          (team.second_chance_points ?? 0) + madeCount;
      }
      if (ctx?.offTurnover) {
        team.points_off_turnovers =
          (team.points_off_turnovers ?? 0) + madeCount;
      }
    }
  }

  private static handleRebound(
    game: Game,
    team: TeamStats,
    player: GameStats | null,
    event: GameEvent
  ) {
    const rt = event.details.reboundType as string;
    const isTeam = rt === 'team_offensive' || rt === 'team_defensive';
    const isOffensive = rt === 'offensive' || rt === 'team_offensive';

    if (isTeam) {
      team.team_rebounds = (team.team_rebounds || 0) + 1;
      if (!team.team_coach) {
        team.team_coach = { orb: 0, drb: 0, turnovers: 0, fouls: 0 };
      }
      if (isOffensive) team.team_coach.orb += 1;
      else team.team_coach.drb += 1;
    }

    if (isOffensive) {
      team.orb += 1;
      if (player) player.orb += 1;
    } else {
      team.drb += 1;
      if (player) player.drb += 1;
    }

    if (player) {
      // TRB derived as orb + drb in display layers
    }

    team.total_rebounds = team.orb + team.drb + (team.team_rebounds || 0);
  }

  private static handleJumpBall(
    game: Game,
    teamStats: TeamStats,
    playerStats: GameStats | null,
    event: GameEvent
  ) {
    const d = event.details;
    const arrowAfter = d.arrowAfterTeamId as string | undefined;
    if (arrowAfter) {
      game.possessionArrowTeamId = arrowAfter;
    }

    if (d.kind === 'held_ball' && d.possessionChanged && d.turnoverPlayerId) {
      const turnoverEvent: GameEvent = {
        ...event,
        type: 'turnover',
        teamId: event.teamId,
        playerId: d.turnoverPlayerId as string,
        details: {
          isTeamTurnover: false,
          stolenBy: d.stealPlayerId ?? null,
          jumpBall: true,
        },
      };
      this.handleTurnover(game, teamStats, playerStats, turnoverEvent);
    }
  }

  private static handleTurnover(
    game: Game,
    team: TeamStats,
    player: GameStats | null,
    event: GameEvent
  ) {
    const isTeam = !!event.details.isTeamTurnover;

    if (isTeam) {
      if (!team.team_coach) {
        team.team_coach = { orb: 0, drb: 0, turnovers: 0, fouls: 0 };
      }
      team.team_coach.turnovers += 1;
    } else if (player) {
      player.turnovers += 1;
    }
    team.turnovers += 1;

    const stolenBy = event.details.stolenBy as string | undefined;
    if (stolenBy && stolenBy !== 'team') {
      const stealerStats = this.getOrCreatePlayerStats(game, stolenBy);
      stealerStats.steals += 1;
      const stealerTeamId =
        game.homeTeam.players.some((p) => p.id === stolenBy)
          ? game.homeTeamId
          : game.awayTeamId;
      const stealerTeamStats =
        stealerTeamId === game.homeTeamId
          ? game.teamStats.home
          : game.teamStats.away;
      stealerTeamStats.steals += 1;
    }
  }

  private static handleFoul(
    team: TeamStats,
    player: GameStats | null,
    details: Record<string, unknown>
  ) {
    team.fouls += 1;
    if (player) {
      player.fouls += 1;
      if (details.foulType === 'technical') player.tech_fouls += 1;
      if (details.foulType === 'unsportsmanlike')
        player.unsportsmanlike_fouls += 1;
    }
  }

  private static getOrCreatePlayerStats(
    game: Game,
    playerId: string
  ): GameStats {
    let stats = game.gameStats.find((s) => s.playerId === playerId);
    if (!stats) {
      stats = MetricsCalculator.getEmptyStats(playerId);
      game.gameStats.push(stats);
    }
    return stats;
  }

  static undoLastEvent(game: Game): Game {
    if (game.events.length === 0) return game;

    const eventsToKeep = game.events.slice(0, -1);
    const lastEvent = game.events[game.events.length - 1];
    const shotsToKeep =
      lastEvent.type === 'shot_attempt'
        ? game.shots.slice(0, -1)
        : [...game.shots];

    const resetGame: Game = {
      ...game,
      events: [],
      gameStats: [],
      possessionArrowTeamId: undefined,
      teamStats: {
        home: this.getEmptyTeamStats(game.homeTeamId),
        away: this.getEmptyTeamStats(game.awayTeamId),
      },
      shots: shotsToKeep,
    };

    let updatedGame = resetGame;
    eventsToKeep.forEach((event) => {
      updatedGame = this.recordEvent(updatedGame, { ...event });
    });

    return updatedGame;
  }

  /** Rebuild stats and scores from an ordered event list (for PBP edits). */
  static replayFromEvents(game: Game, events: GameEvent[]): Game {
    const resetGame: Game = {
      ...game,
      events: [],
      gameStats: [],
      possessionArrowTeamId: undefined,
      teamStats: {
        home: this.getEmptyTeamStats(game.homeTeamId),
        away: this.getEmptyTeamStats(game.awayTeamId),
      },
      shots: [],
    };

    let updatedGame = resetGame;
    for (const event of events) {
      if (event.type === 'shot_attempt' && event.playerId) {
        const d = event.details;
        const shot: Shot = {
          id: `shot-${event.id}`,
          playerId: event.playerId,
          x: typeof d.x === 'number' ? d.x : 50,
          y: typeof d.y === 'number' ? d.y : 50,
          made: !!d.made,
          isThree: !!d.isThree,
          timestamp: event.timestamp,
          assistedBy: d.assistedBy,
          blockedBy: d.blockedBy,
          isTransition: d.isTransition,
          inPaint: d.inPaint,
          period: event.period,
          gameTime: event.gameTime,
        };
        updatedGame = { ...updatedGame, shots: [...updatedGame.shots, shot] };
      }
      updatedGame = this.recordEvent(updatedGame, { ...event });
    }

    return updatedGame;
  }

  private static getEmptyTeamStats(teamId: string): TeamStats {
    return {
      teamId,
      q1_points: 0,
      q2_points: 0,
      q3_points: 0,
      q4_points: 0,
      ot_points: 0,
      total_points: 0,
      fg_made: 0,
      fg_attempted: 0,
      three_made: 0,
      three_attempted: 0,
      two_made: 0,
      two_attempted: 0,
      ft_made: 0,
      ft_attempted: 0,
      orb: 0,
      drb: 0,
      team_rebounds: 0,
      total_rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      points_off_turnovers: null,
      points_in_paint: null,
      second_chance_points: null,
      fastbreak_points: null,
      bench_points: null,
      biggest_lead: null,
      biggest_scoring_run: null,
      team_coach: { orb: 0, drb: 0, turnovers: 0, fouls: 0 },
    };
  }
}
