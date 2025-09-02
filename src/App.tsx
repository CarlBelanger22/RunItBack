import React, { useState, useCallback, useMemo } from 'react';
import { Button } from './components/ui/button';
import { Dashboard } from './components/Dashboard';
import { TournamentManager } from './components/TournamentManager';
import { TournamentPage } from './components/TournamentPage';
import { TeamManager } from './components/TeamManager';
import { TeamPage } from './components/TeamPage';
import { PlayerPage } from './components/PlayerPage';
import { GameSetup } from './components/GameSetup';
import { LiveGameEntry } from './components/LiveGameEntry';
import { GameSummary } from './components/GameSummary';

import { Moon, Sun, Settings, BarChart3 } from 'lucide-react';

// Types for our basketball app
export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  picture?: string;
  height: string; // Format: "6'3'' (1.91m)"
  weight: string; // Format: "185 lbs (84 kg)"
  age: number;
}

export interface Team {
  id: string;
  name: string;
  abbreviation: string; // 3-letter team abbreviation (must be uppercase)
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
  // Advanced team metrics
  points_off_turnovers: number;
  points_in_paint: number;
  second_chance_points: number;
  fastbreak_points: number;
  bench_points: number;
  biggest_lead: number;
  biggest_scoring_run: number;
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
}

// Navigation types
type MainView = 'dashboard' | 'tournaments' | 'teams' | 'game-setup' | 'live-game' | 'game-summary';
type TournamentTab = 'home' | 'teams' | 'standings' | 'players';
type TeamTab = 'overview' | 'roster' | 'stats' | 'games';
type PlayerTab = 'overview' | 'gamelog' | 'advanced';

interface NavigationState {
  mainView: MainView;
  tournamentId?: string;
  tournamentTab?: TournamentTab;
  teamId?: string;
  teamTab?: TeamTab;
  playerId?: string;
  playerTab?: PlayerTab;
  gameId?: string;
  previousView?: {
    mainView: MainView;
    tournamentId?: string;
    tournamentTab?: TournamentTab;
  };
}

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

  // Add game IDs to tournament
  tournament.games = games.map(g => g.id);

  return { teams, tournaments: [tournament], games };
};

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  
  // Initialize with seed data
  const seedData = createSeedData();
  const [games, setGames] = useState<Game[]>(seedData.games);
  const [tournaments, setTournaments] = useState<Tournament[]>(seedData.tournaments);
  const [teams, setTeams] = useState<Team[]>(seedData.teams);
  
  // Navigation state
  const [navigation, setNavigation] = useState<NavigationState>({
    mainView: 'dashboard'
  });

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  // Navigation helpers - memoized to prevent unnecessary re-renders
  const navigateTo = useCallback((newState: Partial<NavigationState>) => {
    setNavigation(prev => ({ ...prev, ...newState }));
  }, []);

  const navigateToTournament = useCallback((tournamentId: string, tab: TournamentTab = 'home') => {
    setNavigation({
      mainView: 'tournaments',
      tournamentId,
      tournamentTab: tab
    });
  }, []);

  const navigateToTeam = useCallback((teamId: string, tab: TeamTab = 'overview', fromTournament?: { tournamentId: string; tournamentTab: TournamentTab }) => {
    setNavigation(prev => ({
      mainView: 'teams',
      teamId,
      teamTab: tab,
      previousView: fromTournament ? {
        mainView: 'tournaments',
        tournamentId: fromTournament.tournamentId,
        tournamentTab: fromTournament.tournamentTab
      } : undefined
    }));
  }, []);

  const navigateToPlayer = useCallback((playerId: string, tab: PlayerTab = 'overview') => {
    setNavigation(prev => ({
      mainView: 'teams', // Set to teams view to show PlayerPage
      playerId,
      playerTab: tab,
      // Keep current context if navigating from tournament
      teamId: prev.teamId,
      tournamentId: prev.tournamentId,
      tournamentTab: prev.tournamentTab,
      previousView: prev.tournamentId ? {
        mainView: 'tournaments',
        tournamentId: prev.tournamentId,
        tournamentTab: prev.tournamentTab || 'players'
      } : prev.previousView
    }));
  }, []);

  const handleGameStart = useCallback((game: Game) => {
    setCurrentGame(game);
    setNavigation({ mainView: 'live-game' });
  }, []);

  const handleGameComplete = useCallback((game: Game) => {
    // Calculate final score
    const homeScore = game.gameStats
      .filter(s => game.homeTeam.players.some(p => p.id === s.playerId))
      .reduce((sum, s) => sum + s.points, 0);
    
    const awayScore = game.gameStats
      .filter(s => game.awayTeam.players.some(p => p.id === s.playerId))
      .reduce((sum, s) => sum + s.points, 0);

    const completedGame = {
      ...game,
      isActive: false,
      isCompleted: true,
      currentPeriod: game.currentPeriod || 4,
      currentGameTime: game.currentGameTime || '00:00',
      finalScore: { home: homeScore, away: awayScore }
    };
    
    setGames(prev => [...prev, completedGame]);
    setCurrentGame(null);
    setNavigation({ mainView: 'dashboard' });
  }, []);

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
  const handleCreateTeam = useCallback((teamData: Omit<Team, 'id'>) => {
    const team: Team = {
      ...teamData,
      id: `team-${Date.now()}`
    };
    setTeams(prev => [...prev, team]);
    
    // If the team was created for a specific tournament, add it to that tournament
    if (team.currentTournamentId) {
      setTournaments(prev => prev.map(tournament => 
        tournament.id === team.currentTournamentId 
          ? { ...tournament, teams: [...tournament.teams, team.id] }
          : tournament
      ));
    }
  }, []);

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

  // Get data helpers - memoized
  const getTournament = useCallback((id: string) => tournaments.find(t => t.id === id), [tournaments]);
  const getTeam = useCallback((id: string) => teams.find(t => t.id === id), [teams]);
  const getPlayer = useCallback((id: string) => {
    for (const team of teams) {
      const player = team.players.find(p => p.id === id);
      if (player) return { player, team };
    }
    return null;
  }, [teams]);
  const getGame = useCallback((id: string) => games.find(g => g.id === id), [games]);

  // Memoize current tournament, team, player, and game to prevent unnecessary lookups
  const currentTournament = useMemo(() => 
    navigation.tournamentId ? getTournament(navigation.tournamentId) : null,
    [navigation.tournamentId, getTournament]
  );

  const currentTeam = useMemo(() => 
    navigation.teamId ? getTeam(navigation.teamId) : null,
    [navigation.teamId, getTeam]
  );

  const currentPlayerData = useMemo(() => 
    navigation.playerId ? getPlayer(navigation.playerId) : null,
    [navigation.playerId, getPlayer]
  );

  const currentGameData = useMemo(() => 
    navigation.gameId ? getGame(navigation.gameId) : null,
    [navigation.gameId, getGame]
  );

  return (
    <div className={`min-h-screen bg-background text-foreground ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-xl font-medium">RunItBack</h1>
                <p className="text-sm text-muted-foreground">Basketball Stats Tracker</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {currentGame && (
                <div className="text-sm bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 px-3 py-1 rounded-full">
                  Live Game: {currentGame.homeTeam.name} vs {currentGame.awayTeam.name}
                </div>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleDarkMode}
                className="rounded-full w-10 h-10 p-0"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              
              <Button variant="ghost" size="sm" className="rounded-full w-10 h-10 p-0">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        {navigation.mainView === 'dashboard' && (
          <Dashboard 
            tournaments={tournaments}
            teams={teams}
            recentGames={games.slice().reverse().slice(0, 10)}
            onNavigateToTournaments={() => navigateTo({ mainView: 'tournaments' })}
            onNavigateToTeams={() => navigateTo({ mainView: 'teams' })}
            onNavigateToGameSummary={(game) => navigateTo({ mainView: 'game-summary', gameId: game.id })}
            onStartNewGame={() => navigateTo({ mainView: 'game-setup' })}
            onNavigateToTournament={navigateToTournament}
            onNavigateToTeam={navigateToTeam}
          />
        )}

        {navigation.mainView === 'tournaments' && !navigation.tournamentId && (
          <TournamentManager 
            tournaments={tournaments}
            teams={teams}
            onCreateTournament={handleCreateTournament}
            onUpdateTournament={handleUpdateTournament}
            onDeleteTournament={handleDeleteTournament}
            onBack={() => navigateTo({ mainView: 'dashboard' })}
            onNavigateToTournament={navigateToTournament}
          />
        )}

        {navigation.mainView === 'tournaments' && navigation.tournamentId && currentTournament && (
          <TournamentPage
            tournament={currentTournament}
            teams={teams}
            games={games}
            activeTab={navigation.tournamentTab || 'home'}
            onTabChange={(tab) => navigateTo({ tournamentTab: tab })}
            onBack={() => navigateTo({ mainView: 'tournaments', tournamentId: undefined, tournamentTab: undefined })}
            onNavigateToTeam={(teamId) => navigateToTeam(teamId, 'overview', { tournamentId: currentTournament.id, tournamentTab: navigation.tournamentTab || 'home' })}
            onNavigateToPlayer={navigateToPlayer}
            onNavigateToGame={(gameId) => navigateTo({ mainView: 'game-summary', gameId })}
            onCreateTeam={handleCreateTeam}
            onAddTeamToTournament={handleAddTeamToTournament}
            onUpdateTeam={handleUpdateTeam}
            onDeleteTeam={handleDeleteTeam}
          />
        )}

        {navigation.mainView === 'tournaments' && navigation.tournamentId && !currentTournament && (
          <div>Tournament not found</div>
        )}

        {navigation.mainView === 'teams' && !navigation.teamId && (
          <TeamManager 
            teams={teams}
            onCreateTeam={handleCreateTeam}
            onUpdateTeam={handleUpdateTeam}
            onDeleteTeam={handleDeleteTeam}
            onBack={() => navigateTo({ mainView: 'dashboard' })}
            onNavigateToTeam={navigateToTeam}
          />
        )}

        {navigation.mainView === 'teams' && navigation.teamId && !navigation.playerId && currentTeam && (
          <TeamPage
            team={currentTeam}
            games={games}
            tournaments={tournaments}
            activeTab={navigation.teamTab || 'overview'}
            onTabChange={(tab) => navigateTo({ teamTab: tab })}
            onBack={() => {
              if (navigation.previousView) {
                setNavigation(navigation.previousView);
              } else {
                navigateTo({ mainView: 'teams', teamId: undefined, teamTab: undefined });
              }
            }}
            onNavigateToPlayer={navigateToPlayer}
            onNavigateToGame={(gameId) => navigateTo({ mainView: 'game-summary', gameId })}
            onNavigateToTournament={navigateToTournament}
          />
        )}

        {navigation.mainView === 'teams' && navigation.teamId && !navigation.playerId && !currentTeam && (
          <div>Team not found</div>
        )}

        {navigation.playerId && currentPlayerData && (
          <PlayerPage
            player={currentPlayerData.player}
            team={currentPlayerData.team}
            games={games}
            tournaments={tournaments}
            activeTab={navigation.playerTab || 'overview'}
            onTabChange={(tab) => navigateTo({ playerTab: tab })}
            onBack={() => navigateTo({ playerId: undefined, playerTab: undefined })}
            onNavigateToTeam={navigateToTeam}
            onNavigateToGame={(gameId) => navigateTo({ mainView: 'game-summary', gameId })}
            onNavigateToTournament={navigateToTournament}
          />
        )}

        {navigation.playerId && !currentPlayerData && (
          <div>Player not found</div>
        )}

        {navigation.mainView === 'game-setup' && (
          <div className="space-y-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigateTo({ mainView: 'dashboard' })}
            >
              ← Back to Dashboard
            </Button>
            <GameSetup onGameStart={handleGameStart} availableTeams={teams} />
          </div>
        )}

        {navigation.mainView === 'live-game' && currentGame && (
          <div className="space-y-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigateTo({ mainView: 'dashboard' })}
            >
              ← Back to Dashboard
            </Button>
            <LiveGameEntry 
              game={currentGame} 
              onGameUpdate={setCurrentGame}
              onGameComplete={handleGameComplete}
            />
          </div>
        )}

        {navigation.mainView === 'game-summary' && navigation.gameId && currentGameData && (
          <GameSummary 
            game={currentGameData}
            onBack={() => navigateTo({ mainView: 'dashboard', gameId: undefined })}
          />
        )}

        {navigation.mainView === 'game-summary' && navigation.gameId && !currentGameData && (
          <div>Game not found</div>
        )}
      </main>
    </div>
  );
}