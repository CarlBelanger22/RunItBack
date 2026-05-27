import { supabase } from '../lib/supabase';
import type { Team, Tournament, Game, Player } from '../App';

export const DEFAULT_LEAGUE_ID = 'league-default';

export interface LoadedAppData {
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  darkMode: boolean;
}

interface DbTeam {
  id: string;
  league_id: string;
  name: string;
  abbreviation: string;
  icon: string | null;
  description: string | null;
  current_tournament_id: string | null;
}

interface DbPlayer {
  id: string;
  team_id: string;
  name: string;
  number: number;
  position: string;
  secondary_position: string | null;
  picture: string | null;
  height: string;
  weight: string;
  age: number;
  date_of_birth: string | null;
}

interface DbTournament {
  id: string;
  league_id: string;
  name: string;
  icon: string | null;
  description: string | null;
  year: number;
  month: string;
  standings: Tournament['standings'];
}

interface DbTournamentTeam {
  tournament_id: string;
  team_id: string;
}

interface DbGame {
  id: string;
  league_id: string;
  tournament_id: string | null;
  home_team_id: string;
  away_team_id: string;
  date: string;
  current_period: number;
  current_game_time: string;
  track_both_teams: boolean;
  is_active: boolean;
  is_completed: boolean;
  final_score_home: number | null;
  final_score_away: number | null;
  home_starters: string[];
  away_starters: string[];
  game_stats: Game['gameStats'];
  team_stats: Game['teamStats'];
  shots: Game['shots'];
  events: Game['events'];
  lineup_stints: Game['lineupStints'];
}

function dbPlayerToPlayer(row: DbPlayer): Player {
  return {
    id: row.id,
    name: row.name,
    number: row.number,
    position: row.position,
    secondaryPosition: row.secondary_position ?? undefined,
    picture: row.picture ?? undefined,
    height: row.height,
    weight: row.weight,
    age: row.age,
    dateOfBirth: row.date_of_birth ?? undefined,
  };
}

function dbTeamToTeam(row: DbTeam, players: Player[]): Team {
  return {
    id: row.id,
    name: row.name,
    abbreviation: row.abbreviation,
    icon: row.icon ?? undefined,
    description: row.description ?? undefined,
    players,
    currentTournamentId: row.current_tournament_id ?? undefined,
  };
}

function teamToDbRow(team: Team, leagueId: string): DbTeam {
  return {
    id: team.id,
    league_id: leagueId,
    name: team.name,
    abbreviation: team.abbreviation,
    icon: team.icon ?? null,
    description: team.description ?? null,
    current_tournament_id: team.currentTournamentId ?? null,
  };
}

function playerToDbRow(player: Player, teamId: string): DbPlayer {
  return {
    id: player.id,
    team_id: teamId,
    name: player.name,
    number: player.number,
    position: player.position,
    secondary_position: player.secondaryPosition ?? null,
    picture: player.picture ?? null,
    height: player.height ?? '',
    weight: player.weight ?? '',
    age: player.age ?? 0,
    date_of_birth: player.dateOfBirth ?? null,
  };
}

function gameToDbRow(game: Game, leagueId: string): DbGame {
  const homeId = game.homeTeamId || game.homeTeam?.id;
  const awayId = game.awayTeamId || game.awayTeam?.id;
  if (!homeId || !awayId) {
    throw new Error(`Game ${game.id} is missing home or away team id`);
  }

  return {
    id: game.id,
    league_id: leagueId,
    tournament_id: game.tournamentId ?? null,
    home_team_id: homeId,
    away_team_id: awayId,
    date: game.date,
    current_period: game.currentPeriod ?? 1,
    current_game_time: game.currentGameTime ?? '12:00',
    track_both_teams: game.trackBothTeams ?? true,
    is_active: game.isActive ?? false,
    is_completed: game.isCompleted ?? false,
    final_score_home: game.finalScore?.home ?? null,
    final_score_away: game.finalScore?.away ?? null,
    home_starters: game.homeStarters ?? [],
    away_starters: game.awayStarters ?? [],
    game_stats: game.gameStats ?? [],
    team_stats: game.teamStats ?? { home: {} as Game['teamStats']['home'], away: {} as Game['teamStats']['away'] },
    shots: game.shots ?? [],
    events: game.events ?? [],
    lineup_stints: game.lineupStints ?? [],
  };
}

function dbGameToGame(row: DbGame, teamById: Map<string, Team>): Game {
  const homeTeam = teamById.get(row.home_team_id);
  const awayTeam = teamById.get(row.away_team_id);
  if (!homeTeam || !awayTeam) {
    throw new Error(`Game ${row.id} references missing team(s)`);
  }

  return {
    id: row.id,
    homeTeam,
    awayTeam,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    tournamentId: row.tournament_id ?? undefined,
    date: row.date,
    gameStats: row.game_stats ?? [],
    teamStats: row.team_stats,
    shots: row.shots ?? [],
    events: row.events ?? [],
    lineupStints: row.lineup_stints ?? [],
    currentPeriod: row.current_period,
    currentGameTime: row.current_game_time,
    homeStarters: row.home_starters ?? [],
    awayStarters: row.away_starters ?? [],
    trackBothTeams: row.track_both_teams,
    isActive: row.is_active,
    isCompleted: row.is_completed,
    finalScore:
      row.final_score_home != null && row.final_score_away != null
        ? { home: row.final_score_home, away: row.final_score_away }
        : undefined,
  };
}

async function upsertChunks<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  onConflict: string
): Promise<void> {
  if (!supabase || rows.length === 0) return;
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function loadAppDataFromSupabase(
  leagueId = DEFAULT_LEAGUE_ID
): Promise<LoadedAppData> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const [
    teamsRes,
    playersRes,
    tournamentsRes,
    junctionRes,
    gamesRes,
    prefsRes,
  ] = await Promise.all([
    supabase.from('teams').select('*').eq('league_id', leagueId),
    supabase.from('players').select('*'),
    supabase.from('tournaments').select('*').eq('league_id', leagueId),
    supabase.from('tournament_teams').select('tournament_id, team_id'),
    supabase.from('games').select('*').eq('league_id', leagueId),
    supabase.from('app_preferences').select('dark_mode').eq('league_id', leagueId).maybeSingle(),
  ]);

  if (teamsRes.error) throw new Error(teamsRes.error.message);
  if (playersRes.error) throw new Error(playersRes.error.message);
  if (tournamentsRes.error) throw new Error(tournamentsRes.error.message);
  if (junctionRes.error) throw new Error(junctionRes.error.message);
  if (gamesRes.error) throw new Error(gamesRes.error.message);
  if (prefsRes.error) throw new Error(prefsRes.error.message);

  const teamRows = (teamsRes.data ?? []) as DbTeam[];
  const playerRows = (playersRes.data ?? []) as DbPlayer[];
  const tournamentRows = (tournamentsRes.data ?? []) as DbTournament[];
  const junctionRows = (junctionRes.data ?? []) as DbTournamentTeam[];
  const gameRows = (gamesRes.data ?? []) as DbGame[];

  const teamIds = new Set(teamRows.map((t) => t.id));
  const playersByTeam = new Map<string, Player[]>();
  for (const row of playerRows) {
    if (!teamIds.has(row.team_id)) continue;
    const list = playersByTeam.get(row.team_id) ?? [];
    list.push(dbPlayerToPlayer(row));
    playersByTeam.set(row.team_id, list);
  }

  const teams: Team[] = teamRows.map((row) =>
    dbTeamToTeam(row, playersByTeam.get(row.id) ?? [])
  );
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const games: Game[] = [];
  for (const row of gameRows) {
    try {
      games.push(dbGameToGame(row, teamById));
    } catch (e) {
      console.warn('[Supabase] Skipping game on load:', (e as Error).message);
    }
  }

  const teamsByTournament = new Map<string, string[]>();
  for (const row of junctionRows) {
    const list = teamsByTournament.get(row.tournament_id) ?? [];
    list.push(row.team_id);
    teamsByTournament.set(row.tournament_id, list);
  }

  const tournaments: Tournament[] = tournamentRows.map((row) => {
    const gameIds = games.filter((g) => g.tournamentId === row.id).map((g) => g.id);
    return {
      id: row.id,
      name: row.name,
      icon: row.icon ?? undefined,
      description: row.description ?? undefined,
      year: row.year,
      month: row.month,
      teams: teamsByTournament.get(row.id) ?? [],
      games: gameIds,
      standings: row.standings ?? [],
    };
  });

  return {
    teams,
    tournaments,
    games,
    darkMode: prefsRes.data?.dark_mode ?? false,
  };
}

export async function saveAppDataToSupabase(
  teams: Team[],
  tournaments: Tournament[],
  games: Game[],
  darkMode: boolean,
  leagueId = DEFAULT_LEAGUE_ID
): Promise<void> {
  if (!supabase) return;

  await upsertChunks('leagues', [{ id: leagueId, name: 'My League' }], 'id');

  const teamRows = teams.map((t) => teamToDbRow(t, leagueId));
  const playerRows = teams.flatMap((t) =>
    (t.players ?? []).map((p) => playerToDbRow(p, t.id))
  );

  await upsertChunks('teams', teamRows, 'id');
  await upsertChunks('players', playerRows, 'id');

  const tournamentRows = tournaments.map((t) => ({
    id: t.id,
    league_id: leagueId,
    name: t.name,
    icon: t.icon ?? null,
    description: t.description ?? null,
    year: t.year,
    month: t.month,
    standings: t.standings ?? [],
  }));
  await upsertChunks('tournaments', tournamentRows, 'id');

  const junctionRows: DbTournamentTeam[] = [];
  const seen = new Set<string>();
  for (const t of tournaments) {
    for (const teamId of t.teams ?? []) {
      const key = `${t.id}:${teamId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      junctionRows.push({ tournament_id: t.id, team_id: teamId });
    }
  }
  await upsertChunks('tournament_teams', junctionRows, 'tournament_id,team_id');

  const gameRows = games.map((g) => gameToDbRow(g, leagueId));
  await upsertChunks('games', gameRows, 'id');

  const { error: prefError } = await supabase.from('app_preferences').upsert(
    { league_id: leagueId, dark_mode: darkMode },
    { onConflict: 'league_id' }
  );
  if (prefError) throw new Error(prefError.message);
}
