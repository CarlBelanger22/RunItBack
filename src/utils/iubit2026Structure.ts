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

/** Legacy short titles that should be upgraded once to current display names. */
const IUBIT_CLASSIFICATION_LEGACY_NAMES: Record<string, readonly string[]> = {
  'iubit-stage-1-4': ['1–4', '1-4', '1/4'],
  'iubit-stage-5-8': ['5–8', '5-8', '5/8'],
  'iubit-stage-9-12': ['9–12', '9-12', '9/12'],
  'iubit-stage-13-14': ['13–14', '13-14', '13/14'],
};

/**
 * One-shot migration: only rewrite known legacy IUBIT titles.
 * Does not overwrite user renames (LE-123).
 */
export function applyIubitClassificationDisplayNames(
  structure: TournamentStructure
): TournamentStructure {
  const nameById = new Map(
    IUBIT_2026_CLASSIFICATION_STAGES.map((s) => [s.id, s.name])
  );
  let changed = false;
  const stages = structure.stages.map((stage) => {
    const display = nameById.get(stage.id);
    if (!display || stage.name === display) return stage;
    const legacy = IUBIT_CLASSIFICATION_LEGACY_NAMES[stage.id];
    if (!legacy?.includes(stage.name)) return stage;
    changed = true;
    return { ...stage, name: display };
  });
  return changed ? { stages } : structure;
}
