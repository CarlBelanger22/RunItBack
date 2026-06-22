import type { Team } from '../App';

export interface JerseyTeamEntry {
  team: Team;
  number: number;
}

export interface PlayerJerseyGroup {
  number: number;
  teams: Team[];
}

/** One icon per jersey number; teams keep input order (recency, latest first). */
export function groupJerseyEntriesByNumber(
  entries: JerseyTeamEntry[]
): PlayerJerseyGroup[] {
  const groups: PlayerJerseyGroup[] = [];
  const indexByNumber = new Map<number, number>();

  for (const { team, number } of entries) {
    const existingIdx = indexByNumber.get(number);
    if (existingIdx !== undefined) {
      groups[existingIdx].teams.push(team);
      continue;
    }
    indexByNumber.set(number, groups.length);
    groups.push({ number, teams: [team] });
  }

  return groups;
}

export function jerseyGroupAriaLabel(group: PlayerJerseyGroup): string {
  const teamNames = group.teams.map((t) => t.name).join(', ');
  return `Jersey number ${group.number}, worn for ${teamNames}`;
}
