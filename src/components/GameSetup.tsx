import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Team,
  Player,
  Game,
  Tournament,
  TeamStats,
  type SetupRosterChange,
} from "../App";
import { Plus, Trash2, Users, Calendar, Clock } from "lucide-react";
import { SortableRosterList } from "./gameSetup/SortableRosterList";
import {
  SearchableTeamSelect,
  type TeamSelectOption,
} from "./gameSetup/SearchableTeamSelect";
import { GameStageTagFields } from "./GameStageTagFields";
import { addedPlayersFromBaseline } from "../utils/activeGame";
import { sortTournamentsByDateDesc } from "../utils/tournamentSort";
import {
  generateTeamAbbreviation,
  hasDuplicateJerseyNumbers,
  isValidTeamAbbreviation,
  normalizeTeamAbbreviation,
} from "../utils/teamAbbreviation";
import {
  getPlayersForTeamInTournament,
  type TournamentRosterEntry,
} from "../utils/tournamentRosters";
import {
  defaultClockForTournament,
  formatPeriodClock,
  type GameClockSettings,
} from "../utils/gameClock";
import {
  isOppIdentityReady,
  oppTournamentTeamsExcludingHome,
  toIdentityOnlyAwayTeam,
} from "../utils/singleTeamAwayIdentity";
import {
  STATS_ENTRY_PREFILL_STATE_KEY,
  type StatsEntryPrefill,
} from "../routing/statsEntryPrefill";

const CREATE_NEW_TEAM_VALUE = "__create_new__";
const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
const MIN_PLAYERS = 5;

type TeamSide = "home" | "away";
type TeamSelectionMode = "none" | "existing" | "create_new";

interface GameSetupProps {
  tournaments: Tournament[];
  teams: Team[];
  games?: Game[];
  tournamentRosters: TournamentRosterEntry[];
  prefill?: StatsEntryPrefill | null;
  onGameStart: (game: Game) => boolean;
  onCreateTeam: (team: Omit<Team, "id">) => Team;
  onUpdateTeam: (team: Team) => void;
}

function sortPlayersByNumber(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) => a.number - b.number || a.name.localeCompare(b.name)
  );
}

function countTournamentRoster(
  teamId: string,
  tournamentId: string,
  rosters: TournamentRosterEntry[]
): number {
  return rosters.filter(
    (r) => r.tournamentId === tournamentId && r.teamId === teamId
  ).length;
}

function starterIds(players: Player[]): string[] {
  return players.slice(0, MIN_PLAYERS).map((p) => p.id);
}

function draftTeam(side: TeamSide): Team {
  return {
    id: side,
    name: "",
    abbreviation: "",
    players: [],
  };
}

function emptyTeamStats(teamId: string): TeamStats {
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

interface TeamSidePanelProps {
  side: TeamSide;
  mode: TeamSelectionMode;
  team: Team;
  tournamentTeams: Team[];
  tournamentId: string;
  tournamentRosters: TournamentRosterEntry[];
  takenAbbreviations: string[];
  newPlayerPosition: string;
  isEditingThisSide: boolean;
  showStarterOrder: boolean;
  /** Friendly setup: club roster instead of tournament roster. */
  clubRosterMode?: boolean;
  /** Friendly triage: players excluded from this game (not embedded on start). */
  inactivePlayers?: Player[];
  onModeChange: (mode: TeamSelectionMode) => void;
  onTeamChange: (team: Team) => void;
  onSelectExisting: (teamId: string) => void;
  onEditingSideChange: () => void;
  onNewPlayerPositionChange: (value: string) => void;
  onAddPlayer: (name: string, number: string) => boolean;
  onPersistTeam: (team: Team) => void;
  onReorderPlayers: (players: Player[]) => void;
  onTriageChange?: (active: Player[], inactive: Player[]) => void;
}

const TeamSidePanel = React.memo(function TeamSidePanel({
  side,
  mode,
  team,
  tournamentTeams,
  tournamentId,
  tournamentRosters,
  takenAbbreviations,
  newPlayerPosition,
  isEditingThisSide,
  showStarterOrder,
  clubRosterMode = false,
  inactivePlayers = [],
  onModeChange,
  onTeamChange,
  onSelectExisting,
  onEditingSideChange,
  onNewPlayerPositionChange,
  onAddPlayer,
  onPersistTeam,
  onReorderPlayers,
  onTriageChange,
}: TeamSidePanelProps) {
  const playerNameRef = useRef<HTMLInputElement>(null);
  const playerNumberRef = useRef<HTMLInputElement>(null);
  const [removePlayerTarget, setRemovePlayerTarget] = useState<Player | null>(null);

  const triageEnabled = clubRosterMode && onTriageChange != null;
  const rosterTotal = team.players.length + (triageEnabled ? inactivePlayers.length : 0);

  const selectValue =
    mode === "create_new"
      ? CREATE_NEW_TEAM_VALUE
      : mode === "existing"
        ? team.id
        : "";

  const handleDropdownChange = (value: string) => {
    if (value === CREATE_NEW_TEAM_VALUE) {
      onModeChange("create_new");
      onTeamChange(draftTeam(side));
      return;
    }
    onSelectExisting(value);
  };

  const handleAddPlayerClick = () => {
    const name = playerNameRef.current?.value?.trim() ?? "";
    const number = playerNumberRef.current?.value?.trim() ?? "";
    if (!name || !number || !newPlayerPosition) return;
    const ok = onAddPlayer(name, number);
    if (ok) {
      if (playerNameRef.current) playerNameRef.current.value = "";
      if (playerNumberRef.current) playerNumberRef.current.value = "";
    }
  };

  const canAddPlayers = mode === "create_new";
  const rosterHasDupes = hasDuplicateJerseyNumbers([
    ...team.players,
    ...(triageEnabled ? inactivePlayers : []),
  ]);
  const rosterLabel =
    mode === "existing"
      ? clubRosterMode
        ? triageEnabled && inactivePlayers.length > 0
          ? `${team.name} — Game day (${team.players.length} in / ${inactivePlayers.length} inactive)`
          : `${team.name} — Club roster (${team.players.length})`
        : `${team.name} — Tournament roster (${team.players.length})`
      : `${team.name} — Players (${team.players.length})`;

  const teamSelectOptions = useMemo((): TeamSelectOption[] => {
    return tournamentTeams.map((t) => {
      const rosterSize = clubRosterMode
        ? t.players.length
        : countTournamentRoster(t.id, tournamentId, tournamentRosters);
      const label = clubRosterMode
        ? `${t.name} (${rosterSize}${rosterSize === 1 ? " player" : " players"})`
        : `${t.name} (${rosterSize} tournament${
            rosterSize === 1 ? " player" : " players"
          })`;
      return {
        id: t.id,
        label,
        searchTerms: `${t.name} ${t.abbreviation}`,
      };
    });
  }, [clubRosterMode, tournamentId, tournamentRosters, tournamentTeams]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Team</Label>
        <SearchableTeamSelect
          value={selectValue}
          onValueChange={handleDropdownChange}
          options={teamSelectOptions}
          placeholder="Select a team"
          searchPlaceholder="Search teams…"
          createNewValue={CREATE_NEW_TEAM_VALUE}
        />
      </div>

      {mode === "create_new" && (
        <div className="space-y-2">
          <Label htmlFor={`${side}-team-name`}>Team name</Label>
          <Input
            id={`${side}-team-name`}
            placeholder="Enter team name"
            value={team.name}
            onChange={(e) => {
              const name = e.target.value;
              onTeamChange({
                ...team,
                name,
                abbreviation: name.trim()
                  ? generateTeamAbbreviation(name, takenAbbreviations)
                  : "",
              });
            }}
          />
          {team.abbreviation && (
            <p className="text-xs text-muted-foreground">
              Abbreviation: {team.abbreviation}
            </p>
          )}
        </div>
      )}

      {mode !== "none" && team.name && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{rosterLabel}</h4>
            {mode === "existing" && (
              <Badge variant="secondary" className="text-xs">
                {clubRosterMode ? "Club roster" : "Tournament roster"}
              </Badge>
            )}
            {mode === "create_new" && (
              <Badge variant="outline" className="text-xs">
                New team
              </Badge>
            )}
          </div>

          {mode === "existing" && team.players.length === 0 && (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
              {clubRosterMode
                ? "No players on this club roster yet. Create a new team or add players on the Team page, then return here."
                : "No players registered for this team in the selected tournament. Add them on the Team page under the tournament roster, then return here."}
            </p>
          )}

          {showStarterOrder && team.players.length >= MIN_PLAYERS && (
            <p className="text-xs text-muted-foreground">
              {triageEnabled
                ? `Drag to set starting five (top ${MIN_PLAYERS}). Drag to Inactive to leave players off this game.`
                : `Drag to set starting five — top ${MIN_PLAYERS} are on court at tip-off.`}
            </p>
          )}

          {rosterHasDupes && (
            <p className="text-sm text-destructive">
              Duplicate jersey numbers are not allowed on the same team.
            </p>
          )}

          {team.players.length < MIN_PLAYERS && (
            <p className="text-sm text-muted-foreground">
              Add at least {MIN_PLAYERS} players to start ({MIN_PLAYERS - team.players.length} more needed).
            </p>
          )}

          {canAddPlayers && (
            <div className="space-y-3">
              <Label className="text-sm">Add player</Label>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Input
                    ref={playerNameRef}
                    placeholder="Name"
                    onFocus={onEditingSideChange}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    ref={playerNumberRef}
                    placeholder="No."
                    type="number"
                    min={0}
                    max={99}
                    onFocus={onEditingSideChange}
                  />
                </div>
                <div className="col-span-3">
                  <Select
                    value={isEditingThisSide ? newPlayerPosition : ""}
                    onValueChange={onNewPlayerPositionChange}
                    onOpenChange={() => onEditingSideChange()}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pos" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {pos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    onClick={handleAddPlayerClick}
                    disabled={!isEditingThisSide || !newPlayerPosition}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {rosterTotal === 0 ? (
            mode === "create_new" ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No players yet
              </p>
            ) : null
          ) : (
            <SortableRosterList
              players={team.players}
              starterCount={MIN_PLAYERS}
              sortable={showStarterOrder}
              onReorder={onReorderPlayers}
              inactivePlayers={triageEnabled ? inactivePlayers : undefined}
              onTriageChange={triageEnabled ? onTriageChange : undefined}
              renderTrailing={
                canAddPlayers
                  ? (player) => (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => setRemovePlayerTarget(player)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )
                  : undefined
              }
            />
          )}
        </div>
      )}

      {mode === "none" && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Select an existing team or create a new one.
        </p>
      )}

      <AlertDialog
        open={removePlayerTarget != null}
        onOpenChange={(open) => {
          if (!open) setRemovePlayerTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removePlayerTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remove this player from the draft roster? The game has not started yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removePlayerTarget) {
                  const id = removePlayerTarget.id;
                  if (triageEnabled && onTriageChange) {
                    onTriageChange(
                      team.players.filter((p) => p.id !== id),
                      inactivePlayers.filter((p) => p.id !== id)
                    );
                  } else {
                    onTeamChange({
                      ...team,
                      players: team.players.filter((p) => p.id !== id),
                    });
                  }
                }
                setRemovePlayerTarget(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

/** Single-team Opp: tournament team pick or create name+abbrev (no logo, no roster). */
interface OppIdentityPanelProps {
  mode: TeamSelectionMode;
  team: Team;
  tournamentTeams: Team[];
  takenAbbreviations: string[];
  onModeChange: (mode: TeamSelectionMode) => void;
  onTeamChange: (team: Team) => void;
  onSelectExisting: (teamId: string) => void;
}

const OppIdentityPanel = React.memo(function OppIdentityPanel({
  mode,
  team,
  tournamentTeams,
  takenAbbreviations,
  onModeChange,
  onTeamChange,
  onSelectExisting,
}: OppIdentityPanelProps) {
  const selectValue =
    mode === "create_new"
      ? CREATE_NEW_TEAM_VALUE
      : mode === "existing"
        ? team.id
        : "";

  const abbrevNormalized = normalizeTeamAbbreviation(team.abbreviation);
  const abbrevTaken =
    mode === "create_new" &&
    abbrevNormalized.length >= 2 &&
    takenAbbreviations.some((a) => a.toUpperCase() === abbrevNormalized);

  const handleDropdownChange = (value: string) => {
    if (value === CREATE_NEW_TEAM_VALUE) {
      onModeChange("create_new");
      onTeamChange(draftTeam("away"));
      return;
    }
    onSelectExisting(value);
  };

  const opponentSelectOptions = useMemo((): TeamSelectOption[] => {
    return tournamentTeams.map((t) => ({
      id: t.id,
      label: `${t.name} (${t.abbreviation})`,
      searchTerms: `${t.name} ${t.abbreviation}`,
    }));
  }, [tournamentTeams]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Opponent is tracked as a single unit. Only your team&apos;s individual
        stats are recorded. Pick a club for the scoreboard, or create one with a
        name and abbreviation.
      </p>

      <div className="space-y-2">
        <Label>Opponent team</Label>
        <SearchableTeamSelect
          value={selectValue}
          onValueChange={handleDropdownChange}
          options={opponentSelectOptions}
          placeholder="Select a tournament team"
          searchPlaceholder="Search opponent teams…"
          createNewValue={CREATE_NEW_TEAM_VALUE}
        />
      </div>

      {mode === "create_new" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="opp-team-name">Name</Label>
            <Input
              id="opp-team-name"
              placeholder="e.g. Lakers"
              value={team.name}
              onChange={(e) => {
                const name = e.target.value;
                onTeamChange({
                  ...team,
                  name,
                  abbreviation: team.abbreviation.trim()
                    ? team.abbreviation
                    : name.trim()
                      ? generateTeamAbbreviation(name, takenAbbreviations)
                      : "",
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opp-team-abbrev">Abbreviation</Label>
            <Input
              id="opp-team-abbrev"
              placeholder="e.g. LAL"
              value={team.abbreviation}
              maxLength={5}
              onChange={(e) =>
                onTeamChange({
                  ...team,
                  abbreviation: normalizeTeamAbbreviation(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              2–5 letters or numbers. No logo needed for opponent identity.
            </p>
            {team.abbreviation && !isValidTeamAbbreviation(team.abbreviation) && (
              <p className="text-sm text-destructive">
                Abbreviation must be 2–5 characters.
              </p>
            )}
            {abbrevTaken && (
              <p className="text-sm text-destructive">
                That abbreviation is already used. Choose another.
              </p>
            )}
          </div>
        </div>
      )}

      {mode === "existing" && team.name && (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
          {team.name} ({team.abbreviation}) — identity only for this game (no
          opponent player stats).
        </p>
      )}

      {mode === "none" && (
        <p className="text-sm text-muted-foreground py-2 text-center">
          Select a tournament team or create a new one.
        </p>
      )}
    </div>
  );
});

export function GameSetup({
  tournaments,
  teams,
  games = [],
  tournamentRosters,
  prefill: prefillProp,
  onGameStart,
  onCreateTeam,
  onUpdateTeam,
}: GameSetupProps) {
  const location = useLocation();
  const prefill =
    prefillProp ??
    ((location.state as Record<string, unknown> | null)?.[
      STATS_ENTRY_PREFILL_STATE_KEY
    ] as StatsEntryPrefill | undefined);

  const [fixtureGameId, setFixtureGameId] = useState<string | null>(
    prefill?.gameId ?? null
  );
  const sortedTournaments = useMemo(
    () => sortTournamentsByDateDesc(tournaments),
    [tournaments]
  );

  const [tournamentId, setTournamentId] = useState("");
  const [isFriendly, setIsFriendly] = useState(false);
  const [trackBothTeams, setTrackBothTeams] = useState(true);
  const [gameDate, setGameDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState("");
  const [clockSettings, setClockSettings] = useState<GameClockSettings>(() =>
    defaultClockForTournament("", null)
  );
  const [homeMode, setHomeMode] = useState<TeamSelectionMode>("none");
  const [awayMode, setAwayMode] = useState<TeamSelectionMode>("none");
  const [homeTeam, setHomeTeam] = useState<Team>(() => draftTeam("home"));
  const [awayTeam, setAwayTeam] = useState<Team>(() => draftTeam("away"));
  /** Friendly triage: excluded from game snapshot (club-only). */
  const [homeInactive, setHomeInactive] = useState<Player[]>([]);
  const [awayInactive, setAwayInactive] = useState<Player[]>([]);
  const [stageId, setStageId] = useState<string | undefined>();
  const [groupId, setGroupId] = useState<string | undefined>();

  const [newPlayerPosition, setNewPlayerPosition] = useState("");
  const [editingSide, setEditingSide] = useState<TeamSide>("home");
  const [startBlockedMessage, setStartBlockedMessage] = useState<string | null>(
    null
  );
  /** Player ids on each existing team when it was selected (setup-only adds tracked). */
  const rosterBaselineRef = useRef<Record<string, string[]>>({});

  useEffect(() => {
    if (!prefill) return;
    setFixtureGameId(prefill.gameId);
    if (prefill.tournamentId) setTournamentId(prefill.tournamentId);
    if (prefill.date) setGameDate(prefill.date);
    if (prefill.startTime) setStartTime(prefill.startTime);
    if (prefill.stageId) setStageId(prefill.stageId);
    if (prefill.groupId) setGroupId(prefill.groupId);
    setIsFriendly(false);
    setTrackBothTeams(true);

    const homeDb = teams.find((t) => t.id === prefill.homeTeamId);
    const awayDb = teams.find((t) => t.id === prefill.awayTeamId);
    if (homeDb) {
      setHomeMode("existing");
      setHomeTeam({ ...homeDb, players: [...homeDb.players] });
      rosterBaselineRef.current[homeDb.id] = homeDb.players.map((p) => p.id);
    }
    if (awayDb) {
      setAwayMode("existing");
      setAwayTeam({ ...awayDb, players: [...awayDb.players] });
      rosterBaselineRef.current[awayDb.id] = awayDb.players.map((p) => p.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot fixture prefill
  }, [prefill?.gameId]);

  useEffect(() => {
    if (prefill) return;
    if (isFriendly) return;
    if (!tournamentId && sortedTournaments.length > 0) {
      setTournamentId(sortedTournaments[0].id);
    }
  }, [sortedTournaments, tournamentId, isFriendly, prefill]);

  const tournament = useMemo(
    () => tournaments.find((t) => t.id === tournamentId),
    [tournaments, tournamentId]
  );

  const tournamentTeams = useMemo(() => {
    if (!tournament) return [];
    const ids = new Set(tournament.teams);
    return teams
      .filter((t) => ids.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, tournament]);

  /** Friendly: any club; official: tournament-enrolled teams only. */
  const availableTeams = useMemo(() => {
    if (!isFriendly) return tournamentTeams;
    return [...teams].sort((a, b) => a.name.localeCompare(b.name));
  }, [isFriendly, teams, tournamentTeams]);

  useEffect(() => {
    if (isFriendly) return;
    if (tournament) {
      setClockSettings(defaultClockForTournament(tournament.id, tournament));
    }
  }, [tournament?.id, tournament?.gameFormat, isFriendly]);

  const takenAbbreviations = useMemo(
    () => teams.map((t) => t.abbreviation).filter(Boolean),
    [teams]
  );

  const resetSidesForTournament = useCallback(() => {
    setHomeMode("none");
    setAwayMode("none");
    setHomeTeam(draftTeam("home"));
    setAwayTeam(draftTeam("away"));
    setHomeInactive([]);
    setAwayInactive([]);
    rosterBaselineRef.current = {};
  }, []);

  const handleTournamentChange = (id: string) => {
    setTournamentId(id);
    setStageId(undefined);
    setGroupId(undefined);
    resetSidesForTournament();
  };

  const oppTeamsForPicker = useMemo(
    () =>
      oppTournamentTeamsExcludingHome(availableTeams, homeMode, homeTeam.id),
    [availableTeams, homeMode, homeTeam.id]
  );

  const selectExistingTeam = useCallback(
    (teamId: string, side: TeamSide) => {
      const selected = availableTeams.find((t) => t.id === teamId);
      if (!selected) return;
      if (!isFriendly && !tournamentId) return;

      const rosterPlayers = sortPlayersByNumber(
        isFriendly
          ? [...(selected.players ?? [])]
          : getPlayersForTeamInTournament(
              teamId,
              tournamentId,
              teams,
              tournamentRosters
            )
      );
      const copy: Team = {
        ...selected,
        players: rosterPlayers,
      };
      rosterBaselineRef.current[selected.id] = rosterPlayers.map((p) => p.id);
      if (side === "home") {
        setHomeMode("existing");
        setHomeTeam(copy);
        setHomeInactive([]);
        if (awayMode === "existing" && awayTeam.id === teamId) {
          setAwayMode("none");
          setAwayTeam(draftTeam("away"));
          setAwayInactive([]);
        }
      } else {
        setAwayMode("existing");
        setAwayTeam(copy);
        setAwayInactive([]);
      }
    },
    [
      availableTeams,
      isFriendly,
      tournamentId,
      teams,
      tournamentRosters,
      awayMode,
      awayTeam.id,
    ]
  );

  const selectOppIdentityTeam = useCallback(
    (teamId: string) => {
      const selected = availableTeams.find((t) => t.id === teamId);
      if (!selected) return;
      if (homeMode === "existing" && homeTeam.id === teamId) return;
      setAwayMode("existing");
      setAwayTeam(toIdentityOnlyAwayTeam(selected));
    },
    [availableTeams, homeMode, homeTeam.id]
  );

  const reorderPlayers = useCallback(
    (side: TeamSide, players: Player[]) => {
      const apply = (prev: Team): Team => ({ ...prev, players });
      if (side === "home") setHomeTeam(apply);
      else setAwayTeam((prev) => ({ ...prev, players }));
    },
    []
  );

  const triagePlayers = useCallback(
    (side: TeamSide, active: Player[], inactive: Player[]) => {
      if (side === "home") {
        setHomeTeam((prev) => ({ ...prev, players: active }));
        setHomeInactive(inactive);
      } else {
        setAwayTeam((prev) => ({ ...prev, players: active }));
        setAwayInactive(inactive);
      }
    },
    []
  );

  const makePlayer = (name: string, numberStr: string, side: TeamSide): Player | null => {
    const number = parseInt(numberStr, 10);
    if (Number.isNaN(number) || number < 0 || number > 99) return null;
    return {
      id: `${side}-player-${Date.now()}-${number}`,
      name: name.trim(),
      number,
      position: newPlayerPosition,
      height: "",
      weight: "",
      age: 0,
    };
  };

  const addPlayerToSide = useCallback(
    (side: TeamSide, name: string, numberStr: string): boolean => {
      const player = makePlayer(name, numberStr, side);
      if (!player) return false;

      const apply = (prev: Team): Team | null => {
        if (prev.players.some((p) => p.number === player.number)) return null;
        // Setup-only: never persist existing-team roster edits to global club roster.
        return { ...prev, players: [...prev.players, player] };
      };

      if (side === "home") {
        const next = apply(homeTeam);
        if (!next) return false;
        setHomeTeam(next);
      } else {
        const next = apply(awayTeam);
        if (!next) return false;
        setAwayTeam(next);
      }
      setNewPlayerPosition("");
      return true;
    },
    [homeTeam, awayTeam, homeMode, awayMode, newPlayerPosition]
  );

  // Existing teams: tournament-filtered setup state only — never onUpdateTeam (club roster).
  const resolveTeamForGame = useCallback(
    (side: TeamSide, mode: TeamSelectionMode, team: Team): Team | null => {
      if (mode === "none" || !team.name.trim()) return null;
      if (team.players.length < MIN_PLAYERS) return null;
      if (hasDuplicateJerseyNumbers(team.players)) return null;

      if (mode === "create_new") {
        const created = onCreateTeam({
          name: team.name.trim(),
          abbreviation:
            team.abbreviation ||
            generateTeamAbbreviation(team.name, takenAbbreviations),
          players: team.players,
          ...(isFriendly || !tournamentId
            ? {}
            : { currentTournamentId: tournamentId }),
        });
        return created;
      }

      if (mode === "existing") {
        return team;
      }
      return null;
    },
    [onCreateTeam, tournamentId, takenAbbreviations, isFriendly]
  );

  const handleStartGame = useCallback(() => {
    if (!gameDate) return;
    if (!isFriendly && !tournamentId) return;

    const setupCreatedTeamIds: string[] = [];
    const setupRosterChanges: SetupRosterChange[] = [];
    const baseline = rosterBaselineRef.current;

    if (homeMode === "existing") {
      const added = addedPlayersFromBaseline(homeTeam, baseline, teams);
      if (added.length > 0) {
        setupRosterChanges.push({ teamId: homeTeam.id, addedPlayerIds: added });
      }
    }

    const resolvedHome = resolveTeamForGame("home", homeMode, homeTeam);
    if (!resolvedHome) return;
    const homeSnapshot = {
      ...resolvedHome,
      players: [...homeTeam.players],
    };

    if (homeMode === "create_new") {
      setupCreatedTeamIds.push(resolvedHome.id);
    }

    let resolvedAway: Team;
    if (trackBothTeams) {
      if (awayMode === "existing") {
        const added = addedPlayersFromBaseline(awayTeam, baseline, teams);
        if (added.length > 0) {
          setupRosterChanges.push({ teamId: awayTeam.id, addedPlayerIds: added });
        }
      }

      const away = resolveTeamForGame("away", awayMode, awayTeam);
      if (!away) return;
      resolvedAway = {
        ...away,
        players: [...awayTeam.players],
      };
      if (awayMode === "create_new") {
        setupCreatedTeamIds.push(resolvedAway.id);
      }
    } else {
      if (!isOppIdentityReady(awayMode, awayTeam)) return;
      if (awayMode === "create_new") {
        const abbrev = normalizeTeamAbbreviation(awayTeam.abbreviation);
        if (
          takenAbbreviations.some((a) => a.toUpperCase() === abbrev)
        ) {
          return;
        }
        const created = onCreateTeam({
          name: awayTeam.name.trim(),
          abbreviation: abbrev,
          players: [],
          ...(isFriendly || !tournamentId
            ? {}
            : { currentTournamentId: tournamentId }),
        });
        resolvedAway = toIdentityOnlyAwayTeam(created);
        setupCreatedTeamIds.push(resolvedAway.id);
      } else {
        resolvedAway = toIdentityOnlyAwayTeam(awayTeam);
      }
    }

    const gameId = fixtureGameId ?? `game-${Date.now()}`;
    const existingFixture = fixtureGameId
      ? games.find((g) => g.id === fixtureGameId)
      : undefined;
    const game: Game = {
      id: gameId,
      homeTeam: homeSnapshot,
      awayTeam: resolvedAway,
      homeTeamId: homeSnapshot.id,
      awayTeamId: resolvedAway.id,
      tournamentId: isFriendly ? undefined : tournamentId,
      stageId: isFriendly ? undefined : stageId,
      groupId: isFriendly ? undefined : groupId,
      date: gameDate,
      startTime: startTime.trim() || undefined,
      clockSettings,
      gameStats: existingFixture?.gameStats ?? [],
      teamStats: existingFixture?.teamStats ?? {
        home: emptyTeamStats(homeSnapshot.id),
        away: emptyTeamStats(resolvedAway.id),
      },
      shots: existingFixture?.shots ?? [],
      events: existingFixture?.events ?? [],
      lineupStints: existingFixture?.lineupStints ?? [],
      currentPeriod: 1,
      currentGameTime: formatPeriodClock(clockSettings.regulationPeriodMinutes),
      homeStarters: starterIds(homeTeam.players),
      awayStarters: trackBothTeams ? starterIds(awayTeam.players) : [],
      gameDayRosterIds: {
        home: homeTeam.players.map((p) => p.id),
        away: trackBothTeams ? awayTeam.players.map((p) => p.id) : [],
      },
      trackBothTeams,
      isFriendly: isFriendly ? true : undefined,
      isActive: true,
      isCompleted: false,
      setupCreatedTeamIds:
        setupCreatedTeamIds.length > 0 ? setupCreatedTeamIds : undefined,
      setupRosterChanges:
        setupRosterChanges.length > 0 ? setupRosterChanges : undefined,
    };

    const started = onGameStart(game);
    if (!started) {
      setStartBlockedMessage(
        "A game is already in progress. Resume or delete it before starting a new one."
      );
      return;
    }
    setStartBlockedMessage(null);
  }, [
    tournamentId,
    isFriendly,
    stageId,
    groupId,
    gameDate,
    startTime,
    clockSettings,
    homeMode,
    homeTeam,
    awayMode,
    awayTeam,
    trackBothTeams,
    resolveTeamForGame,
    teams,
    takenAbbreviations,
    onCreateTeam,
    onGameStart,
  ]);

  const sideReady = (mode: TeamSelectionMode, team: Team) =>
    mode !== "none" &&
    team.name.trim().length > 0 &&
    team.players.length >= MIN_PLAYERS &&
    !hasDuplicateJerseyNumbers(team.players);

  const canStartGame = useMemo(() => {
    if (!gameDate) return false;
    if (!isFriendly && !tournamentId) return false;
    if (!sideReady(homeMode, homeTeam)) return false;
    if (trackBothTeams) return sideReady(awayMode, awayTeam);
    if (!isOppIdentityReady(awayMode, awayTeam)) return false;
    if (awayMode === "create_new") {
      const abbrev = normalizeTeamAbbreviation(awayTeam.abbreviation);
      if (takenAbbreviations.some((a) => a.toUpperCase() === abbrev)) {
        return false;
      }
    }
    if (
      homeMode === "existing" &&
      awayMode === "existing" &&
      homeTeam.id === awayTeam.id
    ) {
      return false;
    }
    return true;
  }, [
    tournamentId,
    isFriendly,
    gameDate,
    homeMode,
    homeTeam,
    awayMode,
    awayTeam,
    trackBothTeams,
    takenAbbreviations,
  ]);

  const homeTitle = trackBothTeams ? "Home team" : "Your team";
  const awayTitle = trackBothTeams ? "Away team" : "Opponent";

  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Game setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="game-date">Game date</Label>
              <Input
                id="game-date"
                type="date"
                value={gameDate}
                onChange={(e) => setGameDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-time">Start time</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center space-x-3 pb-1">
                <Switch
                  checked={isFriendly}
                  onCheckedChange={(checked) => {
                    setIsFriendly(checked);
                    setStageId(undefined);
                    setGroupId(undefined);
                    resetSidesForTournament();
                    if (!checked && !tournamentId && sortedTournaments[0]) {
                      setTournamentId(sortedTournaments[0].id);
                    }
                    if (checked) {
                      setClockSettings(defaultClockForTournament("", null));
                    }
                  }}
                  id="friendly-game"
                />
                <Label htmlFor="friendly-game" className="text-sm">
                  Friendly game (not a tournament)
                </Label>
              </div>
              {isFriendly ? (
                <p className="text-xs text-muted-foreground">
                  Stats stay standalone — they will not count toward tournament
                  or season averages. Pick any club (or create one). Clock is
                  your choice below.
                </p>
              ) : (
                <>
                  <Label htmlFor="tournament">Tournament</Label>
                  <Select
                    value={tournamentId}
                    onValueChange={handleTournamentChange}
                    disabled={sortedTournaments.length === 0}
                  >
                    <SelectTrigger id="tournament">
                      <SelectValue placeholder="Select tournament" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedTournaments.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sortedTournaments.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Create a tournament first, or turn on Friendly game above.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {!isFriendly && (
            <GameStageTagFields
              tournament={tournament}
              values={{ stageId, groupId }}
              onChange={(next) => {
                setStageId(next.stageId);
                setGroupId(next.groupId);
              }}
            />
          )}

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4" />
              Game clock
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-periods">Regulation periods</Label>
                <Input
                  id="reg-periods"
                  type="number"
                  min={1}
                  max={4}
                  value={clockSettings.regulationPeriods}
                  onChange={(e) =>
                    setClockSettings((prev) => ({
                      ...prev,
                      regulationPeriods: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-minutes">Minutes per period</Label>
                <Input
                  id="reg-minutes"
                  type="number"
                  min={1}
                  max={20}
                  value={clockSettings.regulationPeriodMinutes}
                  onChange={(e) =>
                    setClockSettings((prev) => ({
                      ...prev,
                      regulationPeriodMinutes: Math.max(
                        1,
                        parseInt(e.target.value, 10) || 10
                      ),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ot-minutes">Overtime minutes</Label>
                <Input
                  id="ot-minutes"
                  type="number"
                  min={1}
                  max={10}
                  value={clockSettings.overtimePeriodMinutes}
                  onChange={(e) =>
                    setClockSettings((prev) => ({
                      ...prev,
                      overtimePeriodMinutes: Math.max(
                        1,
                        parseInt(e.target.value, 10) || 5
                      ),
                    }))
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {isFriendly
                ? "Set period length for this friendly (defaults to FIBA 4×10 if unchanged)."
                : "Defaults from tournament format (FIBA: 4×10 min). Used for live clock and minutes-on-court tracking."}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Switch
              checked={trackBothTeams}
              onCheckedChange={(checked) => {
                setTrackBothTeams(checked);
                if (!checked) {
                  setAwayMode("none");
                  setAwayTeam(draftTeam("away"));
                  setAwayInactive([]);
                }
              }}
              id="track-both-teams"
            />
            <Label htmlFor="track-both-teams" className="text-sm">
              Track both teams individually
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              {homeTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-visible">
            <TeamSidePanel
              side="home"
              mode={homeMode}
              team={homeTeam}
              tournamentTeams={availableTeams}
              tournamentId={tournamentId}
              tournamentRosters={tournamentRosters}
              takenAbbreviations={takenAbbreviations}
              newPlayerPosition={newPlayerPosition}
              isEditingThisSide={editingSide === "home"}
              showStarterOrder={homeMode !== "none"}
              clubRosterMode={isFriendly}
              inactivePlayers={homeInactive}
              onModeChange={(mode) => {
                setHomeMode(mode);
                if (mode === "create_new") setHomeInactive([]);
              }}
              onTeamChange={setHomeTeam}
              onSelectExisting={(id) => selectExistingTeam(id, "home")}
              onEditingSideChange={() => setEditingSide("home")}
              onNewPlayerPositionChange={setNewPlayerPosition}
              onAddPlayer={(name, num) => addPlayerToSide("home", name, num)}
              onPersistTeam={onUpdateTeam}
              onReorderPlayers={(players) => reorderPlayers("home", players)}
              onTriageChange={
                isFriendly
                  ? (active, inactive) => triagePlayers("home", active, inactive)
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              {awayTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-visible">
            {trackBothTeams ? (
              <TeamSidePanel
                side="away"
                mode={awayMode}
                team={awayTeam}
                tournamentTeams={availableTeams}
                tournamentId={tournamentId}
                tournamentRosters={tournamentRosters}
                takenAbbreviations={takenAbbreviations}
                newPlayerPosition={newPlayerPosition}
                isEditingThisSide={editingSide === "away"}
                showStarterOrder
                clubRosterMode={isFriendly}
                inactivePlayers={awayInactive}
                onModeChange={(mode) => {
                  setAwayMode(mode);
                  if (mode === "create_new") setAwayInactive([]);
                }}
                onTeamChange={setAwayTeam}
                onSelectExisting={(id) => selectExistingTeam(id, "away")}
                onEditingSideChange={() => setEditingSide("away")}
                onNewPlayerPositionChange={setNewPlayerPosition}
                onAddPlayer={(name, num) => addPlayerToSide("away", name, num)}
                onPersistTeam={onUpdateTeam}
                onReorderPlayers={(players) => reorderPlayers("away", players)}
                onTriageChange={
                  isFriendly
                    ? (active, inactive) => triagePlayers("away", active, inactive)
                    : undefined
                }
              />
            ) : (
              <OppIdentityPanel
                mode={awayMode}
                team={awayTeam}
                tournamentTeams={oppTeamsForPicker}
                takenAbbreviations={takenAbbreviations}
                onModeChange={setAwayMode}
                onTeamChange={setAwayTeam}
                onSelectExisting={selectOppIdentityTeam}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {startBlockedMessage && (
        <p className="text-sm text-destructive text-center">{startBlockedMessage}</p>
      )}

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleStartGame}
          disabled={!canStartGame}
          className="px-8 py-3 rounded-xl"
        >
          Start game
        </Button>
      </div>
    </div>
  );
}
