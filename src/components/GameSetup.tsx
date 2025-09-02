import React, { useState, useCallback, useMemo } from "react";
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
import { Separator } from "./ui/separator";
import { Team, Player, Game, TeamStats } from "../App";
import { Plus, Trash2, Users, Calendar } from "lucide-react";

interface GameSetupProps {
  onGameStart: (game: Game) => void;
  availableTeams?: Team[];
}

interface TeamSelectorProps {
  isHome: boolean;
  team: Team;
  onTeamChange: (team: Team) => void;
  availableTeams: Team[];
  newPlayerName: string;
  newPlayerNumber: string;
  newPlayerPosition: string;
  editingTeam: "home" | "away";
  positions: string[];
  onSelectExistingTeam: (teamId: string, isHome: boolean) => void;
  onNewPlayerNameChange: (value: string, isForThisTeam: boolean) => void;
  onNewPlayerNumberChange: (value: string, isForThisTeam: boolean) => void;
  onNewPlayerPositionChange: (value: string, isForThisTeam: boolean) => void;
  onEditingTeamChange: (team: "home" | "away") => void;
  onAddPlayer: () => void;
  onRemovePlayer: (playerId: string, team: "home" | "away") => void;
}

const TeamSelector = React.memo(({
  isHome,
  team,
  onTeamChange,
  availableTeams,
  newPlayerName,
  newPlayerNumber,
  newPlayerPosition,
  editingTeam,
  positions,
  onSelectExistingTeam,
  onNewPlayerNameChange,
  onNewPlayerNumberChange,
  onNewPlayerPositionChange,
  onEditingTeamChange,
  onAddPlayer,
  onRemovePlayer,
}: TeamSelectorProps) => {
  const teamType = isHome ? "home" : "away";
  const isEditingThisTeam = editingTeam === teamType;

  return (
    <div className="space-y-4">
      {/* Existing Team Selection */}
      {availableTeams.length > 0 && (
        <div className="space-y-2">
          <Label>Select Existing Team</Label>
          <Select
            value={
              team.id !== teamType ? team.id : ""
            }
            onValueChange={(teamId) =>
              onSelectExistingTeam(teamId, isHome)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose from your teams" />
            </SelectTrigger>
            <SelectContent>
              {availableTeams.map((existingTeam) => (
                <SelectItem
                  key={existingTeam.id}
                  value={existingTeam.id}
                >
                  {existingTeam.name} (
                  {existingTeam.players.length} players)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex-1 border-t" />
        <span>or create new</span>
        <div className="flex-1 border-t" />
      </div>

      {/* Manual Team Creation */}
      <div className="space-y-2">
        <Label htmlFor={`${teamType}-team-name`}>
          Team Name
        </Label>
        <Input
          id={`${teamType}-team-name`}
          placeholder="Enter team name"
          value={
            team.id === teamType ? team.name : ""
          }
          onChange={(e) => {
            onTeamChange({
              id: teamType,
              name: e.target.value,
              players: team.id === teamType ? team.players : [],
            });
          }}
        />
      </div>

      <Separator />

      {/* Current Team Display */}
      {team.name && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              {team.name} - Players ({team.players.length})
            </h4>
            {team.id !== "home" && team.id !== "away" && (
              <Badge variant="secondary" className="text-xs">
                From saved teams
              </Badge>
            )}
          </div>

          {/* Add Player Form (only for manual teams) */}
          {(team.id === "home" || team.id === "away") && (
            <div className="space-y-3">
              <Label className="text-sm">Add Player</Label>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <Input
                    placeholder="Player name"
                    value={isEditingThisTeam ? newPlayerName : ""}
                    onChange={(e) => onNewPlayerNameChange(e.target.value, isEditingThisTeam)}
                    onFocus={() => onEditingTeamChange(teamType)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    placeholder="No."
                    type="number"
                    min="0"
                    max="99"
                    value={isEditingThisTeam ? newPlayerNumber : ""}
                    onChange={(e) => onNewPlayerNumberChange(e.target.value, isEditingThisTeam)}
                    onFocus={() => onEditingTeamChange(teamType)}
                  />
                </div>
                <div className="col-span-3">
                  <Select
                    value={isEditingThisTeam ? newPlayerPosition : ""}
                    onValueChange={(value) => onNewPlayerPositionChange(value, isEditingThisTeam)}
                    onOpenChange={() => onEditingTeamChange(teamType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pos" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {pos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Button
                    size="sm"
                    onClick={onAddPlayer}
                    disabled={
                      !isEditingThisTeam ||
                      !newPlayerName ||
                      !newPlayerNumber ||
                      !newPlayerPosition
                    }
                    className="w-full"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Players List */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {team.players.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No players added yet
              </p>
            ) : (
              team.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-2 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      #{player.number}
                    </Badge>
                    <span className="font-medium">
                      {player.name}
                    </span>
                    <Badge variant="secondary">
                      {player.position}
                    </Badge>
                  </div>
                  {(team.id === "home" ||
                    team.id === "away") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onRemovePlayer(
                          player.id,
                          teamType,
                        )
                      }
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

TeamSelector.displayName = "TeamSelector";

export function GameSetup({
  onGameStart,
  availableTeams = [],
}: GameSetupProps) {
  const [homeTeam, setHomeTeam] = useState<Team>({
    id: "home",
    name: "",
    players: [],
  });
  const [awayTeam, setAwayTeam] = useState<Team>({
    id: "away",
    name: "",
    players: [],
  });
  const [trackBothTeams, setTrackBothTeams] = useState(true);
  const [gameDate, setGameDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] = useState("");
  const [editingTeam, setEditingTeam] = useState<"home" | "away">("home");

  const positions = ["PG", "SG", "SF", "PF", "C"];

  const selectExistingTeam = useCallback((
    teamId: string,
    isHome: boolean,
  ) => {
    const selectedTeam = availableTeams.find(
      (t) => t.id === teamId,
    );
    if (selectedTeam) {
      if (isHome) {
        setHomeTeam(selectedTeam);
      } else {
        setAwayTeam(selectedTeam);
      }
    }
  }, [availableTeams]);

  const addPlayer = useCallback(() => {
    if (
      !newPlayerName ||
      !newPlayerNumber ||
      !newPlayerPosition
    )
      return;

    const player: Player = {
      id: `${editingTeam}-${Date.now()}-${newPlayerNumber}`,
      name: newPlayerName,
      number: parseInt(newPlayerNumber),
      position: newPlayerPosition,
    };

    if (editingTeam === "home") {
      setHomeTeam((prev) => ({
        ...prev,
        players: [...prev.players, player],
      }));
    } else {
      setAwayTeam((prev) => ({
        ...prev,
        players: [...prev.players, player],
      }));
    }

    setNewPlayerName("");
    setNewPlayerNumber("");
    setNewPlayerPosition("");
  }, [editingTeam, newPlayerName, newPlayerNumber, newPlayerPosition]);

  const removePlayer = useCallback((
    playerId: string,
    team: "home" | "away",
  ) => {
    if (team === "home") {
      setHomeTeam((prev) => ({
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
      }));
    } else {
      setAwayTeam((prev) => ({
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
      }));
    }
  }, []);

  const handleStartGame = useCallback(() => {
    if (!homeTeam.name || homeTeam.players.length === 0) return;

    // Initialize empty team stats
    const emptyTeamStats = {
      teamId: '',
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
      points_off_turnovers: 0,
      points_in_paint: 0,
      second_chance_points: 0,
      fastbreak_points: 0,
      bench_points: 0,
      biggest_lead: 0,
      biggest_scoring_run: 0,
    };

    const finalAwayTeam = trackBothTeams
      ? awayTeam
      : { id: "opponent", name: "Opponent", players: [] };

    const game: Game = {
      id: `game-${Date.now()}`,
      homeTeam,
      awayTeam: finalAwayTeam,
      date: new Date().toISOString(),
      gameStats: [],
      teamStats: {
        home: { ...emptyTeamStats, teamId: homeTeam.id },
        away: { ...emptyTeamStats, teamId: finalAwayTeam.id }
      },
      shots: [],
      events: [],
      lineupStints: [],
      currentPeriod: 1,
      currentGameTime: '12:00',
      homeStarters: homeTeam.players.slice(0, 5).map(p => p.id), // First 5 players are starters
      awayStarters: finalAwayTeam.players.slice(0, 5).map(p => p.id),
      trackBothTeams,
      isActive: true,
    };

    onGameStart(game);
  }, [homeTeam, awayTeam, trackBothTeams, onGameStart]);

  const canStartGame = useMemo(() =>
    homeTeam.name &&
    homeTeam.players.length > 0 &&
    (trackBothTeams
      ? awayTeam.name && awayTeam.players.length > 0
      : true), [homeTeam, awayTeam, trackBothTeams]);

  const handleNewPlayerNameChange = useCallback((value: string, isForThisTeam: boolean) => {
    if (isForThisTeam) {
      setNewPlayerName(value);
    }
  }, []);

  const handleNewPlayerNumberChange = useCallback((value: string, isForThisTeam: boolean) => {
    if (isForThisTeam) {
      setNewPlayerNumber(value);
    }
  }, []);

  const handleNewPlayerPositionChange = useCallback((value: string, isForThisTeam: boolean) => {
    if (isForThisTeam) {
      setNewPlayerPosition(value);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Game Configuration */}
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Game Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="game-date">Game Date</Label>
              <Input
                id="game-date"
                type="date"
                value={gameDate}
                onChange={(e) => setGameDate(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-3 pt-6">
              <Switch
                checked={trackBothTeams}
                onCheckedChange={setTrackBothTeams}
                id="track-both-teams"
              />
              <Label
                htmlFor="track-both-teams"
                className="text-sm"
              >
                Track both teams individually
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Home Team */}
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Home Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TeamSelector
              isHome={true}
              team={homeTeam}
              onTeamChange={setHomeTeam}
              availableTeams={availableTeams}
              newPlayerName={newPlayerName}
              newPlayerNumber={newPlayerNumber}
              newPlayerPosition={newPlayerPosition}
              editingTeam={editingTeam}
              positions={positions}
              onSelectExistingTeam={selectExistingTeam}
              onNewPlayerNameChange={handleNewPlayerNameChange}
              onNewPlayerNumberChange={handleNewPlayerNumberChange}
              onNewPlayerPositionChange={handleNewPlayerPositionChange}
              onEditingTeamChange={setEditingTeam}
              onAddPlayer={addPlayer}
              onRemovePlayer={removePlayer}
            />
          </CardContent>
        </Card>

        {/* Away Team */}
        <Card
          className={`shadow-lg rounded-2xl ${!trackBothTeams ? "opacity-50" : ""}`}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {trackBothTeams ? "Away Team" : "Opponent"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trackBothTeams ? (
              <TeamSelector
                isHome={false}
                team={awayTeam}
                onTeamChange={setAwayTeam}
                availableTeams={availableTeams}
                newPlayerName={newPlayerName}
                newPlayerNumber={newPlayerNumber}
                newPlayerPosition={newPlayerPosition}
                editingTeam={editingTeam}
                positions={positions}
                onSelectExistingTeam={selectExistingTeam}
                onNewPlayerNameChange={handleNewPlayerNameChange}
                onNewPlayerNumberChange={handleNewPlayerNumberChange}
                onNewPlayerPositionChange={handleNewPlayerPositionChange}
                onEditingTeamChange={setEditingTeam}
                onAddPlayer={addPlayer}
                onRemovePlayer={removePlayer}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Opponent will be tracked as a single unit</p>
                <p className="text-sm">
                  Only your team's individual stats will be
                  recorded
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Start Game Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleStartGame}
          disabled={!canStartGame}
          className="px-8 py-3 rounded-xl"
        >
          Start Game
        </Button>
      </div>
    </div>
  );
}