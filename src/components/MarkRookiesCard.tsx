/**
 * Admin: mark manual ROTY-eligible players — team list, then players for one team.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { Team } from '../App';
import type { TournamentRosterEntry } from '../utils/tournamentRosters';
import {
  findPlayerProfile,
  setTournamentRosterRookieFlag,
} from '../utils/tournamentRosters';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { TeamBadge } from './TeamBadge';
import { ArrowLeft, ChevronRight } from 'lucide-react';

interface MarkRookiesCardProps {
  tournamentId: string;
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
  onUpdateTournamentRosters: (
    entriesOrUpdater:
      | TournamentRosterEntry[]
      | ((prev: TournamentRosterEntry[]) => TournamentRosterEntry[])
  ) => void;
  /** Dialog body: no outer card chrome / duplicate title. */
  embedded?: boolean;
}

type TeamGroup = {
  team: Team;
  entries: TournamentRosterEntry[];
};

export function MarkRookiesCard({
  tournamentId,
  teams,
  tournamentRosters,
  onUpdateTournamentRosters,
  embedded = false,
}: MarkRookiesCardProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const groups = useMemo((): TeamGroup[] => {
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const byTeam = new Map<string, TournamentRosterEntry[]>();
    for (const row of tournamentRosters) {
      if (row.tournamentId !== tournamentId) continue;
      const list = byTeam.get(row.teamId) ?? [];
      list.push(row);
      byTeam.set(row.teamId, list);
    }
    const out: TeamGroup[] = [];
    for (const [teamId, entries] of byTeam) {
      const team = teamById.get(teamId);
      if (!team) continue;
      const sorted = [...entries].sort((a, b) => {
        if (a.number !== b.number) return a.number - b.number;
        const na =
          findPlayerProfile(a.playerId, teams)?.name ?? a.playerId;
        const nb =
          findPlayerProfile(b.playerId, teams)?.name ?? b.playerId;
        return na.localeCompare(nb);
      });
      out.push({ team, entries: sorted });
    }
    return out.sort((a, b) => a.team.name.localeCompare(b.team.name));
  }, [tournamentId, tournamentRosters, teams]);

  const taggedCount = useMemo(
    () =>
      groups.reduce(
        (n, g) => n + g.entries.filter((e) => e.isRookie === true).length,
        0
      ),
    [groups]
  );

  const selectedGroup = useMemo(
    () => groups.find((g) => g.team.id === selectedTeamId) ?? null,
    [groups, selectedTeamId]
  );

  const handleToggle = useCallback(
    (entry: TournamentRosterEntry, checked: boolean) => {
      // Local only while Eligibility dialog is open — parent flushes once on close.
      onUpdateTournamentRosters((prev) =>
        setTournamentRosterRookieFlag(prev, {
          tournamentId: entry.tournamentId,
          teamId: entry.teamId,
          playerId: entry.playerId,
          isRookie: checked,
        })
      );
    },
    [onUpdateTournamentRosters]
  );

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tournament roster entries yet. Add players to team tournament
        rosters first.
      </p>
    );
  }

  let body: ReactNode;

  if (selectedGroup) {
    const teamTagged = selectedGroup.entries.filter(
      (e) => e.isRookie === true
    ).length;
    body = (
      <div className="space-y-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setSelectedTeamId(null)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All teams
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <TeamBadge team={selectedGroup.team} teamId={selectedGroup.team.id} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{selectedGroup.team.name}</p>
            <p className="text-xs text-muted-foreground">
              {teamTagged} of {selectedGroup.entries.length} tagged
            </p>
          </div>
        </div>
        <ul className="rounded-md border divide-y max-h-[50vh] overflow-y-auto">
          {selectedGroup.entries.map((entry) => {
            const player = findPlayerProfile(entry.playerId, teams);
            const name = player?.name ?? entry.playerId;
            const id = `rookie-${entry.teamId}-${entry.playerId}`;
            return (
              <li
                key={tournamentRosterRowKey(entry)}
                className="flex items-center gap-2.5 px-2.5 py-1.5"
              >
                <Checkbox
                  id={id}
                  checked={entry.isRookie === true}
                  onCheckedChange={(v) => handleToggle(entry, v === true)}
                />
                <Label
                  htmlFor={id}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 font-normal"
                >
                  <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground">
                    #{entry.number}
                  </span>
                  <span className="truncate text-sm">{name}</span>
                </Label>
              </li>
            );
          })}
        </ul>
      </div>
    );
  } else {
    body = (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Pick a team, then tag rookies. {taggedCount} tagged total.
        </p>
        <ul className="rounded-md border divide-y max-h-[55vh] overflow-y-auto">
          {groups.map(({ team, entries }) => {
            const teamTagged = entries.filter((e) => e.isRookie === true).length;
            return (
              <li key={team.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-muted/50"
                  onClick={() => setSelectedTeamId(team.id)}
                >
                  <TeamBadge team={team} teamId={team.id} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {team.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {teamTagged}/{entries.length}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (embedded) return body;

  return (
    <div className="rounded-md border p-3 space-y-2">
      <h3 className="text-sm font-semibold">Mark rookies</h3>
      {body}
    </div>
  );
}

function tournamentRosterRowKey(entry: TournamentRosterEntry): string {
  return `${entry.tournamentId}:${entry.teamId}:${entry.playerId}`;
}
