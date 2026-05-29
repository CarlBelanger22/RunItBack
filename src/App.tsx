import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// TypeScript declarations for requestIdleCallback (not in all type definitions)
declare global {
  interface Window {
    requestIdleCallback?: (callback: (deadline: IdleDeadline) => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  }
}

interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining(): number;
}
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { isSupabaseConfigured } from './lib/supabase';
import {
  deleteGamesFromSupabase,
  deletePlayersFromSupabase,
  deleteTeamsFromSupabase,
  loadAppDataFromSupabase,
  saveAppDataToSupabase,
} from './api/supabaseData';
import { PLAYER_MEASUREMENTS_MIGRATION_KEY } from './lib/playerMeasurements';
import { AppRoutes } from './routing/AppRoutes';
import { gamePath, liveGamePath, paths, playerPath, teamPath } from './routing/paths';
import {
  dedupeActiveGames,
  getActiveGame,
  isOrphanedIncompleteGame,
  resolveSetupPlayersToRemove,
  resolveTeamsToDeleteWithGame,
} from './utils/activeGame';
import { generateTeamAbbreviation } from './utils/teamAbbreviation';

import { Moon, Sun, Settings, BarChart3, Search } from 'lucide-react';

// Types for our basketball app
export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  secondaryPosition?: string; // Optional secondary position
  picture?: string;
  height: string; // cm (numeric string); profile shows ft/in + cm
  weight: string; // kg (numeric string); profile shows kg only
  age: number;
  dateOfBirth?: string; // ISO date string (YYYY-MM-DD)
}

export interface CreateTeamOptions {
  tournamentIds?: string[];
}

export interface Team {
  id: string;
  name: string;
  abbreviation: string; // 3–5 letter team abbreviation (uppercase)
  icon?: string;
  description?: string;
  players: Player[];
  currentTournamentId?: string;
}

export interface Tournament {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  year: number;
  month: string; // e.g., "Jul", "Aug"
  teams: string[]; // Team IDs
  games: string[]; // Game IDs associated with this tournament
  standings: TournamentStanding[];
}

export interface TournamentStanding {
  teamId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  gamesPlayed: number;
}

export interface GameStats {
  playerId: string;
  // Scoring & shooting
  points: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  // Rebounds (O/D separation mandatory)
  orb: number; // Offensive rebounds
  drb: number; // Defensive rebounds
  // Derived: rebounds = orb + drb
  // Playmaking & defense
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  // Fouls
  fouls: number; // Personal fouls
  tech_fouls: number; // Technical fouls
  unsportsmanlike_fouls: number; // Unsportsmanlike fouls
  fouls_drawn: number; // Fouls drawn by this player
  // Physical/balance
  blocks_received: number; // Times this player was blocked
  // On/off tracking
  plus_minus: number;
  minutes_played: number;
}

export interface Shot {
  id: string;
  playerId: string;
  x: number;
  y: number;
  made: boolean;
  isThree: boolean;
  timestamp: number;
  assistedBy?: string; // Player ID who assisted
  blockedBy?: string; // Player ID who blocked
  fouledOnShot?: boolean; // Was fouled on this shot (and-one scenario)
  isTransition?: boolean; // Fastbreak shot
  inPaint?: boolean; // Shot taken in the paint
  period: number;
  gameTime: string; // Game clock when shot was taken
}

// Team-level statistics for a game
export interface TeamStats {
  teamId: string;
  // Scoring by period
  q1_points: number;
  q2_points: number;
  q3_points: number;
  q4_points: number;
  ot_points: number;
  total_points: number;
  // Field Goals
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  two_made: number; // Derived: fg_made - three_made
  two_attempted: number; // Derived: fg_attempted - three_attempted
  ft_made: number;
  ft_attempted: number;
  // Rebounds
  orb: number;
  drb: number;
  team_rebounds: number; // When no individual is credited
  total_rebounds: number; // Derived: orb + drb + team_rebounds
  // Other stats
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  // Advanced team metrics (null = not recorded on source box score)
  points_off_turnovers: number | null;
  points_in_paint: number | null;
  second_chance_points: number | null;
  fastbreak_points: number | null;
  bench_points: number | null;
  biggest_lead: number | null;
  biggest_scoring_run: number | null;
}

// Event types for comprehensive tracking
export type EventType = 
  | 'shot_attempt'
  | 'free_throw' 
  | 'rebound'
  | 'turnover'
  | 'foul'
  | 'substitution'
  | 'violation'
  | 'technical_foul'
  | 'timeout';

export interface GameEvent {
  id: string;
  type: EventType;
  timestamp: number;
  period: number;
  gameTime: string; // mm:ss format
  teamId: string;
  playerId?: string; // Optional for team events
  details: Record<string, any>; // Event-specific data
  homeScore: number; // Score after this event
  awayScore: number; // Score after this event
}

export interface LineupStint {
  id: string;
  teamId: string;
  players: string[]; // Array of 5 player IDs
  startTime: number; // Timestamp
  endTime?: number; // Timestamp when stint ended
  startPeriod: number;
  startGameTime: string;
  endPeriod?: number;
  endGameTime?: string;
  plusMinus: number; // Score differential during this stint
}

export interface Game {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  homeTeamId: string; // For easier lookups
  awayTeamId: string; // For easier lookups
  tournamentId?: string; // Optional tournament association
  date: string;
  gameStats: GameStats[];
  teamStats: {
    home: TeamStats;
    away: TeamStats;
  };
  shots: Shot[];
  events: GameEvent[]; // Complete event log
  lineupStints: LineupStint[]; // For tracking minutes and plus/minus
  currentPeriod: number;
  currentGameTime: string;
  homeStarters: string[]; // Player IDs of starting 5
  awayStarters: string[]; // Player IDs of starting 5
  trackBothTeams: boolean; // Whether to track both teams individually
  isActive: boolean;
  isCompleted: boolean;
  finalScore?: {
    home: number;
    away: number;
  };
  /** Team IDs created via \"Create new team\" in game setup for this session. */
  setupCreatedTeamIds?: string[];
  /** Players added to existing teams during setup (removed if game is deleted). */
  setupRosterChanges?: SetupRosterChange[];
}

export interface SetupRosterChange {
  teamId: string;
  addedPlayerIds: string[];
}

// Utility function to generate realistic shot positions based on stats
const generateShotsForGame = (gameStats: GameStats[], gameId: string): Shot[] => {
  const shots: Shot[] = [];
  let shotIdCounter = 0;
  
  // Generate shots for each player based on their stats
  gameStats.forEach((playerStats) => {
    const playerId = playerStats.playerId;
    const twoMade = playerStats.fg_made - playerStats.three_made;
    const twoAttempted = playerStats.fg_attempted - playerStats.three_attempted;
    const twoMissed = twoAttempted - twoMade;
    const threeMissed = playerStats.three_attempted - playerStats.three_made;
    
    // Generate 2-point shots (inside the arc)
    // Court coordinates: 0-100 x, 0-100 y
    // Basket is at approximately x=50, y=8 (top of court in our coordinate system)
    
    // Made 2-pointers - distribute across paint, mid-range, and close shots
    for (let i = 0; i < twoMade; i++) {
      const shotType = Math.random();
      let x, y;
      
      if (shotType < 0.4) {
        // Paint/close range shots (40% of 2-pointers)
        x = 45 + Math.random() * 10; // 45-55
        y = 15 + Math.random() * 25; // 15-40 (close to basket)
      } else if (shotType < 0.7) {
        // Mid-range shots (30% of 2-pointers)
        const side = Math.random() < 0.5 ? -1 : 1;
        x = 50 + side * (10 + Math.random() * 15); // Left or right mid-range
        y = 30 + Math.random() * 25; // 30-55
      } else {
        // Elbow/high post shots (30% of 2-pointers)
        const side = Math.random() < 0.5 ? -1 : 1;
        x = 50 + side * (5 + Math.random() * 12); // Near the elbows
        y = 40 + Math.random() * 15; // 40-55
      }
      
      shots.push({
        id: `${gameId}-shot-${shotIdCounter++}`,
        playerId,
        x: Math.max(10, Math.min(90, x)),
        y: Math.max(8, Math.min(95, y)),
        made: true,
        isThree: false,
        timestamp: Date.now() + i,
        period: Math.floor(Math.random() * 4) + 1,
        gameTime: `${Math.floor(Math.random() * 12)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
      });
    }
    
    // Missed 2-pointers
    for (let i = 0; i < twoMissed; i++) {
      const shotType = Math.random();
      let x, y;
      
      if (shotType < 0.35) {
        x = 45 + Math.random() * 10;
        y = 15 + Math.random() * 25;
      } else if (shotType < 0.7) {
        const side = Math.random() < 0.5 ? -1 : 1;
        x = 50 + side * (10 + Math.random() * 15);
        y = 30 + Math.random() * 25;
      } else {
        const side = Math.random() < 0.5 ? -1 : 1;
        x = 50 + side * (5 + Math.random() * 12);
        y = 40 + Math.random() * 15;
      }
      
      shots.push({
        id: `${gameId}-shot-${shotIdCounter++}`,
        playerId,
        x: Math.max(10, Math.min(90, x)),
        y: Math.max(8, Math.min(95, y)),
        made: false,
        isThree: false,
        timestamp: Date.now() + i + 1000,
        period: Math.floor(Math.random() * 4) + 1,
        gameTime: `${Math.floor(Math.random() * 12)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
      });
    }
    
    // Generate 3-point shots (outside the arc)
    // Made 3-pointers - distribute across corner, wing, and top of key
    for (let i = 0; i < playerStats.three_made; i++) {
      const shotType = Math.random();
      let x, y;
      
      if (shotType < 0.25) {
        // Left corner 3
        x = 15 + Math.random() * 8; // 15-23
        y = 20 + Math.random() * 20; // 20-40
      } else if (shotType < 0.5) {
        // Right corner 3
        x = 77 + Math.random() * 8; // 77-85
        y = 20 + Math.random() * 20; // 20-40
      } else if (shotType < 0.75) {
        // Wing 3s
        const side = Math.random() < 0.5 ? -1 : 1;
        x = 50 + side * (20 + Math.random() * 10); // 20-30 from center
        y = 35 + Math.random() * 15; // 35-50
      } else {
        // Top of key 3
        x = 40 + Math.random() * 20; // 40-60
        y = 50 + Math.random() * 15; // 50-65
      }
      
      shots.push({
        id: `${gameId}-shot-${shotIdCounter++}`,
        playerId,
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(8, Math.min(95, y)),
        made: true,
        isThree: true,
        timestamp: Date.now() + i + 2000,
        period: Math.floor(Math.random() * 4) + 1,
        gameTime: `${Math.floor(Math.random() * 12)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
      });
    }
    
    // Missed 3-pointers
    for (let i = 0; i < threeMissed; i++) {
      const shotType = Math.random();
      let x, y;
      
      if (shotType < 0.25) {
        x = 15 + Math.random() * 8;
        y = 20 + Math.random() * 20;
      } else if (shotType < 0.5) {
        x = 77 + Math.random() * 8;
        y = 20 + Math.random() * 20;
      } else if (shotType < 0.75) {
        const side = Math.random() < 0.5 ? -1 : 1;
        x = 50 + side * (20 + Math.random() * 10);
        y = 35 + Math.random() * 15;
      } else {
        x = 40 + Math.random() * 20;
        y = 50 + Math.random() * 15;
      }
      
      shots.push({
        id: `${gameId}-shot-${shotIdCounter++}`,
        playerId,
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(8, Math.min(95, y)),
        made: false,
        isThree: true,
        timestamp: Date.now() + i + 3000,
        period: Math.floor(Math.random() * 4) + 1,
        gameTime: `${Math.floor(Math.random() * 12)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
      });
    }
  });
  
  // Shuffle shots to make them look more realistic (not grouped by player)
  return shots.sort(() => Math.random() - 0.5);
};

// Seed data for demonstration
const createSeedData = () => {
  // Create 4 teams with players
  const teams: Team[] = [
    {
      id: 'team-thunderbolts',
      name: 'Thunder Bolts',
      abbreviation: 'TBL',
      icon: '⚡',
      description: 'Fast-paced offensive team',
      players: [
        { id: 'player-1', name: 'Marcus Johnson', number: 23, position: 'PG', height: '6\'1\'\' (1.85m)', weight: '175 lbs (79 kg)', age: 24 },
        { id: 'player-2', name: 'Tyler Davis', number: 12, position: 'SG', height: '6\'3\'\' (1.91m)', weight: '185 lbs (84 kg)', age: 22 },
        { id: 'player-3', name: 'Jordan Williams', number: 33, position: 'SF', height: '6\'7\'\' (2.01m)', weight: '210 lbs (95 kg)', age: 26 },
        { id: 'player-4', name: 'Alex Thompson', number: 4, position: 'PF', height: '6\'9\'\' (2.06m)', weight: '225 lbs (102 kg)', age: 25 },
        { id: 'player-5', name: 'DeAndre Wilson', number: 55, position: 'C', height: '6\'11\'\' (2.11m)', weight: '245 lbs (111 kg)', age: 27 },
        { id: 'player-6', name: 'Chris Martinez', number: 7, position: 'SG', height: '6\'2\'\' (1.88m)', weight: '180 lbs (82 kg)', age: 23 },
        { id: 'player-7', name: 'Brandon Lee', number: 21, position: 'SF', height: '6\'6\'\' (1.98m)', weight: '205 lbs (93 kg)', age: 24 },
        { id: 'player-8', name: 'Kevin Brown', number: 14, position: 'PF', height: '6\'8\'\' (2.03m)', weight: '220 lbs (100 kg)', age: 26 }
      ],
      currentTournamentId: 'tournament-summer-2024'
    },
    {
      id: 'team-eagles',
      name: 'Soaring Eagles',
      abbreviation: 'EAG',
      icon: '🦅',
      description: 'Defensive powerhouse',
      players: [
        { id: 'player-9', name: 'James Robinson', number: 1, position: 'PG', height: '5\'11\'\' (1.80m)', weight: '170 lbs (77 kg)', age: 25 },
        { id: 'player-10', name: 'Michael Garcia', number: 24, position: 'SG', height: '6\'4\'\' (1.93m)', weight: '190 lbs (86 kg)', age: 23 },
        { id: 'player-11', name: 'David Miller', number: 32, position: 'SF', height: '6\'8\'\' (2.03m)', weight: '215 lbs (98 kg)', age: 28 },
        { id: 'player-12', name: 'Anthony Moore', number: 15, position: 'PF', height: '6\'10\'\' (2.08m)', weight: '235 lbs (107 kg)', age: 26 },
        { id: 'player-13', name: 'Carlos Jackson', number: 44, position: 'C', height: '7\'0\'\' (2.13m)', weight: '250 lbs (113 kg)', age: 29 },
        { id: 'player-14', name: 'Ryan Taylor', number: 8, position: 'PG', height: '6\'0\'\' (1.83m)', weight: '172 lbs (78 kg)', age: 21 },
        { id: 'player-15', name: 'Justin Clark', number: 11, position: 'SG', height: '6\'5\'\' (1.96m)', weight: '195 lbs (88 kg)', age: 24 },
        { id: 'player-16', name: 'Eric White', number: 3, position: 'SF', height: '6\'7\'\' (2.01m)', weight: '200 lbs (91 kg)', age: 22 }
      ],
      currentTournamentId: 'tournament-summer-2024'
    },
    {
      id: 'team-warriors',
      name: 'City Warriors',
      abbreviation: 'WAR',
      icon: '⚔️',
      description: 'Balanced team with veteran leadership',
      players: [
        { id: 'player-17', name: 'Stephen Adams', number: 30, position: 'PG', height: '6\'2\'\' (1.88m)', weight: '185 lbs (84 kg)', age: 30 },
        { id: 'player-18', name: 'Damian Lewis', number: 0, position: 'SG', height: '6\'3\'\' (1.91m)', weight: '188 lbs (85 kg)', age: 29 },
        { id: 'player-19', name: 'LeBron Anderson', number: 6, position: 'SF', height: '6\'9\'\' (2.06m)', weight: '250 lbs (113 kg)', age: 32 },
        { id: 'player-20', name: 'Blake Griffin Jr', number: 22, position: 'PF', height: '6\'10\'\' (2.08m)', weight: '240 lbs (109 kg)', age: 31 },
        { id: 'player-21', name: 'Dwight Howard II', number: 12, position: 'C', height: '6\'10\'\' (2.08m)', weight: '265 lbs (120 kg)', age: 33 },
        { id: 'player-22', name: 'Isaiah Thomas', number: 4, position: 'PG', height: '5\'9\'\' (1.75m)', weight: '165 lbs (75 kg)', age: 28 },
        { id: 'player-23', name: 'Klay Thompson Jr', number: 11, position: 'SG', height: '6\'6\'\' (1.98m)', weight: '215 lbs (98 kg)', age: 30 },
        { id: 'player-24', name: 'Paul George', number: 13, position: 'SF', height: '6\'8\'\' (2.03m)', weight: '220 lbs (100 kg)', age: 29 }
      ],
      currentTournamentId: 'tournament-summer-2024'
    },
    {
      id: 'team-phoenixes',
      name: 'Rising Phoenix',
      abbreviation: 'PHX',
      icon: '🔥',
      description: 'Young and explosive',
      players: [
        { id: 'player-25', name: 'Ja Morant Jr', number: 12, position: 'PG', height: '6\'3\'\' (1.91m)', weight: '174 lbs (79 kg)', age: 21 },
        { id: 'player-26', name: 'Donovan Mitchell II', number: 45, position: 'SG', height: '6\'1\'\' (1.85m)', weight: '215 lbs (98 kg)', age: 22 },
        { id: 'player-27', name: 'Jayson Tatum Jr', number: 0, position: 'SF', height: '6\'8\'\' (2.03m)', weight: '210 lbs (95 kg)', age: 20 },
        { id: 'player-28', name: 'Zion Williamson II', number: 1, position: 'PF', height: '6\'6\'\' (1.98m)', weight: '285 lbs (129 kg)', age: 21 },
        { id: 'player-29', name: 'Victor Wembanyama Jr', number: 1, position: 'C', height: '7\'4\'\' (2.24m)', weight: '230 lbs (104 kg)', age: 19 },
        { id: 'player-30', name: 'Tyrese Haliburton', number: 0, position: 'PG', height: '6\'5\'\' (1.96m)', weight: '185 lbs (84 kg)', age: 20 },
        { id: 'player-31', name: 'Anthony Edwards Jr', number: 5, position: 'SG', height: '6\'4\'\' (1.93m)', weight: '225 lbs (102 kg)', age: 19 },
        { id: 'player-32', name: 'Paolo Banchero', number: 5, position: 'PF', height: '6\'10\'\' (2.08m)', weight: '250 lbs (113 kg)', age: 18 }
      ],
      currentTournamentId: 'tournament-summer-2024'
    }
  ];

  // Create tournament
  const tournament: Tournament = {
    id: 'tournament-summer-2024',
    name: 'Summer League 2024',
    icon: '🏆',
    description: 'Annual summer basketball tournament',
    year: 2024,
    month: 'Jul',
    teams: teams.map(t => t.id),
    games: [],
    standings: [
      { teamId: 'team-thunderbolts', wins: 2, losses: 1, pointsFor: 245, pointsAgainst: 230, gamesPlayed: 3 },
      { teamId: 'team-eagles', wins: 2, losses: 1, pointsFor: 235, pointsAgainst: 225, gamesPlayed: 3 },
      { teamId: 'team-warriors', wins: 1, losses: 2, pointsFor: 220, pointsAgainst: 240, gamesPlayed: 3 },
      { teamId: 'team-phoenixes', wins: 1, losses: 2, pointsFor: 215, pointsAgainst: 220, gamesPlayed: 3 }
    ]
  };

  // Create 6 games with realistic stats
  const games: Game[] = [
    // Game 1: Thunder Bolts vs Soaring Eagles (85-78)
    {
      id: 'game-1',
      homeTeam: teams[0], // Thunder Bolts
      awayTeam: teams[1], // Soaring Eagles
      homeTeamId: 'team-thunderbolts',
      awayTeamId: 'team-eagles',
      tournamentId: 'tournament-summer-2024',
      date: '2024-07-15',
      currentPeriod: 4,
      currentGameTime: '00:00',
      homeStarters: ['player-1', 'player-2', 'player-3', 'player-4', 'player-5'],
      awayStarters: ['player-9', 'player-10', 'player-11', 'player-12', 'player-13'],
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: 85, away: 78 },
      gameStats: [
        // Thunder Bolts stats
        { playerId: 'player-1', points: 18, fg_made: 7, fg_attempted: 15, three_made: 2, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 1, drb: 4, assists: 8, steals: 3, blocks: 0, turnovers: 4, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 0, plus_minus: 7, minutes_played: 32 },
        { playerId: 'player-2', points: 22, fg_made: 9, fg_attempted: 18, three_made: 4, three_attempted: 8, ft_made: 0, ft_attempted: 0, orb: 0, drb: 3, assists: 2, steals: 1, blocks: 0, turnovers: 2, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 1, plus_minus: 5, minutes_played: 28 },
        { playerId: 'player-3', points: 15, fg_made: 6, fg_attempted: 12, three_made: 1, three_attempted: 3, ft_made: 2, ft_attempted: 4, orb: 2, drb: 6, assists: 4, steals: 1, blocks: 1, turnovers: 3, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 0, plus_minus: 4, minutes_played: 30 },
        { playerId: 'player-4', points: 12, fg_made: 5, fg_attempted: 8, three_made: 0, three_attempted: 1, ft_made: 2, ft_attempted: 2, orb: 3, drb: 8, assists: 1, steals: 0, blocks: 2, turnovers: 1, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 6, minutes_played: 25 },
        { playerId: 'player-5', points: 18, fg_made: 8, fg_attempted: 12, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 4, orb: 4, drb: 9, assists: 1, steals: 0, blocks: 3, turnovers: 2, fouls: 5, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 5, blocks_received: 0, plus_minus: 8, minutes_played: 30 },
        // Eagles stats
        { playerId: 'player-9', points: 16, fg_made: 6, fg_attempted: 14, three_made: 2, three_attempted: 5, ft_made: 2, ft_attempted: 2, orb: 0, drb: 3, assists: 6, steals: 2, blocks: 0, turnovers: 5, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -5, minutes_played: 30 },
        { playerId: 'player-10', points: 20, fg_made: 8, fg_attempted: 16, three_made: 2, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 1, drb: 4, assists: 3, steals: 1, blocks: 0, turnovers: 3, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 0, plus_minus: -3, minutes_played: 32 },
        { playerId: 'player-11', points: 14, fg_made: 5, fg_attempted: 11, three_made: 2, three_attempted: 4, ft_made: 2, ft_attempted: 2, orb: 1, drb: 5, assists: 2, steals: 2, blocks: 1, turnovers: 2, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 1, plus_minus: -4, minutes_played: 28 },
        { playerId: 'player-12', points: 10, fg_made: 4, fg_attempted: 9, three_made: 0, three_attempted: 1, ft_made: 2, ft_attempted: 4, orb: 2, drb: 7, assists: 1, steals: 1, blocks: 1, turnovers: 1, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 2, plus_minus: -6, minutes_played: 24 },
        { playerId: 'player-13', points: 18, fg_made: 7, fg_attempted: 13, three_made: 0, three_attempted: 0, ft_made: 4, ft_attempted: 6, orb: 3, drb: 8, assists: 0, steals: 0, blocks: 2, turnovers: 3, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 3, plus_minus: -7, minutes_played: 28 }
      ],
      teamStats: {
        home: {
          teamId: 'team-thunderbolts',
          q1_points: 22, q2_points: 19, q3_points: 23, q4_points: 21, ot_points: 0, total_points: 85,
          fg_made: 35, fg_attempted: 65, three_made: 7, three_attempted: 18, two_made: 28, two_attempted: 47,
          ft_made: 8, ft_attempted: 12, orb: 10, drb: 30, team_rebounds: 2, total_rebounds: 42,
          assists: 16, steals: 5, blocks: 6, turnovers: 12, fouls: 17,
          points_off_turnovers: 18, points_in_paint: 42, second_chance_points: 12, fastbreak_points: 8, bench_points: 15,
          biggest_lead: 12, biggest_scoring_run: 8
        },
        away: {
          teamId: 'team-eagles',
          q1_points: 18, q2_points: 20, q3_points: 19, q4_points: 21, ot_points: 0, total_points: 78,
          fg_made: 30, fg_attempted: 63, three_made: 6, three_attempted: 16, two_made: 24, two_attempted: 47,
          ft_made: 12, ft_attempted: 16, orb: 7, drb: 27, team_rebounds: 3, total_rebounds: 37,
          assists: 12, steals: 6, blocks: 4, turnovers: 14, fouls: 17,
          points_off_turnovers: 15, points_in_paint: 38, second_chance_points: 8, fastbreak_points: 6, bench_points: 12,
          biggest_lead: 5, biggest_scoring_run: 6
        }
      },
      shots: [
        { id: 'shot-1', playerId: 'player-1', x: 45, y: 25, made: true, isThree: true, timestamp: Date.now() - 7200000, period: 1, gameTime: '10:30' },
        { id: 'shot-2', playerId: 'player-2', x: 35, y: 15, made: true, isThree: true, timestamp: Date.now() - 7100000, period: 1, gameTime: '09:45' },
        { id: 'shot-3', playerId: 'player-5', x: 50, y: 85, made: true, isThree: false, timestamp: Date.now() - 7000000, period: 1, gameTime: '08:20', inPaint: true }
      ],
      events: [],
      lineupStints: []
    },

    // Game 2: City Warriors vs Rising Phoenix (72-68)
    {
      id: 'game-2',
      homeTeam: teams[2], // City Warriors
      awayTeam: teams[3], // Rising Phoenix
      homeTeamId: 'team-warriors',
      awayTeamId: 'team-phoenixes',
      tournamentId: 'tournament-summer-2024',
      date: '2024-07-16',
      currentPeriod: 4,
      currentGameTime: '00:00',
      homeStarters: ['player-17', 'player-18', 'player-19', 'player-20', 'player-21'],
      awayStarters: ['player-25', 'player-26', 'player-27', 'player-28', 'player-29'],
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: 72, away: 68 },
      gameStats: [
        // Warriors stats
        { playerId: 'player-17', points: 15, fg_made: 6, fg_attempted: 13, three_made: 1, three_attempted: 4, ft_made: 2, ft_attempted: 2, orb: 1, drb: 5, assists: 7, steals: 2, blocks: 0, turnovers: 3, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 3, minutes_played: 35 },
        { playerId: 'player-18', points: 18, fg_made: 7, fg_attempted: 14, three_made: 3, three_attempted: 7, ft_made: 1, ft_attempted: 2, orb: 0, drb: 3, assists: 4, steals: 1, blocks: 0, turnovers: 2, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 0, plus_minus: 5, minutes_played: 32 },
        { playerId: 'player-19', points: 16, fg_made: 6, fg_attempted: 12, three_made: 2, three_attempted: 5, ft_made: 2, ft_attempted: 2, orb: 2, drb: 7, assists: 3, steals: 1, blocks: 1, turnovers: 4, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 1, plus_minus: 2, minutes_played: 30 },
        { playerId: 'player-20', points: 11, fg_made: 4, fg_attempted: 8, three_made: 1, three_attempted: 2, ft_made: 2, ft_attempted: 3, orb: 3, drb: 8, assists: 2, steals: 0, blocks: 1, turnovers: 1, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 0, plus_minus: 4, minutes_played: 28 },
        { playerId: 'player-21', points: 12, fg_made: 5, fg_attempted: 10, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 4, orb: 4, drb: 9, assists: 1, steals: 0, blocks: 2, turnovers: 2, fouls: 5, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 1, plus_minus: 1, minutes_played: 25 },
        // Phoenix stats
        { playerId: 'player-25', points: 20, fg_made: 8, fg_attempted: 16, three_made: 2, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 1, drb: 4, assists: 6, steals: 3, blocks: 0, turnovers: 4, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -2, minutes_played: 33 },
        { playerId: 'player-26', points: 16, fg_made: 6, fg_attempted: 15, three_made: 2, three_attempted: 8, ft_made: 2, ft_attempted: 2, orb: 0, drb: 3, assists: 2, steals: 1, blocks: 0, turnovers: 3, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -4, minutes_played: 30 },
        { playerId: 'player-27', points: 14, fg_made: 5, fg_attempted: 11, three_made: 2, three_attempted: 5, ft_made: 2, ft_attempted: 2, orb: 1, drb: 6, assists: 3, steals: 1, blocks: 0, turnovers: 2, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 1, plus_minus: -3, minutes_played: 29 },
        { playerId: 'player-28', points: 10, fg_made: 4, fg_attempted: 9, three_made: 0, three_attempted: 1, ft_made: 2, ft_attempted: 4, orb: 2, drb: 7, assists: 1, steals: 0, blocks: 1, turnovers: 3, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 1, plus_minus: -5, minutes_played: 26 },
        { playerId: 'player-29', points: 8, fg_made: 3, fg_attempted: 8, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 4, orb: 3, drb: 8, assists: 0, steals: 1, blocks: 3, turnovers: 2, fouls: 5, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 2, plus_minus: -6, minutes_played: 24 }
      ],
      teamStats: {
        home: {
          teamId: 'team-warriors',
          q1_points: 16, q2_points: 18, q3_points: 20, q4_points: 18, ot_points: 0, total_points: 72,
          fg_made: 28, fg_attempted: 57, three_made: 7, three_attempted: 18, two_made: 21, two_attempted: 39,
          ft_made: 9, ft_attempted: 13, orb: 10, drb: 32, team_rebounds: 2, total_rebounds: 44,
          assists: 17, steals: 4, blocks: 4, turnovers: 12, fouls: 17,
          points_off_turnovers: 16, points_in_paint: 34, second_chance_points: 14, fastbreak_points: 6, bench_points: 8,
          biggest_lead: 8, biggest_scoring_run: 7
        },
        away: {
          teamId: 'team-phoenixes',
          q1_points: 15, q2_points: 17, q3_points: 18, q4_points: 18, ot_points: 0, total_points: 68,
          fg_made: 26, fg_attempted: 59, three_made: 6, three_attempted: 20, two_made: 20, two_attempted: 39,
          ft_made: 10, ft_attempted: 14, orb: 7, drb: 28, team_rebounds: 1, total_rebounds: 36,
          assists: 12, steals: 6, blocks: 4, turnovers: 14, fouls: 17,
          points_off_turnovers: 14, points_in_paint: 30, second_chance_points: 10, fastbreak_points: 8, bench_points: 6,
          biggest_lead: 5, biggest_scoring_run: 6
        }
      },
      shots: [],
      events: [],
      lineupStints: []
    },

    // Game 3: Thunder Bolts vs City Warriors (88-75)
    {
      id: 'game-3',
      homeTeam: teams[0], // Thunder Bolts
      awayTeam: teams[2], // City Warriors
      homeTeamId: 'team-thunderbolts',
      awayTeamId: 'team-warriors',
      tournamentId: 'tournament-summer-2024',
      date: '2024-07-17',
      currentPeriod: 4,
      currentGameTime: '00:00',
      homeStarters: ['player-1', 'player-2', 'player-3', 'player-4', 'player-5'],
      awayStarters: ['player-17', 'player-18', 'player-19', 'player-20', 'player-21'],
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: 88, away: 75 },
      gameStats: [
        // Thunder Bolts stats (higher scoring game)
        { playerId: 'player-1', points: 24, fg_made: 9, fg_attempted: 16, three_made: 3, three_attempted: 7, ft_made: 3, ft_attempted: 4, orb: 1, drb: 5, assists: 9, steals: 2, blocks: 0, turnovers: 3, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 0, plus_minus: 12, minutes_played: 34 },
        { playerId: 'player-2', points: 19, fg_made: 7, fg_attempted: 14, three_made: 3, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 0, drb: 4, assists: 3, steals: 1, blocks: 0, turnovers: 2, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 10, minutes_played: 30 },
        { playerId: 'player-3', points: 17, fg_made: 7, fg_attempted: 13, three_made: 1, three_attempted: 4, ft_made: 2, ft_attempted: 2, orb: 2, drb: 7, assists: 4, steals: 2, blocks: 1, turnovers: 1, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 11, minutes_played: 32 },
        { playerId: 'player-4', points: 14, fg_made: 6, fg_attempted: 10, three_made: 0, three_attempted: 1, ft_made: 2, ft_attempted: 2, orb: 4, drb: 9, assists: 2, steals: 1, blocks: 2, turnovers: 2, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 13, minutes_played: 28 },
        { playerId: 'player-5', points: 14, fg_made: 6, fg_attempted: 11, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 4, orb: 3, drb: 8, assists: 1, steals: 0, blocks: 3, turnovers: 3, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 1, plus_minus: 15, minutes_played: 26 },
        // Warriors stats (losing game)
        { playerId: 'player-17', points: 18, fg_made: 7, fg_attempted: 15, three_made: 2, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 1, drb: 4, assists: 5, steals: 1, blocks: 0, turnovers: 5, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -10, minutes_played: 32 },
        { playerId: 'player-18', points: 16, fg_made: 6, fg_attempted: 13, three_made: 2, three_attempted: 5, ft_made: 2, ft_attempted: 2, orb: 0, drb: 3, assists: 2, steals: 1, blocks: 0, turnovers: 3, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -12, minutes_played: 29 },
        { playerId: 'player-19', points: 15, fg_made: 5, fg_attempted: 12, three_made: 3, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 1, drb: 5, assists: 3, steals: 0, blocks: 0, turnovers: 3, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 1, plus_minus: -13, minutes_played: 28 },
        { playerId: 'player-20', points: 12, fg_made: 5, fg_attempted: 9, three_made: 0, three_attempted: 2, ft_made: 2, ft_attempted: 2, orb: 2, drb: 6, assists: 1, steals: 1, blocks: 1, turnovers: 2, fouls: 5, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 2, plus_minus: -11, minutes_played: 25 },
        { playerId: 'player-21', points: 14, fg_made: 6, fg_attempted: 12, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 4, orb: 3, drb: 7, assists: 0, steals: 0, blocks: 1, turnovers: 4, fouls: 5, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 3, plus_minus: -14, minutes_played: 24 }
      ],
      teamStats: {
        home: {
          teamId: 'team-thunderbolts',
          q1_points: 24, q2_points: 22, q3_points: 21, q4_points: 21, ot_points: 0, total_points: 88,
          fg_made: 35, fg_attempted: 64, three_made: 7, three_attempted: 18, two_made: 28, two_attempted: 46,
          ft_made: 11, ft_attempted: 14, orb: 10, drb: 33, team_rebounds: 2, total_rebounds: 45,
          assists: 19, steals: 6, blocks: 6, turnovers: 11, fouls: 16,
          points_off_turnovers: 20, points_in_paint: 44, second_chance_points: 16, fastbreak_points: 12, bench_points: 12,
          biggest_lead: 16, biggest_scoring_run: 10
        },
        away: {
          teamId: 'team-warriors',
          q1_points: 18, q2_points: 19, q3_points: 17, q4_points: 21, ot_points: 0, total_points: 75,
          fg_made: 29, fg_attempted: 61, three_made: 7, three_attempted: 19, two_made: 22, two_attempted: 42,
          ft_made: 10, ft_attempted: 12, orb: 7, drb: 25, team_rebounds: 1, total_rebounds: 33,
          assists: 11, steals: 3, blocks: 2, turnovers: 17, fouls: 19,
          points_off_turnovers: 12, points_in_paint: 32, second_chance_points: 8, fastbreak_points: 4, bench_points: 10,
          biggest_lead: 2, biggest_scoring_run: 5
        }
      },
      shots: [],
      events: [],
      lineupStints: []
    },

    // Game 4: Soaring Eagles vs Rising Phoenix (82-74)
    {
      id: 'game-4',
      homeTeam: teams[1], // Soaring Eagles
      awayTeam: teams[3], // Rising Phoenix
      homeTeamId: 'team-eagles',
      awayTeamId: 'team-phoenixes',
      tournamentId: 'tournament-summer-2024',
      date: '2024-07-18',
      currentPeriod: 4,
      currentGameTime: '00:00',
      homeStarters: ['player-9', 'player-10', 'player-11', 'player-12', 'player-13'],
      awayStarters: ['player-25', 'player-26', 'player-27', 'player-28', 'player-29'],
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: 82, away: 74 },
      gameStats: [
        // Eagles stats (winning)
        { playerId: 'player-9', points: 19, fg_made: 7, fg_attempted: 14, three_made: 3, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 1, drb: 5, assists: 8, steals: 2, blocks: 0, turnovers: 3, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 0, plus_minus: 8, minutes_played: 33 },
        { playerId: 'player-10', points: 21, fg_made: 8, fg_attempted: 15, three_made: 3, three_attempted: 7, ft_made: 2, ft_attempted: 2, orb: 1, drb: 4, assists: 3, steals: 1, blocks: 0, turnovers: 2, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 9, minutes_played: 31 },
        { playerId: 'player-11', points: 16, fg_made: 6, fg_attempted: 12, three_made: 2, three_attempted: 5, ft_made: 2, ft_attempted: 2, orb: 2, drb: 6, assists: 4, steals: 3, blocks: 1, turnovers: 1, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 7, minutes_played: 29 },
        { playerId: 'player-12', points: 12, fg_made: 5, fg_attempted: 9, three_made: 0, three_attempted: 1, ft_made: 2, ft_attempted: 4, orb: 3, drb: 8, assists: 2, steals: 1, blocks: 2, turnovers: 2, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 1, plus_minus: 6, minutes_played: 26 },
        { playerId: 'player-13', points: 14, fg_made: 6, fg_attempted: 11, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 3, orb: 4, drb: 9, assists: 1, steals: 0, blocks: 3, turnovers: 3, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 2, plus_minus: 10, minutes_played: 27 },
        // Phoenix stats (losing)
        { playerId: 'player-25', points: 22, fg_made: 8, fg_attempted: 17, three_made: 4, three_attempted: 8, ft_made: 2, ft_attempted: 2, orb: 1, drb: 3, assists: 5, steals: 2, blocks: 0, turnovers: 5, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -6, minutes_played: 34 },
        { playerId: 'player-26', points: 18, fg_made: 7, fg_attempted: 16, three_made: 2, three_attempted: 7, ft_made: 2, ft_attempted: 2, orb: 0, drb: 4, assists: 2, steals: 1, blocks: 0, turnovers: 3, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -8, minutes_played: 30 },
        { playerId: 'player-27', points: 15, fg_made: 6, fg_attempted: 13, three_made: 1, three_attempted: 4, ft_made: 2, ft_attempted: 2, orb: 1, drb: 5, assists: 3, steals: 1, blocks: 0, turnovers: 2, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 1, plus_minus: -7, minutes_played: 28 },
        { playerId: 'player-28', points: 10, fg_made: 4, fg_attempted: 8, three_made: 0, three_attempted: 1, ft_made: 2, ft_attempted: 4, orb: 2, drb: 6, assists: 1, steals: 0, blocks: 1, turnovers: 3, fouls: 5, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 2, plus_minus: -9, minutes_played: 24 },
        { playerId: 'player-29', points: 9, fg_made: 4, fg_attempted: 9, three_made: 0, three_attempted: 0, ft_made: 1, ft_attempted: 2, orb: 3, drb: 7, assists: 0, steals: 1, blocks: 2, turnovers: 2, fouls: 5, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 3, plus_minus: -10, minutes_played: 22 }
      ],
      teamStats: {
        home: {
          teamId: 'team-eagles',
          q1_points: 20, q2_points: 21, q3_points: 20, q4_points: 21, ot_points: 0, total_points: 82,
          fg_made: 32, fg_attempted: 61, three_made: 8, three_attempted: 19, two_made: 24, two_attempted: 42,
          ft_made: 10, ft_attempted: 13, orb: 11, drb: 32, team_rebounds: 2, total_rebounds: 45,
          assists: 18, steals: 7, blocks: 6, turnovers: 11, fouls: 16,
          points_off_turnovers: 18, points_in_paint: 40, second_chance_points: 14, fastbreak_points: 10, bench_points: 14,
          biggest_lead: 12, biggest_scoring_run: 8
        },
        away: {
          teamId: 'team-phoenixes',
          q1_points: 18, q2_points: 19, q3_points: 18, q4_points: 19, ot_points: 0, total_points: 74,
          fg_made: 29, fg_attempted: 63, three_made: 7, three_attempted: 20, two_made: 22, two_attempted: 43,
          ft_made: 9, ft_attempted: 12, orb: 7, drb: 25, team_rebounds: 1, total_rebounds: 33,
          assists: 11, steals: 5, blocks: 3, turnovers: 15, fouls: 18,
          points_off_turnovers: 14, points_in_paint: 32, second_chance_points: 8, fastbreak_points: 8, bench_points: 8,
          biggest_lead: 4, biggest_scoring_run: 6
        }
      },
      shots: [],
      events: [],
      lineupStints: []
    },

    // Game 5: Thunder Bolts vs Rising Phoenix (72-73) - Close loss for Thunder
    {
      id: 'game-5',
      homeTeam: teams[0], // Thunder Bolts
      awayTeam: teams[3], // Rising Phoenix
      homeTeamId: 'team-thunderbolts',
      awayTeamId: 'team-phoenixes',
      tournamentId: 'tournament-summer-2024',
      date: '2024-07-19',
      currentPeriod: 4,
      currentGameTime: '00:00',
      homeStarters: ['player-1', 'player-2', 'player-3', 'player-4', 'player-5'],
      awayStarters: ['player-25', 'player-26', 'player-27', 'player-28', 'player-29'],
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: 72, away: 73 },
      gameStats: [
        // Thunder Bolts stats (narrow loss)
        { playerId: 'player-1', points: 16, fg_made: 6, fg_attempted: 14, three_made: 2, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 1, drb: 4, assists: 6, steals: 2, blocks: 0, turnovers: 4, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -1, minutes_played: 32 },
        { playerId: 'player-2', points: 18, fg_made: 7, fg_attempted: 15, three_made: 2, three_attempted: 7, ft_made: 2, ft_attempted: 2, orb: 0, drb: 3, assists: 3, steals: 1, blocks: 0, turnovers: 3, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 0, minutes_played: 30 },
        { playerId: 'player-3', points: 14, fg_made: 5, fg_attempted: 11, three_made: 2, three_attempted: 4, ft_made: 2, ft_attempted: 2, orb: 1, drb: 5, assists: 4, steals: 1, blocks: 1, turnovers: 2, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -2, minutes_played: 29 },
        { playerId: 'player-4', points: 12, fg_made: 5, fg_attempted: 9, three_made: 0, three_attempted: 1, ft_made: 2, ft_attempted: 3, orb: 2, drb: 7, assists: 1, steals: 0, blocks: 1, turnovers: 1, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 1, plus_minus: -1, minutes_played: 26 },
        { playerId: 'player-5', points: 12, fg_made: 5, fg_attempted: 10, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 4, orb: 3, drb: 8, assists: 1, steals: 0, blocks: 2, turnovers: 2, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 1, plus_minus: -1, minutes_played: 25 },
        // Phoenix stats (narrow win)
        { playerId: 'player-25', points: 21, fg_made: 8, fg_attempted: 16, three_made: 3, three_attempted: 7, ft_made: 2, ft_attempted: 2, orb: 1, drb: 4, assists: 7, steals: 2, blocks: 0, turnovers: 3, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 0, plus_minus: 2, minutes_played: 33 },
        { playerId: 'player-26', points: 17, fg_made: 6, fg_attempted: 14, three_made: 3, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 0, drb: 3, assists: 2, steals: 1, blocks: 0, turnovers: 2, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 1, minutes_played: 29 },
        { playerId: 'player-27', points: 16, fg_made: 6, fg_attempted: 12, three_made: 2, three_attempted: 4, ft_made: 2, ft_attempted: 2, orb: 2, drb: 6, assists: 3, steals: 1, blocks: 0, turnovers: 1, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 1, plus_minus: 2, minutes_played: 30 },
        { playerId: 'player-28', points: 11, fg_made: 4, fg_attempted: 8, three_made: 1, three_attempted: 2, ft_made: 2, ft_attempted: 2, orb: 2, drb: 7, assists: 2, steals: 1, blocks: 1, turnovers: 2, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 1, plus_minus: 1, minutes_played: 26 },
        { playerId: 'player-29', points: 8, fg_made: 3, fg_attempted: 7, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 4, orb: 3, drb: 6, assists: 0, steals: 0, blocks: 3, turnovers: 3, fouls: 5, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 2, plus_minus: 0, minutes_played: 22 }
      ],
      teamStats: {
        home: {
          teamId: 'team-thunderbolts',
          q1_points: 18, q2_points: 17, q3_points: 19, q4_points: 18, ot_points: 0, total_points: 72,
          fg_made: 28, fg_attempted: 59, three_made: 6, three_attempted: 18, two_made: 22, two_attempted: 41,
          ft_made: 10, ft_attempted: 13, orb: 7, drb: 27, team_rebounds: 2, total_rebounds: 36,
          assists: 15, steals: 4, blocks: 4, turnovers: 12, fouls: 16,
          points_off_turnovers: 12, points_in_paint: 34, second_chance_points: 10, fastbreak_points: 6, bench_points: 10,
          biggest_lead: 6, biggest_scoring_run: 6
        },
        away: {
          teamId: 'team-phoenixes',
          q1_points: 17, q2_points: 18, q3_points: 19, q4_points: 19, ot_points: 0, total_points: 73,
          fg_made: 27, fg_attempted: 57, three_made: 9, three_attempted: 19, two_made: 18, two_attempted: 38,
          ft_made: 10, ft_attempted: 12, orb: 8, drb: 26, team_rebounds: 1, total_rebounds: 35,
          assists: 14, steals: 5, blocks: 4, turnovers: 11, fouls: 15,
          points_off_turnovers: 16, points_in_paint: 28, second_chance_points: 12, fastbreak_points: 8, bench_points: 8,
          biggest_lead: 5, biggest_scoring_run: 7
        }
      },
      shots: [],
      events: [],
      lineupStints: []
    },

    // Game 6: Soaring Eagles vs City Warriors (75-73) - Close Eagles win
    {
      id: 'game-6',
      homeTeam: teams[1], // Soaring Eagles
      awayTeam: teams[2], // City Warriors
      homeTeamId: 'team-eagles',
      awayTeamId: 'team-warriors',
      tournamentId: 'tournament-summer-2024',
      date: '2024-07-20',
      currentPeriod: 4,
      currentGameTime: '00:00',
      homeStarters: ['player-9', 'player-10', 'player-11', 'player-12', 'player-13'],
      awayStarters: ['player-17', 'player-18', 'player-19', 'player-20', 'player-21'],
      trackBothTeams: false,
      isActive: false,
      isCompleted: true,
      finalScore: { home: 75, away: 73 },
      gameStats: [
        // Eagles stats (close win)
        { playerId: 'player-9', points: 17, fg_made: 6, fg_attempted: 13, three_made: 3, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 1, drb: 4, assists: 6, steals: 2, blocks: 0, turnovers: 3, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 1, minutes_played: 31 },
        { playerId: 'player-10', points: 19, fg_made: 7, fg_attempted: 14, three_made: 3, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 0, drb: 3, assists: 2, steals: 1, blocks: 0, turnovers: 2, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 3, minutes_played: 30 },
        { playerId: 'player-11', points: 14, fg_made: 5, fg_attempted: 11, three_made: 2, three_attempted: 4, ft_made: 2, ft_attempted: 2, orb: 1, drb: 5, assists: 3, steals: 1, blocks: 1, turnovers: 1, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: 2, minutes_played: 28 },
        { playerId: 'player-12', points: 11, fg_made: 4, fg_attempted: 8, three_made: 1, three_attempted: 2, ft_made: 2, ft_attempted: 3, orb: 2, drb: 7, assists: 1, steals: 0, blocks: 1, turnovers: 2, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 3, blocks_received: 1, plus_minus: 1, minutes_played: 25 },
        { playerId: 'player-13', points: 14, fg_made: 6, fg_attempted: 10, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 4, orb: 3, drb: 8, assists: 1, steals: 0, blocks: 2, turnovers: 2, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 1, plus_minus: 3, minutes_played: 26 },
        // Warriors stats (close loss)
        { playerId: 'player-17', points: 16, fg_made: 6, fg_attempted: 13, three_made: 2, three_attempted: 5, ft_made: 2, ft_attempted: 2, orb: 1, drb: 4, assists: 5, steals: 1, blocks: 0, turnovers: 4, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -1, minutes_played: 30 },
        { playerId: 'player-18', points: 18, fg_made: 7, fg_attempted: 15, three_made: 2, three_attempted: 6, ft_made: 2, ft_attempted: 2, orb: 0, drb: 3, assists: 3, steals: 1, blocks: 0, turnovers: 2, fouls: 2, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 0, plus_minus: -2, minutes_played: 29 },
        { playerId: 'player-19', points: 15, fg_made: 5, fg_attempted: 11, three_made: 3, three_attempted: 5, ft_made: 2, ft_attempted: 2, orb: 1, drb: 5, assists: 2, steals: 0, blocks: 0, turnovers: 3, fouls: 3, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 1, plus_minus: -3, minutes_played: 27 },
        { playerId: 'player-20', points: 12, fg_made: 5, fg_attempted: 9, three_made: 0, three_attempted: 1, ft_made: 2, ft_attempted: 2, orb: 2, drb: 6, assists: 1, steals: 1, blocks: 1, turnovers: 1, fouls: 4, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 2, blocks_received: 1, plus_minus: -1, minutes_played: 24 },
        { playerId: 'player-21', points: 12, fg_made: 5, fg_attempted: 10, three_made: 0, three_attempted: 0, ft_made: 2, ft_attempted: 3, orb: 2, drb: 6, assists: 0, steals: 0, blocks: 1, turnovers: 3, fouls: 5, tech_fouls: 0, unsportsmanlike_fouls: 0, fouls_drawn: 4, blocks_received: 2, plus_minus: -3, minutes_played: 23 }
      ],
      teamStats: {
        home: {
          teamId: 'team-eagles',
          q1_points: 18, q2_points: 19, q3_points: 19, q4_points: 19, ot_points: 0, total_points: 75,
          fg_made: 28, fg_attempted: 56, three_made: 9, three_attempted: 18, two_made: 19, two_attempted: 38,
          ft_made: 10, ft_attempted: 13, orb: 7, drb: 27, team_rebounds: 2, total_rebounds: 36,
          assists: 13, steals: 4, blocks: 4, turnovers: 10, fouls: 16,
          points_off_turnovers: 14, points_in_paint: 30, second_chance_points: 10, fastbreak_points: 8, bench_points: 11,
          biggest_lead: 7, biggest_scoring_run: 6
        },
        away: {
          teamId: 'team-warriors',
          q1_points: 17, q2_points: 18, q3_points: 19, q4_points: 19, ot_points: 0, total_points: 73,
          fg_made: 28, fg_attempted: 58, three_made: 7, three_attempted: 17, two_made: 21, two_attempted: 41,
          ft_made: 10, ft_attempted: 11, orb: 6, drb: 24, team_rebounds: 1, total_rebounds: 31,
          assists: 11, steals: 3, blocks: 2, turnovers: 13, fouls: 17,
          points_off_turnovers: 12, points_in_paint: 32, second_chance_points: 8, fastbreak_points: 6, bench_points: 9,
          biggest_lead: 4, biggest_scoring_run: 5
        }
      },
      shots: [],
      events: [],
      lineupStints: []
    }
  ];

  // Generate realistic shot positions for all games
  games.forEach(game => {
    game.shots = generateShotsForGame(game.gameStats, game.id);
  });

  // Add game IDs to tournament
  tournament.games = games.map(g => g.id);

  return { teams, tournaments: [tournament], games };
};

export default function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [darkMode, setDarkMode] = useState(false);

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const skipSaveRef = useRef(true);

  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const currentGameRef = useRef<Game | null>(null);
  currentGameRef.current = currentGame;
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === paths.home;
  const isStatsEntry =
    location.pathname.startsWith(paths.statsEntry) || location.pathname.startsWith('/live');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Load from Supabase on mount
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setDataLoadError(
        'Supabase is required but not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
      );
      setIsDataLoading(false);
      return;
    }

    let cancelled = false;

    loadAppDataFromSupabase()
      .then((data) => {
        if (cancelled) return;
        console.log('Loaded from Supabase:', {
          teams: data.teams.length,
          tournaments: data.tournaments.length,
          games: data.games.length,
        });
        setTeams(data.teams);
        setTournaments(data.tournaments);
        const { games: dedupedGames, active, changed } = dedupeActiveGames(data.games);
        const orphanIds = dedupedGames
          .filter(isOrphanedIncompleteGame)
          .map((g) => g.id);
        const cleanedGames = dedupedGames.filter((g) => !orphanIds.includes(g.id));
        setGames(cleanedGames);
        setDarkMode(data.darkMode);
        prevTeamsRef.current = data.teams;
        prevTournamentsRef.current = data.tournaments;
        prevGamesRef.current = cleanedGames;
        prevDarkModeRef.current = data.darkMode;
        setDataLoadError(null);

        if (active) {
          setCurrentGame(active);
        }

        if (changed || orphanIds.length > 0) {
          saveAppDataToSupabase(
            data.teams,
            data.tournaments,
            cleanedGames,
            data.darkMode
          ).catch((err: Error) => {
            console.error('Active game dedupe save failed:', err);
            setSaveError(err.message);
          });
        }

        if (orphanIds.length > 0) {
          deleteGamesFromSupabase(orphanIds).catch((err: Error) => {
            console.error('Orphan game cleanup failed:', err);
          });
        }

        if (
          data.playerMeasurementsMigrationPending &&
          !localStorage.getItem(PLAYER_MEASUREMENTS_MIGRATION_KEY)
        ) {
          localStorage.setItem(PLAYER_MEASUREMENTS_MIGRATION_KEY, '1');
          saveAppDataToSupabase(
            data.teams,
            data.tournaments,
            data.games,
            data.darkMode
          ).catch((err: Error) => {
            console.error('Player measurements migration save failed:', err);
            setSaveError(err.message);
          });
        } else if (!localStorage.getItem(PLAYER_MEASUREMENTS_MIGRATION_KEY)) {
          localStorage.setItem(PLAYER_MEASUREMENTS_MIGRATION_KEY, '1');
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.error('Supabase load failed:', err);
        setDataLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) {
          skipSaveRef.current = false;
          setIsDataLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Use refs to track previous values and prevent unnecessary saves
  const prevTeamsRef = useRef(teams);
  const prevTournamentsRef = useRef(tournaments);
  const prevGamesRef = useRef(games);
  const prevDarkModeRef = useRef(darkMode);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const idleCallbackRef = useRef<number | null>(null);

  // Persist data (Supabase or localStorage) when state changes
  useEffect(() => {
    if (skipSaveRef.current) return;
    if (isDataLoading) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (idleCallbackRef.current !== null && 'cancelIdleCallback' in window) {
      cancelIdleCallback(idleCallbackRef.current);
      idleCallbackRef.current = null;
    }

    const checkAndSave = () => {
      const teamsChanged = JSON.stringify(prevTeamsRef.current) !== JSON.stringify(teams);
      const tournamentsChanged =
        JSON.stringify(prevTournamentsRef.current) !== JSON.stringify(tournaments);
      const gamesChanged = JSON.stringify(prevGamesRef.current) !== JSON.stringify(games);
      const darkModeChanged = prevDarkModeRef.current !== darkMode;

      if (!teamsChanged && !tournamentsChanged && !gamesChanged && !darkModeChanged) {
        return;
      }

      prevTeamsRef.current = teams;
      prevTournamentsRef.current = tournaments;
      prevGamesRef.current = games;
      prevDarkModeRef.current = darkMode;

      const activeGame = currentGameRef.current;
      const gamesToSave =
        activeGame?.isActive
          ? [...games.filter((g) => g.id !== activeGame.id), activeGame]
          : games;

      saveTimeoutRef.current = setTimeout(() => {
        saveAppDataToSupabase(teams, tournaments, gamesToSave, darkMode)
          .then(() => setSaveError(null))
          .catch((err: Error) => {
            console.error('Supabase save failed:', err);
            setSaveError(err.message);
          });
        saveTimeoutRef.current = null;
      }, 500);
    };

    if ('requestIdleCallback' in window) {
      idleCallbackRef.current = requestIdleCallback(checkAndSave, { timeout: 1000 });
    } else {
      setTimeout(checkAndSave, 0);
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (idleCallbackRef.current !== null && 'cancelIdleCallback' in window) {
        cancelIdleCallback(idleCallbackRef.current);
      }
    };
  }, [teams, tournaments, games, darkMode, isDataLoading]);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    document.documentElement.classList.toggle('dark');

    if (skipSaveRef.current) return;

    const activeGame = currentGameRef.current;
    const gamesToSave =
      activeGame?.isActive
        ? [...games.filter((g) => g.id !== activeGame.id), activeGame]
        : games;

    saveAppDataToSupabase(teams, tournaments, gamesToSave, newDarkMode).catch((err: Error) =>
      setSaveError(err.message)
    );
  };

  const handleGameStart = useCallback(
    (game: Game): boolean => {
      const existing = getActiveGame(games, currentGame);
      if (existing && existing.id !== game.id) {
        return false;
      }

      const deactivated = games.map((g) =>
        g.isActive && !g.isCompleted && g.id !== game.id
          ? { ...g, isActive: false }
          : g
      );

      setGames([...deactivated.filter((g) => g.id !== game.id), game]);
      setCurrentGame(game);
      return true;
    },
    [games, currentGame]
  );

  const handleDeleteActiveGame = useCallback(
    (gameId: string) => {
      const game =
        (currentGame?.id === gameId ? currentGame : null) ??
        games.find((g) => g.id === gameId) ??
        null;

      const teamIdsToDelete = game ? resolveTeamsToDeleteWithGame(game) : [];
      const rosterRollbacks = game
        ? resolveSetupPlayersToRemove(game, teamIdsToDelete, teams)
        : [];
      const playerIdsToRemove = rosterRollbacks.flatMap((r) => r.addedPlayerIds);

      const nextGames = games.filter((g) => g.id !== gameId);
      let nextTeams = teams.filter((t) => !teamIdsToDelete.includes(t.id));
      for (const { teamId, addedPlayerIds } of rosterRollbacks) {
        const removeSet = new Set(addedPlayerIds);
        nextTeams = nextTeams.map((t) =>
          t.id === teamId
            ? { ...t, players: t.players.filter((p) => !removeSet.has(p.id)) }
            : t
        );
      }
      const nextTournaments = tournaments.map((t) => ({
        ...t,
        teams: t.teams.filter((id) => !teamIdsToDelete.includes(id)),
        games: t.games.filter((id) => id !== gameId),
      }));

      skipSaveRef.current = true;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      setGames(nextGames);
      setCurrentGame((prev) => (prev?.id === gameId ? null : prev));
      setTournaments(nextTournaments);
      setTeams(nextTeams);

      const finishDeleteSave = () => {
        prevTeamsRef.current = nextTeams;
        prevTournamentsRef.current = nextTournaments;
        prevGamesRef.current = nextGames;
        prevDarkModeRef.current = darkMode;
        skipSaveRef.current = false;
      };

      if (isSupabaseConfigured) {
        void (async () => {
          try {
            await deleteGamesFromSupabase([gameId]);
            if (teamIdsToDelete.length > 0) {
              await deleteTeamsFromSupabase(teamIdsToDelete);
            }
            if (playerIdsToRemove.length > 0) {
              await deletePlayersFromSupabase(playerIdsToRemove);
            }
            await saveAppDataToSupabase(
              nextTeams,
              nextTournaments,
              nextGames,
              darkMode
            );
            setSaveError(null);
          } catch (err) {
            console.error('Delete game/teams/players from Supabase failed:', err);
            setSaveError(err instanceof Error ? err.message : String(err));
          } finally {
            finishDeleteSave();
          }
        })();
      } else {
        finishDeleteSave();
      }
    },
    [games, currentGame, teams, tournaments, darkMode]
  );

  const handleGameUpdate = useCallback((game: Game) => {
    setCurrentGame(game);
    if (game.isActive) {
      setGames((prev) => [...prev.filter((g) => g.id !== game.id), game]);
    }
  }, []);

  const handleGameComplete = useCallback((game: Game) => {
    // Calculate final score
    const homeScore = game.gameStats
      .filter(s => game.homeTeam.players.some(p => p.id === s.playerId))
      .reduce((sum, s) => sum + s.points, 0);
    
    const awayScore = game.gameStats
      .filter(s => game.awayTeam.players.some(p => p.id === s.playerId))
      .reduce((sum, s) => sum + s.points, 0);

    // Ensure tournament ID is set (default to Summer League 2024)
    const tournamentId = game.tournamentId || 'tournament-summer-2024';

    const completedGame: Game = {
      ...game,
      tournamentId,
      isActive: false,
      isCompleted: true,
      currentPeriod: game.currentPeriod || 4,
      currentGameTime: game.currentGameTime || '00:00',
      finalScore: { home: homeScore, away: awayScore }
    };
    
    setGames((prev) => [
      ...prev.filter((g) => g.id !== completedGame.id),
      completedGame,
    ]);
    
    // Add game to tournament's games list
    setTournaments(prev => prev.map(tournament => 
      tournament.id === tournamentId
        ? { ...tournament, games: [...tournament.games.filter(gid => gid !== completedGame.id), completedGame.id] }
        : tournament
    ));
    
    setCurrentGame(null);
    navigate(paths.home);
  }, [navigate]);

  // Tournament management functions - memoized
  const handleCreateTournament = useCallback((tournamentData: Omit<Tournament, 'id'>) => {
    const tournament: Tournament = {
      ...tournamentData,
      id: `tournament-${Date.now()}`,
      teams: [],
      games: [],
      standings: []
    };
    setTournaments(prev => [...prev, tournament]);
  }, []);

  const handleUpdateTournament = useCallback((updatedTournament: Tournament) => {
    setTournaments(prev => prev.map(t => t.id === updatedTournament.id ? updatedTournament : t));
  }, []);

  const handleDeleteTournament = useCallback((tournamentId: string) => {
    setTournaments(prev => prev.filter(t => t.id !== tournamentId));
  }, []);

  // Team management functions - memoized
  const handleCreateTeam = useCallback(
    (teamData: Omit<Team, 'id'>, options?: CreateTeamOptions): Team => {
      const taken = teams.map((t) => t.abbreviation);
      const tournamentIds =
        options?.tournamentIds ??
        (teamData.currentTournamentId ? [teamData.currentTournamentId] : []);

      const team: Team = {
        ...teamData,
        id: `team-${Date.now()}`,
        abbreviation:
          teamData.abbreviation?.trim().toUpperCase() ||
          generateTeamAbbreviation(teamData.name, taken),
        currentTournamentId: tournamentIds[0] ?? teamData.currentTournamentId,
      };
      setTeams((prev) => [...prev, team]);

      if (tournamentIds.length > 0) {
        const idSet = new Set(tournamentIds);
        setTournaments((prev) =>
          prev.map((tournament) =>
            idSet.has(tournament.id)
              ? {
                  ...tournament,
                  teams: [
                    ...tournament.teams.filter((tid) => tid !== team.id),
                    team.id,
                  ],
                }
              : tournament
          )
        );
      }
      return team;
    },
    [teams]
  );

  const handleAddTeamToTournament = useCallback((teamId: string, tournamentId: string) => {
    // Add team to tournament
    setTournaments(prev => prev.map(tournament => 
      tournament.id === tournamentId 
        ? { ...tournament, teams: [...tournament.teams, teamId] }
        : tournament
    ));
    // Update team's current tournament
    setTeams(prev => prev.map(team => 
      team.id === teamId 
        ? { ...team, currentTournamentId: tournamentId }
        : team
    ));
  }, []);

  const handleUpdateTeam = useCallback((updatedTeam: Team) => {
    setTeams(prev => {
      const oldTeam = prev.find(t => t.id === updatedTeam.id);
      const newTeams = prev.map(t => t.id === updatedTeam.id ? updatedTeam : t);
      
      // Handle tournament association changes
      if (oldTeam && oldTeam.currentTournamentId !== updatedTeam.currentTournamentId) {
        setTournaments(tournamentPrev => tournamentPrev.map(tournament => {
          // Remove from old tournament
          if (tournament.id === oldTeam.currentTournamentId) {
            return {
              ...tournament,
              teams: tournament.teams.filter(id => id !== updatedTeam.id)
            };
          }
          // Add to new tournament
          if (tournament.id === updatedTeam.currentTournamentId) {
            return {
              ...tournament,
              teams: [...tournament.teams, updatedTeam.id]
            };
          }
          return tournament;
        }));
      }
      
      return newTeams;
    });
  }, []);

  const handleDeleteTeam = useCallback((teamId: string) => {
    setTeams(prev => prev.filter(t => t.id !== teamId));
    
    // Remove team from all tournaments
    setTournaments(prev => prev.map(tournament => ({
      ...tournament,
      teams: tournament.teams.filter(id => id !== teamId)
    })));
  }, []);

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { teams: [], players: [], games: [] };
    
    const query = searchQuery.toLowerCase();
    
    // Search teams
    const matchedTeams = teams.filter(team => 
      team.name.toLowerCase().includes(query) || 
      team.abbreviation.toLowerCase().includes(query)
    ).slice(0, 5);
    
    // Search players
    const matchedPlayers: Array<{ player: Player; team: Team }> = [];
    teams.forEach(team => {
      team.players.forEach(player => {
        if (player.name.toLowerCase().includes(query) || 
            player.number.toString().includes(query) ||
            player.position.toLowerCase().includes(query)) {
          matchedPlayers.push({ player, team });
        }
      });
    });
    
    // Search games
    const matchedGames = games.filter(game => 
      game.homeTeam.name.toLowerCase().includes(query) ||
      game.awayTeam.name.toLowerCase().includes(query) ||
      game.homeTeam.abbreviation.toLowerCase().includes(query) ||
      game.awayTeam.abbreviation.toLowerCase().includes(query) ||
      game.date.includes(query)
    ).slice(0, 5);
    
    return { 
      teams: matchedTeams, 
      players: matchedPlayers.slice(0, 5), 
      games: matchedGames 
    };
  }, [searchQuery, teams, games]);

  if (isDataLoading) {
    return (
      <div className={`min-h-screen bg-background text-foreground flex items-center justify-center ${darkMode ? 'dark' : ''}`}>
        <p className="text-muted-foreground">Loading league data…</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background text-foreground ${darkMode ? 'dark' : ''}`}>
      {!isSupabaseConfigured && import.meta.env.PROD && (
        <div className="bg-amber-500/15 text-amber-900 dark:text-amber-200 text-sm text-center py-2 px-4">
          Cloud database not connected (missing env vars in this deploy). Data is from this browser only.
          Redeploy on Vercel after adding VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
        </div>
      )}
      {(dataLoadError || saveError) && (
        <div className="bg-destructive/10 text-destructive text-sm text-center py-2 px-4">
          {dataLoadError
            ? `Could not load from cloud (${dataLoadError}). Showing local backup.`
            : `Could not save to cloud: ${saveError}`}
        </div>
      )}
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo & Title */}
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              <h1 className="font-medium">RunItBack</h1>
            </div>
            
            {/* Center: Toggle Navigation */}
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={isDashboard ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate(paths.home)}
                className="rounded-md"
              >
                Main
              </Button>
              <Button
                variant={isStatsEntry ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate(paths.statsEntry)}
                className="rounded-md"
              >
                Stats Entry
              </Button>
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {currentGame && currentGame.isActive && !currentGame.isCompleted && (
                <button
                  type="button"
                  onClick={() => navigate(liveGamePath(currentGame.id))}
                  className="text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 px-3 py-1 rounded-full hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors cursor-pointer"
                >
                  Live: {currentGame.homeTeam.abbreviation} vs{' '}
                  {currentGame.awayTeam.abbreviation}
                </button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleDarkMode}
                className="rounded-full w-9 h-9 p-0"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              
              <Button variant="ghost" size="sm" className="rounded-full w-9 h-9 p-0">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Search Bar - Below Header (Only on Dashboard) */}
      {isDashboard && (
      <div className="bg-background sticky top-[73px] z-40">
        <div className="container mx-auto px-6 py-3 flex justify-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search teams, players, or games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
            
            {/* Search Results Dropdown */}
            {searchQuery.trim() && (searchResults.teams.length > 0 || searchResults.players.length > 0 || searchResults.games.length > 0) && (
              <div className="absolute top-full mt-2 w-full bg-card border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                {/* Teams */}
                {searchResults.teams.length > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Teams</div>
                    {searchResults.teams.map(team => (
                      <button
                        key={team.id}
                        onClick={() => {
                          navigate(teamPath(team));
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-muted flex items-center gap-2"
                      >
                        <span className="text-lg">{team.icon || '🏀'}</span>
                        <div>
                          <div className="font-medium">{team.name}</div>
                          <div className="text-xs text-muted-foreground">{team.abbreviation}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Players */}
                {searchResults.players.length > 0 && (
                  <div className="p-2 border-t">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Players</div>
                    {searchResults.players.map(({ player, team }) => (
                      <button
                        key={player.id}
                        onClick={() => {
                          navigate(playerPath(player));
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-muted"
                      >
                        <div className="font-medium">
                          #{player.number} {player.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {player.position} · {team.name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Games */}
                {searchResults.games.length > 0 && (
                  <div className="p-2 border-t">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Games</div>
                    {searchResults.games.map(game => (
                      <button
                        key={game.id}
                        onClick={() => {
                          navigate(gamePath(game.id));
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-muted"
                      >
                        <div className="font-medium">
                          {game.homeTeam.abbreviation} vs {game.awayTeam.abbreviation}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {game.date} · {game.isCompleted ? `Final: ${game.finalScore?.home}-${game.finalScore?.away}` : 'In Progress'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* No Results */}
            {searchQuery.trim() && searchResults.teams.length === 0 && searchResults.players.length === 0 && searchResults.games.length === 0 && (
              <div className="absolute top-full mt-2 w-full bg-card border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground z-50">
                No results found for &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        <AppRoutes
          teams={teams}
          tournaments={tournaments}
          games={games}
          currentGame={currentGame}
          setCurrentGame={setCurrentGame}
          onCreateTournament={handleCreateTournament}
          onUpdateTournament={handleUpdateTournament}
          onDeleteTournament={handleDeleteTournament}
          onCreateTeam={handleCreateTeam}
          onUpdateTeam={handleUpdateTeam}
          onDeleteTeam={handleDeleteTeam}
          onAddTeamToTournament={handleAddTeamToTournament}
          onGameStart={handleGameStart}
          onGameUpdate={handleGameUpdate}
          onGameComplete={handleGameComplete}
          onDeleteActiveGame={handleDeleteActiveGame}
        />
      </main>
    </div>
  );
}