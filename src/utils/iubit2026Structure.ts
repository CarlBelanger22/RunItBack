/**
 * IUBIT 2026 group layout (official draw) for LE-95 structure editor / retag.
 * Abbreviations must match enrolled teams.
 */
import type { TournamentStructure } from './tournamentStructure';
import { iubitClassificationBracketForStage } from './iubit2026Bracket';

/** Draw order labels A1… — not final standings. */
export const IUBIT_2026_GROUPS: {
  id: string;
  name: string;
  abbreviations: string[];
}[] = [
  { id: 'iubit-g-a', name: 'Group A', abbreviations: ['UM', 'NTU', 'SJTU'] },
  { id: 'iubit-g-b', name: 'Group B', abbreviations: ['USYD', 'THU', 'XJTU'] },
  {
    id: 'iubit-g-c',
    name: 'Group C',
    abbreviations: ['CHULA', 'CAM', 'PKU', 'USTC'],
  },
  {
    id: 'iubit-g-d',
    name: 'Group D',
    abbreviations: ['SNU', 'FDU', 'HIT', 'NJU'],
  },
];

export const IUBIT_2026_CLASSIFICATION_STAGES: {
  id: string;
  name: string;
  order: number;
}[] = [
  { id: 'iubit-stage-1-4', name: 'Semis & Finals', order: 2 },
  { id: 'iubit-stage-5-8', name: '5th–8th Placement', order: 3 },
  { id: 'iubit-stage-9-12', name: '9th–12th Placement', order: 4 },
  { id: 'iubit-stage-13-14', name: '13th–14th Placement', order: 5 },
];

export function buildIubit2026Structure(
  teams: Array<{ id: string; abbreviation: string }>
): TournamentStructure | null {
  const byAbbr = new Map(
    teams.map((t) => [t.abbreviation.trim().toUpperCase(), t.id])
  );

  const groups = [];
  for (const def of IUBIT_2026_GROUPS) {
    const teamIds: string[] = [];
    for (const abbr of def.abbreviations) {
      const id = byAbbr.get(abbr);
      if (!id) return null;
      teamIds.push(id);
    }
    groups.push({ id: def.id, name: def.name, teamIds });
  }

  return {
    stages: [
      {
        id: 'iubit-stage-groups',
        name: 'Group stage',
        kind: 'round_robin',
        order: 1,
        groups,
      },
      ...IUBIT_2026_CLASSIFICATION_STAGES.map((s) => {
        const bracket = iubitClassificationBracketForStage(s.id);
        return {
          id: s.id,
          name: s.name,
          kind: 'classification' as const,
          order: s.order,
          ...(bracket ? { bracket } : {}),
        };
      }),
    ],
  };
}

export function canBuildIubit2026Structure(
  teams: Array<{ id: string; abbreviation: string }>
): boolean {
  return buildIubit2026Structure(teams) != null;
}

/** Refresh classification stage titles for an already-applied IUBIT structure (by stage id). */
export function applyIubitClassificationDisplayNames(
  structure: TournamentStructure
): TournamentStructure {
  const nameById = new Map(
    IUBIT_2026_CLASSIFICATION_STAGES.map((s) => [s.id, s.name])
  );
  let changed = false;
  const stages = structure.stages.map((stage) => {
    const name = nameById.get(stage.id);
    if (!name || stage.name === name) return stage;
    changed = true;
    return { ...stage, name };
  });
  return changed ? { stages } : structure;
}
