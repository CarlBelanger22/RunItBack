import { GameStats } from '../App';

// Advanced metrics calculations as specified in the RunItBack brief

export interface AdvancedMetrics {
  efficiency: number; // EFF
  gameScore: number; // GmSc
  indexOfSuccess: number; // IoS
  fieldGoalPercentage: number; // FG%
  threePointPercentage: number; // 3P%
  freeThrowPercentage: number; // FT%
  twoPointPercentage: number; // 2P%
  totalRebounds: number; // REB = ORB + DRB
  twoPointMade: number; // 2PM = FGM - 3PM
  twoPointAttempted: number; // 2PA = FGA - 3PA
  minutesPerGame: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
}

export class MetricsCalculator {
  /**
   * Calculate Efficiency (EFF)
   * EFF = PTS + REB + AST + STL + BLK − (FGA − FGM) − (FTA − FTM) − TO
   */
  static calculateEfficiency(stats: GameStats): number {
    const rebounds = stats.orb + stats.drb;
    const fieldGoalMisses = stats.fg_attempted - stats.fg_made;
    const freeThrowMisses = stats.ft_attempted - stats.ft_made;
    
    return stats.points + rebounds + stats.assists + stats.steals + stats.blocks 
           - fieldGoalMisses - freeThrowMisses - stats.turnovers;
  }

  /**
   * Calculate Game Score (GmSc) - Hollinger-inspired
   * GmSc = PTS + 0.4*FGM − 0.7*FGA − 0.4*(FTA − FTM) + 0.7*ORB + 0.3*DRB + STL + 0.7*AST + 0.7*BLK − 0.4*PF − TO
   */
  static calculateGameScore(stats: GameStats): number {
    const freeThrowMisses = stats.ft_attempted - stats.ft_made;
    
    return stats.points 
           + (0.4 * stats.fg_made)
           - (0.7 * stats.fg_attempted)
           - (0.4 * freeThrowMisses)
           + (0.7 * stats.orb)
           + (0.3 * stats.drb)
           + stats.steals
           + (0.7 * stats.assists)
           + (0.7 * stats.blocks)
           - (0.4 * stats.fouls)
           - stats.turnovers;
  }

  /**
   * Calculate Index of Success (IoS) - Euro-style index
   * IoS = PTS + ORB + DRB + AST + STL + BLK + fouls_drawn − ((FGA − FGM) + (FTA − FTM) + TO + blocks_received)
   */
  static calculateIndexOfSuccess(stats: GameStats): number {
    const fieldGoalMisses = stats.fg_attempted - stats.fg_made;
    const freeThrowMisses = stats.ft_attempted - stats.ft_made;
    
    const positiveActions = stats.points + stats.orb + stats.drb + stats.assists 
                           + stats.steals + stats.blocks + stats.fouls_drawn;
    
    const negativeActions = fieldGoalMisses + freeThrowMisses + stats.turnovers 
                           + stats.blocks_received;
    
    return positiveActions - negativeActions;
  }

  /**
   * Calculate shooting percentages with division by zero protection
   */
  static calculateShootingPercentages(stats: GameStats) {
    return {
      fieldGoalPercentage: stats.fg_attempted > 0 ? (stats.fg_made / stats.fg_attempted) * 100 : 0,
      threePointPercentage: stats.three_attempted > 0 ? (stats.three_made / stats.three_attempted) * 100 : 0,
      freeThrowPercentage: stats.ft_attempted > 0 ? (stats.ft_made / stats.ft_attempted) * 100 : 0,
      twoPointPercentage: this.getTwoPointAttempted(stats) > 0 ? (this.getTwoPointMade(stats) / this.getTwoPointAttempted(stats)) * 100 : 0,
    };
  }

  /**
   * Get derived two-point statistics
   */
  static getTwoPointMade(stats: GameStats): number {
    return stats.fg_made - stats.three_made;
  }

  static getTwoPointAttempted(stats: GameStats): number {
    return stats.fg_attempted - stats.three_attempted;
  }

  static getTotalRebounds(stats: GameStats): number {
    return stats.orb + stats.drb;
  }

  /**
   * Calculate all advanced metrics for a player
   */
  static calculateAdvancedMetrics(stats: GameStats, gamesPlayed: number = 1): AdvancedMetrics {
    const shootingPercentages = this.calculateShootingPercentages(stats);
    
    return {
      efficiency: this.calculateEfficiency(stats),
      gameScore: this.calculateGameScore(stats),
      indexOfSuccess: this.calculateIndexOfSuccess(stats),
      fieldGoalPercentage: shootingPercentages.fieldGoalPercentage,
      threePointPercentage: shootingPercentages.threePointPercentage,
      freeThrowPercentage: shootingPercentages.freeThrowPercentage,
      twoPointPercentage: shootingPercentages.twoPointPercentage,
      totalRebounds: this.getTotalRebounds(stats),
      twoPointMade: this.getTwoPointMade(stats),
      twoPointAttempted: this.getTwoPointAttempted(stats),
      minutesPerGame: stats.minutes_played / gamesPlayed,
      pointsPerGame: stats.points / gamesPlayed,
      reboundsPerGame: this.getTotalRebounds(stats) / gamesPlayed,
      assistsPerGame: stats.assists / gamesPlayed,
    };
  }

  /**
   * Calculate season averages from multiple games
   */
  static calculateSeasonAverages(allGameStats: GameStats[]): GameStats {
    if (allGameStats.length === 0) {
      return this.getEmptyStats('');
    }

    const gamesPlayed = allGameStats.length;
    const totals = allGameStats.reduce((acc, game) => {
      return {
        playerId: game.playerId,
        points: acc.points + game.points,
        fg_made: acc.fg_made + game.fg_made,
        fg_attempted: acc.fg_attempted + game.fg_attempted,
        three_made: acc.three_made + game.three_made,
        three_attempted: acc.three_attempted + game.three_attempted,
        ft_made: acc.ft_made + game.ft_made,
        ft_attempted: acc.ft_attempted + game.ft_attempted,
        orb: acc.orb + game.orb,
        drb: acc.drb + game.drb,
        assists: acc.assists + game.assists,
        steals: acc.steals + game.steals,
        blocks: acc.blocks + game.blocks,
        turnovers: acc.turnovers + game.turnovers,
        fouls: acc.fouls + game.fouls,
        tech_fouls: acc.tech_fouls + game.tech_fouls,
        unsportsmanlike_fouls: acc.unsportsmanlike_fouls + game.unsportsmanlike_fouls,
        fouls_drawn: acc.fouls_drawn + game.fouls_drawn,
        blocks_received: acc.blocks_received + game.blocks_received,
        plus_minus: acc.plus_minus + game.plus_minus,
        minutes_played: acc.minutes_played + game.minutes_played,
      };
    }, this.getEmptyStats(allGameStats[0].playerId));

    // Return averages per game
    return {
      ...totals,
      points: totals.points / gamesPlayed,
      fg_made: totals.fg_made / gamesPlayed,
      fg_attempted: totals.fg_attempted / gamesPlayed,
      three_made: totals.three_made / gamesPlayed,
      three_attempted: totals.three_attempted / gamesPlayed,
      ft_made: totals.ft_made / gamesPlayed,
      ft_attempted: totals.ft_attempted / gamesPlayed,
      orb: totals.orb / gamesPlayed,
      drb: totals.drb / gamesPlayed,
      assists: totals.assists / gamesPlayed,
      steals: totals.steals / gamesPlayed,
      blocks: totals.blocks / gamesPlayed,
      turnovers: totals.turnovers / gamesPlayed,
      fouls: totals.fouls / gamesPlayed,
      tech_fouls: totals.tech_fouls / gamesPlayed,
      unsportsmanlike_fouls: totals.unsportsmanlike_fouls / gamesPlayed,
      fouls_drawn: totals.fouls_drawn / gamesPlayed,
      blocks_received: totals.blocks_received / gamesPlayed,
      plus_minus: totals.plus_minus / gamesPlayed,
      minutes_played: totals.minutes_played / gamesPlayed,
    };
  }

  /**
   * Get empty stats template
   */
  static getEmptyStats(playerId: string): GameStats {
    return {
      playerId,
      points: 0,
      fg_made: 0,
      fg_attempted: 0,
      three_made: 0,
      three_attempted: 0,
      ft_made: 0,
      ft_attempted: 0,
      orb: 0,
      drb: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      tech_fouls: 0,
      unsportsmanlike_fouls: 0,
      fouls_drawn: 0,
      blocks_received: 0,
      plus_minus: 0,
      minutes_played: 0,
    };
  }
}