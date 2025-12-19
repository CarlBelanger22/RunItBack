import { Game, GameEvent, GameStats, TeamStats, Player } from '../App';
import { MetricsCalculator } from '../components/MetricsCalculator';

/**
 * GameLogic provides utility functions to update game state based on events.
 */
export class GameLogic {
  /**
   * Records a new event and updates all relevant game statistics.
   */
  static recordEvent(game: Game, event: GameEvent): Game {
    const updatedGame = { ...game };
    
    // 1. Add event to history
    updatedGame.events = [...game.events, event];
    
    // 2. Update scores based on the event
    if (event.type === 'shot_attempt' && event.details.made) {
      const points = event.details.isThree ? 3 : 2;
      this.updateScore(updatedGame, event.teamId, points);
    } else if (event.type === 'free_throw') {
      const ftMade = event.details.attempts?.filter((a: boolean) => a).length || 0;
      this.updateScore(updatedGame, event.teamId, ftMade);
    }
    
    // 3. Update scores in the event object itself
    event.homeScore = updatedGame.teamStats.home.total_points;
    event.awayScore = updatedGame.teamStats.away.total_points;
    
    // 4. Update individual and team stats
    this.updateStats(updatedGame, event);
    
    return updatedGame;
  }

  /**
   * Updates the team score.
   */
  private static updateScore(game: Game, teamId: string, points: number) {
    if (points === 0) return;
    
    const isHome = teamId === game.homeTeamId;
    const teamStats = isHome ? game.teamStats.home : game.teamStats.away;
    
    teamStats.total_points += points;
    
    // Update period scoring
    const periodKey = `q${game.currentPeriod}_points` as keyof TeamStats;
    if (typeof teamStats[periodKey] === 'number') {
      (teamStats[periodKey] as number) += points;
    } else if (game.currentPeriod > 4) {
      teamStats.ot_points += points;
    }
  }

  /**
   * Updates individual and team stats based on the event type.
   */
  private static updateStats(game: Game, event: GameEvent) {
    const isHome = event.teamId === game.homeTeamId;
    const teamStats = isHome ? game.teamStats.home : game.teamStats.away;
    const playerStats = event.playerId ? this.getOrCreatePlayerStats(game, event.playerId) : null;

    switch (event.type) {
      case 'shot_attempt':
        this.handleShotAttempt(teamStats, playerStats, event.details);
        // Handle assist
        if (event.details.made && event.details.assistedBy) {
          const assistantStats = this.getOrCreatePlayerStats(game, event.details.assistedBy);
          assistantStats.assists += 1;
          teamStats.assists += 1;
        }
        // Handle block
        if (!event.details.made && event.details.blockedBy) {
          const blockerStats = this.getOrCreatePlayerStats(game, event.details.blockedBy);
          blockerStats.blocks += 1;
          teamStats.blocks += 1;
          if (playerStats) playerStats.blocks_received += 1;
        }
        break;

      case 'free_throw':
        this.handleFreeThrow(teamStats, playerStats, event.details);
        break;

      case 'rebound':
        this.handleRebound(teamStats, playerStats, event.details);
        break;

      case 'turnover':
        teamStats.turnovers += 1;
        if (playerStats) playerStats.turnovers += 1;
        break;

      case 'foul':
        this.handleFoul(teamStats, playerStats, event.details);
        // Handle fouls drawn if specified
        if (event.details.drawnBy) {
          const drawerStats = this.getOrCreatePlayerStats(game, event.details.drawnBy);
          drawerStats.fouls_drawn += 1;
        }
        break;
    }
  }

  private static handleShotAttempt(team: TeamStats, player: GameStats | null, details: any) {
    const points = details.isThree ? 3 : 2;
    const made = details.made;

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
        // player.two_made is not in GameStats type but we could track it if needed
      }

      // Advanced team metrics
      if (details.inPaint) team.points_in_paint += points;
      if (details.isTransition) team.fastbreak_points += points;
      if (details.secondChance) team.second_chance_points += points;
      // points_off_turnovers would need to track the last turnover
    }
  }

  private static handleFreeThrow(team: TeamStats, player: GameStats | null, details: any) {
    const attempts = details.attempts || [];
    const madeCount = attempts.filter((a: boolean) => a).length;
    const totalCount = attempts.length;

    team.ft_attempted += totalCount;
    team.ft_made += madeCount;
    
    if (player) {
      player.ft_attempted += totalCount;
      player.ft_made += madeCount;
      player.points += madeCount;
    }
  }

  private static handleRebound(team: TeamStats, player: GameStats | null, details: any) {
    const isOffensive = details.reboundType === 'offensive';
    
    if (isOffensive) {
      team.orb += 1;
      if (player) player.orb += 1;
    } else {
      team.drb += 1;
      if (player) player.drb += 1;
    }
    
    team.total_rebounds = team.orb + team.drb + (team.team_rebounds || 0);
  }

  private static handleFoul(team: TeamStats, player: GameStats | null, details: any) {
    team.fouls += 1;
    if (player) {
      player.fouls += 1;
      if (details.foulType === 'technical') player.tech_fouls += 1;
      if (details.foulType === 'unsportsmanlike') player.unsportsmanlike_fouls += 1;
    }
  }

  private static getOrCreatePlayerStats(game: Game, playerId: string): GameStats {
    let stats = game.gameStats.find(s => s.playerId === playerId);
    if (!stats) {
      stats = MetricsCalculator.getEmptyStats(playerId);
      game.gameStats.push(stats);
    }
    return stats;
  }

  /**
   * Undoes the last event and reverts statistics.
   * This is a complex operation; for now we rebuild the stats from scratch for simplicity and accuracy.
   */
  static undoLastEvent(game: Game): Game {
    if (game.events.length === 0) return game;
    
    const eventsToKeep = game.events.slice(0, -1);
    
    // Reset game to initial state (but keep basic info)
    const resetGame: Game = {
      ...game,
      events: [],
      gameStats: [],
      teamStats: {
        home: this.getEmptyTeamStats(game.homeTeamId),
        away: this.getEmptyTeamStats(game.awayTeamId)
      },
      shots: game.shots.slice(0, -1) // Assuming the last event was the last shot if it was a shot
    };
    
    // Replay all events
    let updatedGame = resetGame;
    eventsToKeep.forEach(event => {
      updatedGame = this.recordEvent(updatedGame, event);
    });
    
    return updatedGame;
  }

  private static getEmptyTeamStats(teamId: string): TeamStats {
    return {
      teamId,
      q1_points: 0, q2_points: 0, q3_points: 0, q4_points: 0, ot_points: 0,
      total_points: 0,
      fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0,
      two_made: 0, two_attempted: 0,
      ft_made: 0, ft_attempted: 0,
      orb: 0, drb: 0, team_rebounds: 0, total_rebounds: 0,
      assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0,
      points_off_turnovers: 0, points_in_paint: 0, second_chance_points: 0,
      fastbreak_points: 0, bench_points: 0, biggest_lead: 0, biggest_scoring_run: 0
    };
  }
}

