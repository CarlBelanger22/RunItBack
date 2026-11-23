/**
 * Admin: mark manual ROTY-eligible players by team (Awards → Individual).
 */
import { useCallback, useMemo, useState } from 'react';
import type { Team } from '../App';
import type { TournamentRosterEntry } from '../utils/tournamentRosters';
import {
  findPlayerProfile,
  setTournamentRosterRookieFlag,
} from '../utils/tournamentRosters';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface MarkRookiesCardProps {
  tournamentId: string;
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
  onUpdateTournamentRosters: (
    entriesOrUpdater:
      | TournamentRosterEntry[]
      | ((prev: TournamentRosterEntry[]) => TournamentRosterEntry[])
  ) => void;
  onFlushTournamentRosterSave?: () => Promise<boolean>;
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
  onFlushTournamentRosterSave,
  embedded = false,
}: MarkRookiesCardProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

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

  const toggleCollapsed = useCallback((teamId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }, []);

  const handleToggle = useCallback(
    (entry: TournamentRosterEntry, checked: boolean) => {
      onUpdateTournamentRosters((prev) =>
        setTournamentRosterRookieFlag(prev, {
          tournamentId: entry.tournamentId,
          teamId: entry.teamId,
          playerId: entry.playerId,
          isRookie: checked,
        })
      );
      void onFlushTournamentRosterSave?.();
    },
    [onUpdateTournamentRosters, onFlushTournamentRosterSave]
  );

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tournament roster entries yet. Add players to team tournament
        rosters first.
      </p>
    );
  }

  const body = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Check true first-year players in this league. Tagged: {taggedCount}
      </p>
      {groups.map(({ team, entries }) => {
        const isCollapsed = collapsed.has(team.id);
        const teamTagged = entries.filter((e) => e.isRookie === true).length;
        return (
          <div key={team.id} className="rounded-md border">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
              onClick={() => toggleCollapsed(team.id)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{team.name}</span>
              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                {teamTagged}/{entries.length}
              </span>
            </button>
            {isCollapsed ? null : (
              <ul className="border-t divide-y px-3 py-1">
                {entries.map((entry) => {
                  const player = findPlayerProfile(entry.playerId, teams);
                  const name = player?.name ?? entry.playerId;
                  const id = `rookie-${entry.teamId}-${entry.playerId}`;
                  return (
                    <li
                      key={tournamentRosterRowKey(entry)}
                      className="flex items-center gap-3 py-2"
                    >
                      <Checkbox
                        id={id}
                        checked={entry.isRookie === true}
                        onCheckedChange={(v) =>
                          handleToggle(entry, v === true)
                        }
                      />
                      <Label
                        htmlFor={id}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 font-normal"
                      >
                        <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                          #{entry.number}
                        </span>
                        <span className="truncate text-sm">{name}</span>
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Mark rookies</h3>
      </div>
      {body}
    </div>
  );
}

function tournamentRosterRowKey(entry: TournamentRosterEntry): string {
  return `${entry.tournamentId}:${entry.teamId}:${entry.playerId}`;
}
