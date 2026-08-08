/**
 * LE-130 — NBL Div 2 2024 schedule constants + remaining RR orientation.
 */

import {
  realizeTournament,
  type DirectedEdge,
} from '../src/utils/realizeTournament';

export const TOURNAMENT_ID = 'tournament-1780251377063';

export const TEAM = {
  kaiXuan: 'team-1780252086140',
  amity: 'team-kx-div2-amity',
  threeS: 'team-kx-div2-chong-ghee', // rename Chong Ghee 2 → 3S Solid Surface
  clementi: 'team-kx-div2-clementi',
  gmac: 'team-kx-div2-gmac',
  kts: 'team-kx-div2-kts',
  loaded: 'team-kx-div2-loaded',
  police: 'team-kx-div2-police',
  safsa: 'team-kx-div2-safsa',
  skc: 'team-kx-div2-skc',
  tampines: 'team-kx-div2-tampines-east',
  tungsan: 'team-kx-div2-tungsan',
} as const;

export type NblTeamId = (typeof TEAM)[keyof typeof TEAM];

/** Do not delete/overwrite these existing games. */
export const PROTECTED_GAME_IDS = [
  'game-kx-div2-2024-04-03-amity',
  'game-kx-div2-2024-04-06-kts',
  'game-kx-div2-2024-04-14-police',
  'game-kx-div2-2024-04-15-gmac',
  'game-kx-div2-2024-04-27-chong-ghee',
  'game-kx-div2-2024-05-01-safsa',
  'game-kx-div2-2024-05-04-loaded',
  'game-kx-div2-2024-05-06-tungsan',
  'game-kx-div2-2024-05-07-tampines-east',
  'game-kx-div2-2024-05-12-clementi',
  'game-kx-div2-2024-05-30-skc',
  'game-kx-div2-2024-05-31-clementi', // 3rd place
  'game-kx-div2-2024-06-03-tungsan', // SF1
] as const;

export const EXISTING_3RD_PLACE_GAME_ID = 'game-kx-div2-2024-05-31-clementi';
export const EXISTING_SF1_GAME_ID = 'game-kx-div2-2024-06-03-tungsan';

export const GROUP_STAGE_ID = 'stage-mskn8a0x-vdt4e0';
export const GROUP_ID = 'group-mskn8fdm-nw52qa';
export const CLASSIFICATION_STAGE_ID = 'stage-mskn9f7c-c70pql';

/** Remaining wins needed among the 11 non–Kai Xuan teams (after locked KX RR). */
export const REMAINING_WIN_TARGETS: { id: NblTeamId; wins: number; key: string }[] =
  [
    { id: TEAM.tungsan, wins: 9, key: 'tungsan' },
    { id: TEAM.clementi, wins: 9, key: 'clementi' },
    { id: TEAM.police, wins: 7, key: 'police' },
    { id: TEAM.skc, wins: 6, key: 'skc' },
    { id: TEAM.loaded, wins: 5, key: 'loaded' },
    { id: TEAM.threeS, wins: 5, key: 'threeS' },
    { id: TEAM.safsa, wins: 4, key: 'safsa' },
    { id: TEAM.kts, wins: 4, key: 'kts' },
    { id: TEAM.gmac, wins: 3, key: 'gmac' },
    { id: TEAM.tampines, wins: 2, key: 'tampines' },
    { id: TEAM.amity, wins: 1, key: 'amity' },
  ];

export const TEAM_META: Record<
  NblTeamId,
  { id: NblTeamId; name: string; abbreviation: string; slug: string }
> = {
  [TEAM.kaiXuan]: {
    id: TEAM.kaiXuan,
    name: 'Kai Xuan',
    abbreviation: 'KX',
    slug: 'kai-xuan',
  },
  [TEAM.amity]: {
    id: TEAM.amity,
    name: 'Amity Sports',
    abbreviation: 'AMY',
    slug: 'amity',
  },
  [TEAM.threeS]: {
    id: TEAM.threeS,
    name: '3S Solid Surface',
    abbreviation: '3S',
    slug: '3s',
  },
  [TEAM.clementi]: {
    id: TEAM.clementi,
    name: 'Clementi True Hope',
    abbreviation: 'CTH',
    slug: 'clementi',
  },
  [TEAM.gmac]: {
    id: TEAM.gmac,
    name: 'GMAC',
    abbreviation: 'GMAC',
    slug: 'gmac',
  },
  [TEAM.kts]: {
    id: TEAM.kts,
    name: 'KTS NSC',
    abbreviation: 'KTS',
    slug: 'kts',
  },
  [TEAM.loaded]: {
    id: TEAM.loaded,
    name: 'Loaded',
    abbreviation: 'LDD',
    slug: 'loaded',
  },
  [TEAM.police]: {
    id: TEAM.police,
    name: 'Police Sports Association',
    abbreviation: 'PSA',
    slug: 'police',
  },
  [TEAM.safsa]: {
    id: TEAM.safsa,
    name: 'SAFSA',
    abbreviation: 'SAFSA',
    slug: 'safsa',
  },
  [TEAM.skc]: {
    id: TEAM.skc,
    name: 'Sin Kee Basketball Club',
    abbreviation: 'SKC',
    slug: 'skc',
  },
  [TEAM.tampines]: {
    id: TEAM.tampines,
    name: 'Tampines East CSN',
    abbreviation: 'TEC',
    slug: 'tampines',
  },
  [TEAM.tungsan]: {
    id: TEAM.tungsan,
    name: 'Tungsan',
    abbreviation: 'TSN',
    slug: 'tungsan',
  },
};

export interface NblScoreOnlyGameDef {
  id: string;
  date: string;
  startTime: string;
  homeTeamId: NblTeamId;
  awayTeamId: NblTeamId;
  homeScore: number;
  awayScore: number;
  phase: 'rr' | 'knockout';
  note?: string;
}

function slugPair(a: NblTeamId, b: NblTeamId): string {
  const sa = TEAM_META[a].slug;
  const sb = TEAM_META[b].slug;
  return sa < sb ? `${sa}-${sb}` : `${sb}-${sa}`;
}

/** Stable synthetic score: winner 70, loser 60 (+ small hash jitter). */
function syntheticScores(winnerId: string, loserId: string): {
  winner: number;
  loser: number;
} {
  let h = 0;
  const s = `${winnerId}|${loserId}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const bump = h % 9; // 0..8
  return { winner: 68 + bump, loser: 55 + (h % 7) };
}

/**
 * Orient the 55 missing RR games to hit remaining win targets.
 * Winner is home for synthetic bundles.
 */
export function buildRemainingRrGames(): NblScoreOnlyGameDef[] {
  const edges = realizeTournament(
    REMAINING_WIN_TARGETS.map((t) => ({ id: t.id, wins: t.wins }))
  );
  if (!edges || edges.length !== 55) {
    throw new Error(
      `Failed to realize remaining RR tournament (got ${edges?.length ?? 0} edges)`
    );
  }

  // Spread dates across Apr–May 2024 (avoid colliding with known KX dates visually).
  const baseDates = [
    '2024-04-04',
    '2024-04-05',
    '2024-04-07',
    '2024-04-08',
    '2024-04-10',
    '2024-04-11',
    '2024-04-13',
    '2024-04-16',
    '2024-04-18',
    '2024-04-20',
    '2024-04-21',
    '2024-04-24',
    '2024-04-25',
    '2024-04-28',
    '2024-04-29',
    '2024-05-02',
    '2024-05-03',
    '2024-05-05',
    '2024-05-08',
    '2024-05-09',
    '2024-05-11',
    '2024-05-13',
    '2024-05-15',
    '2024-05-16',
    '2024-05-18',
    '2024-05-19',
    '2024-05-21',
    '2024-05-22',
    '2024-05-24',
    '2024-05-25',
    '2024-05-26',
    '2024-05-28',
    '2024-05-29',
  ];

  return edges.map((e: DirectedEdge, i) => {
    const winnerId = e.winnerId as NblTeamId;
    const loserId = e.loserId as NblTeamId;
    const scores = syntheticScores(winnerId, loserId);
    const date = baseDates[i % baseDates.length];
    const hour = 10 + (i % 8);
    const startTime = `${String(hour).padStart(2, '0')}:00`;
    return {
      id: `game-nbl-div2-2024-rr-${slugPair(winnerId, loserId)}`,
      date,
      startTime,
      homeTeamId: winnerId,
      awayTeamId: loserId,
      homeScore: scores.winner,
      awayScore: scores.loser,
      phase: 'rr' as const,
      note: 'synthetic score-only (W/L oriented to official table)',
    };
  });
}

export const KO_SCORE_ONLY_GAMES: NblScoreOnlyGameDef[] = [
  {
    id: 'game-nbl-div2-2024-06-02-sf2-clementi-police',
    date: '2024-06-02',
    startTime: '19:00',
    homeTeamId: TEAM.clementi,
    awayTeamId: TEAM.police,
    homeScore: 47,
    awayScore: 67,
    phase: 'knockout',
    note: 'SF2 official',
  },
  {
    id: 'game-nbl-div2-2024-06-09-final-tungsan-police',
    date: '2024-06-09',
    startTime: '19:00',
    homeTeamId: TEAM.tungsan,
    awayTeamId: TEAM.police,
    homeScore: 69,
    awayScore: 65,
    phase: 'knockout',
    note: 'Final official',
  },
];

export function allNewScoreOnlyGames(): NblScoreOnlyGameDef[] {
  return [...buildRemainingRrGames(), ...KO_SCORE_ONLY_GAMES];
}

/** Full RR target W–L including Kai Xuan’s locked results. */
export const FULL_RR_TARGET_WINS: Record<NblTeamId, number> = {
  [TEAM.tungsan]: 10,
  [TEAM.clementi]: 9,
  [TEAM.police]: 8,
  [TEAM.kaiXuan]: 7,
  [TEAM.loaded]: 6,
  [TEAM.skc]: 6,
  [TEAM.threeS]: 5,
  [TEAM.safsa]: 5,
  [TEAM.kts]: 4,
  [TEAM.gmac]: 3,
  [TEAM.tampines]: 2,
  [TEAM.amity]: 1,
};
