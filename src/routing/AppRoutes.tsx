import { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NotFound } from '../components/NotFound';
import { Dashboard } from '../components/Dashboard';
import { TournamentManager } from '../components/TournamentManager';
import { TournamentPage } from '../components/TournamentPage';
import { TeamManager } from '../components/TeamManager';
import { TeamPage } from '../components/TeamPage';
import { PlayerPage } from '../components/PlayerPage';
import { RecentGames } from '../components/RecentGames';
import { ActiveGameBanner } from '../components/ActiveGameBanner';
import { GameSetup } from '../components/GameSetup';
import { LiveGameEntry } from '../components/LiveGameEntry';
import { getActiveGame } from '../utils/activeGame';
import { sortGamesByDateDesc } from '../utils/gameDisplay';
import { GameSummary } from '../components/GameSummary';
import type { Game, Team, Tournament, Player, CreateTeamOptions } from '../App';
import type { TournamentRosterEntry } from '../utils/tournamentRosters';
import type { TournamentJerseyUpdate } from '../utils/playerJerseyResolution';
import { parseSlugId, slugify } from './slugs';
import {
  gamePath,
  liveGamePath,
  paths,
  playerPath,
  teamPath,
  tournamentPath,
} from './paths';
import { parsePlayerTab, parseTeamTab, parseTournamentTab, type PlayerTab, type TeamTab, type TournamentTab } from './tabs';
import { parseGameFormatScope } from '../utils/gameFormat';
import { parseTournamentSelection } from '../utils/tournamentSelection';
import {
  currentLocationPath,
  navigateBack,
  navigateWithReturnTo,
} from './navigation';

export interface AppRoutesProps {
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  orphanPlayers: Player[];
  tournamentRosters: TournamentRosterEntry[];
  currentGame: Game | null;
  setCurrentGame: (game: Game | null) => void;
  onCreateTournament: (data: Omit<Tournament, 'id'>) => void;
  onUpdateTournament: (tournament: Tournament) => void;
  onDeleteTournament: (tournamentId: string) => void;
  onCreateTeam: (data: Omit<Team, 'id'>, options?: CreateTeamOptions) => Team;
  onUpdateTeam: (team: Team) => void;
  onUpdateTournamentRosters: (entries: TournamentRosterEntry[]) => void;
  onUpdatePlayerProfile: (
    playerId: string,
    profilePatch: Pick<
      Player,
      | 'name'
      | 'position'
      | 'secondaryPosition'
      | 'height'
      | 'weight'
      | 'age'
      | 'dateOfBirth'
    >,
    jerseyByTeamId: Record<string, number>,
    tournamentJerseyUpdates?: TournamentJerseyUpdate[]
  ) => void;
  onDeleteTeam: (teamId: string) => void;
  onAddTeamToTournament: (teamId: string, tournamentId: string) => void;
  onGameStart: (game: Game) => boolean;
  onGameUpdate: (game: Game) => void;
  onGameComplete: (game: Game) => void;
  onDeleteActiveGame: (gameId: string) => void;
}

function findPlayer(teams: Team[], playerId: string): { player: Player; team: Team } | null {
  for (const team of teams) {
    if (!team.players?.length) continue;
    const player = team.players.find((p) => p.id === playerId);
    if (player) return { player, team };
  }
  return null;
}

function TournamentDetailRoute({
  tournaments,
  teams,
  games,
  tournamentRosters,
  onCreateTeam,
  onAddTeamToTournament,
  onUpdateTeam,
  onUpdateTournament,
  onDeleteTeam,
}: AppRoutesProps) {
  const { slugId } = useParams<{ slugId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const parsed = slugId ? parseSlugId(slugId) : null;
  const tournament = parsed ? tournaments.find((t) => t.id === parsed.id) : undefined;

  if (!parsed || !tournament) {
    return <NotFound />;
  }

  const tab = parseTournamentTab(searchParams.get('tab'));
  const canonical = tournamentPath(tournament, tab);

  if (parsed.slug !== slugify(tournament.name)) {
    return <Navigate to={canonical} replace />;
  }

  const handleTabChange = (nextTab: TournamentTab) => {
    const target = tournamentPath(tournament, nextTab);
    const current = `${location.pathname}${location.search}`;
    if (target !== current) {
      navigate(target);
    }
  };

  const returnTo = currentLocationPath(location);

  return (
    <TournamentPage
      tournament={tournament}
      teams={teams}
      games={games}
      tournamentRosters={tournamentRosters}
      activeTab={tab}
      onTabChange={handleTabChange}
      onBack={() => navigateBack(navigate, location, paths.tournaments)}
      onNavigateToTeam={(teamId) => {
        const team = teams.find((t) => t.id === teamId);
        if (team) navigateWithReturnTo(navigate, teamPath(team), returnTo);
      }}
      onNavigateToPlayer={(playerId, teamId) => {
        const found = findPlayer(teams, playerId);
        if (found) navigateWithReturnTo(navigate, playerPath(found.player), returnTo);
        else if (teamId) {
          const team = teams.find((t) => t.id === teamId);
          const player = team?.players.find((p) => p.id === playerId);
          if (player) navigateWithReturnTo(navigate, playerPath(player), returnTo);
        }
      }}
      onNavigateToGame={(gameId) =>
        navigateWithReturnTo(navigate, gamePath(gameId), returnTo)
      }
      onCreateTeam={onCreateTeam}
      onAddTeamToTournament={onAddTeamToTournament}
      onUpdateTeam={onUpdateTeam}
      onUpdateTournament={onUpdateTournament}
      onDeleteTeam={onDeleteTeam}
    />
  );
}

function TeamDetailRoute({
  teams,
  games,
  tournaments,
  orphanPlayers,
  tournamentRosters,
  onUpdateTeam,
  onUpdateTournamentRosters,
}: AppRoutesProps) {
  const { slugId } = useParams<{ slugId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const parsed = slugId ? parseSlugId(slugId) : null;
  const team = parsed ? teams.find((t) => t.id === parsed.id) : undefined;

  if (!parsed || !team) {
    return <NotFound />;
  }

  const tab = parseTeamTab(searchParams.get('tab'));
  const gameFormatScope = parseGameFormatScope(searchParams.get('format'));
  const tournamentIds = parseTournamentSelection(searchParams.get('tournaments'));
  const statsQuery = { gameFormatScope, tournamentIds };
  const canonical = teamPath(team, tab, statsQuery);

  if (parsed.slug !== slugify(team.name)) {
    return <Navigate to={canonical} replace />;
  }

  const handleTabChange = (nextTab: TeamTab) => {
    const target = teamPath(team, nextTab, statsQuery);
    const current = `${location.pathname}${location.search}`;
    if (target !== current) {
      navigate(target);
    }
  };

  const returnTo = currentLocationPath(location);

  return (
    <ErrorBoundary>
      <TeamPage
        team={team}
        teams={teams}
        games={games}
        tournaments={tournaments}
        orphanPlayers={orphanPlayers}
        tournamentRosters={tournamentRosters}
        activeTab={tab}
        onTabChange={handleTabChange}
        onBack={() => navigateBack(navigate, location, paths.teams)}
        onNavigateToPlayer={(playerId, teamIdHint) => {
          const found = findPlayer(teams, playerId);
          if (found) navigateWithReturnTo(navigate, playerPath(found.player), returnTo);
          else {
            const t = teams.find((x) => x.id === (teamIdHint || team.id));
            const player = t?.players.find((p) => p.id === playerId);
            if (player) navigateWithReturnTo(navigate, playerPath(player), returnTo);
          }
        }}
        onNavigateToGame={(gameId) =>
          navigateWithReturnTo(navigate, gamePath(gameId), returnTo)
        }
        onNavigateToTournament={(tournamentId) => {
          const tournament = tournaments.find((t) => t.id === tournamentId);
          if (tournament) {
            navigateWithReturnTo(navigate, tournamentPath(tournament), returnTo);
          }
        }}
        onUpdateTeam={onUpdateTeam}
        onUpdateTournamentRosters={onUpdateTournamentRosters}
      />
    </ErrorBoundary>
  );
}

function PlayerDetailRoute({
  teams,
  games,
  tournaments,
  tournamentRosters,
  onUpdatePlayerProfile,
}: Pick<
  AppRoutesProps,
  'teams' | 'games' | 'tournaments' | 'tournamentRosters' | 'onUpdatePlayerProfile'
>) {
  const { slugId } = useParams<{ slugId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const parsed = slugId ? parseSlugId(slugId) : null;
  const found = parsed ? findPlayer(teams, parsed.id) : null;

  if (!parsed || !found) {
    return <NotFound />;
  }

  const { player, team } = found;
  const tab = parsePlayerTab(searchParams.get('tab'));
  const gameFormatScope = parseGameFormatScope(searchParams.get('format'));
  const tournamentIds = parseTournamentSelection(searchParams.get('tournaments'));
  const statsQuery = { gameFormatScope, tournamentIds };
  const canonical = playerPath(player, tab, statsQuery);

  if (parsed.slug !== slugify(player.name)) {
    return <Navigate to={canonical} replace />;
  }

  const handleTabChange = (nextTab: PlayerTab) => {
    const target = playerPath(player, nextTab, statsQuery);
    const current = `${location.pathname}${location.search}`;
    if (target !== current) {
      navigate(target);
    }
  };

  const returnTo = currentLocationPath(location);

  return (
    <ErrorBoundary>
      <PlayerPage
        player={player}
        team={team}
        teams={teams}
        games={games}
        tournaments={tournaments}
        tournamentRosters={tournamentRosters}
        activeTab={tab}
        onTabChange={handleTabChange}
        onBack={() => navigateBack(navigate, location, teamPath(team))}
        onNavigateToTeam={(teamId) => {
          const t = teams.find((x) => x.id === teamId);
          if (t) navigateWithReturnTo(navigate, teamPath(t), returnTo);
        }}
        onNavigateToGame={(gameId) =>
          navigateWithReturnTo(navigate, gamePath(gameId), returnTo)
        }
        onNavigateToTournament={(tournamentId) => {
          const tournament = tournaments.find((t) => t.id === tournamentId);
          if (tournament) {
            navigateWithReturnTo(navigate, tournamentPath(tournament), returnTo);
          }
        }}
        onUpdatePlayerProfile={onUpdatePlayerProfile}
      />
    </ErrorBoundary>
  );
}

function GameSummaryRoute({
  games,
  teams,
  tournaments,
  onGameUpdate,
}: Pick<AppRoutesProps, 'games' | 'teams' | 'tournaments' | 'onGameUpdate'>) {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const game = gameId ? games.find((g) => g.id === gameId) : undefined;

  if (!gameId || !game) {
    return <NotFound />;
  }

  const returnTo = currentLocationPath(location);

  return (
    <GameSummary
      game={game}
      tournaments={tournaments}
      onBack={() => navigateBack(navigate, location, paths.home)}
      onGameUpdate={onGameUpdate}
      onNavigateToPlayer={(playerId, teamIdHint) => {
        const found = findPlayer(teams, playerId);
        if (found) {
          navigateWithReturnTo(navigate, playerPath(found.player), returnTo);
          return;
        }
        const team = teams.find((t) => t.id === teamIdHint);
        const player = team?.players.find((p) => p.id === playerId);
        if (player) {
          navigateWithReturnTo(navigate, playerPath(player), returnTo);
        }
      }}
      onNavigateToTeam={(teamId) => {
        const team = teams.find((t) => t.id === teamId);
        if (team) {
          navigateWithReturnTo(navigate, teamPath(team), returnTo);
        }
      }}
    />
  );
}

function LiveGameRoute({
  games,
  tournaments,
  currentGame,
  setCurrentGame,
  onGameUpdate,
  onGameComplete,
  onDeleteActiveGame,
}: AppRoutesProps) {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const persistedActive =
    gameId != null
      ? games.find((g) => g.id === gameId && g.isActive && !g.isCompleted)
      : undefined;

  const liveGame =
    currentGame?.id === gameId ? currentGame : persistedActive;

  useEffect(() => {
    if (persistedActive && currentGame?.id !== gameId) {
      setCurrentGame(persistedActive);
    }
  }, [persistedActive, currentGame?.id, gameId, setCurrentGame]);

  if (!gameId || !liveGame) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Live game session not found or expired.</p>
        <Button variant="outline" onClick={() => navigate(paths.home)}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(paths.home)}>
        ← Back to Dashboard
      </Button>
      <LiveGameEntry
        game={liveGame}
        tournaments={tournaments}
        onGameUpdate={onGameUpdate}
        onGameComplete={onGameComplete}
        onDeleteGame={() => {
          onDeleteActiveGame(liveGame.id);
          navigate(paths.statsEntry);
        }}
      />
    </div>
  );
}

export function AppRoutes(props: AppRoutesProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    teams,
    tournaments,
    games,
    currentGame,
    setCurrentGame,
    onCreateTournament,
    onUpdateTournament,
    onDeleteTournament,
    onCreateTeam,
    onUpdateTeam,
    onDeleteTeam,
    onAddTeamToTournament,
    onGameStart,
    onGameUpdate,
    onGameComplete,
    onDeleteActiveGame,
  } = props;

  const activeGame = useMemo(
    () => getActiveGame(games, currentGame),
    [games, currentGame]
  );

  const returnTo = currentLocationPath(location);

  const navigateToTournament = (tournamentId: string, tab: TournamentTab = 'home') => {
    const tournament = tournaments.find((t) => t.id === tournamentId);
    if (!tournament) return;
    const target = tournamentPath(tournament, tab);
    const current = returnTo;
    if (target !== current) navigateWithReturnTo(navigate, target, returnTo);
  };

  const navigateToTeam = (teamId: string, tab: TeamTab = 'overview') => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    const target = teamPath(team, tab);
    const current = returnTo;
    if (target !== current) navigateWithReturnTo(navigate, target, returnTo);
  };

  const handleGameStart = (game: Game): boolean => {
    const started = onGameStart(game);
    if (started) {
      navigate(liveGamePath(game.id));
    }
    return started;
  };

  return (
    <Routes>
      <Route
        path={paths.home}
        element={
          <Dashboard
            tournaments={tournaments}
            teams={teams}
            recentGames={sortGamesByDateDesc(games.filter((g) => g.isCompleted)).slice(0, 10)}
            onNavigateToTournaments={() => navigate(paths.tournaments)}
            onNavigateToTeams={() => navigate(paths.teams)}
            onNavigateToGameSummary={(game) =>
              navigateWithReturnTo(navigate, gamePath(game.id), returnTo)
            }
            onStartNewGame={() => navigate(paths.statsEntry)}
            onNavigateToTournament={navigateToTournament}
            onNavigateToTeam={navigateToTeam}
            onNavigateToRecentGames={() => navigate(paths.games)}
          />
        }
      />

      <Route
        path={paths.tournaments}
        element={
          <TournamentManager
            tournaments={tournaments}
            teams={teams}
            onCreateTournament={onCreateTournament}
            onUpdateTournament={onUpdateTournament}
            onDeleteTournament={onDeleteTournament}
            onBack={() => navigate(paths.home)}
            onNavigateToTournament={navigateToTournament}
          />
        }
      />

      <Route path="/tournaments/:slugId" element={<TournamentDetailRoute {...props} />} />

      <Route
        path={paths.teams}
        element={
          <TeamManager
            teams={teams}
            tournaments={tournaments}
            games={games}
            onCreateTeam={onCreateTeam}
            onUpdateTeam={onUpdateTeam}
            onDeleteTeam={onDeleteTeam}
            onBack={() => navigate(paths.home)}
            onNavigateToTeam={navigateToTeam}
          />
        }
      />

      <Route path="/teams/:slugId" element={<TeamDetailRoute {...props} />} />

      <Route path="/players/:slugId" element={<PlayerDetailRoute {...props} />} />

      <Route
        path={paths.games}
        element={
          <RecentGames
            games={games}
            teams={teams}
            onBack={() => navigate(paths.home)}
            onNavigateToGame={(gameId) => {
              const game = games.find((g) => g.id === gameId);
              if (game?.isActive && !game.isCompleted) {
                setCurrentGame(game);
                navigateWithReturnTo(navigate, liveGamePath(gameId), returnTo);
              } else {
                navigateWithReturnTo(navigate, gamePath(gameId), returnTo);
              }
            }}
            onDeleteActiveGame={onDeleteActiveGame}
          />
        }
      />

      <Route
        path="/games/:gameId"
        element={
          <GameSummaryRoute
            games={games}
            teams={teams}
            tournaments={tournaments}
            onGameUpdate={onGameUpdate}
          />
        }
      />

      <Route
        path={paths.statsEntry}
        element={
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(paths.home)}>
              ← Back to Dashboard
            </Button>
            {activeGame ? (
              <ActiveGameBanner
                game={activeGame}
                tournament={tournaments.find((t) => t.id === activeGame.tournamentId)}
                onResume={() => navigate(liveGamePath(activeGame.id))}
              />
            ) : (
              <GameSetup
                tournaments={tournaments}
                teams={teams}
                onGameStart={handleGameStart}
                onCreateTeam={onCreateTeam}
                onUpdateTeam={onUpdateTeam}
              />
            )}
          </div>
        }
      />

      <Route path="/live/:gameId" element={<LiveGameRoute {...props} />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
