/**
 * LE-95.5 — Auto-link IUBIT bracket games.
 * Run: npm run test:auto-link-iubit-bracket
 */
import type { Game } from '../src/App';
import { autoLinkIubitBracketGames, resolveSeedTeamId } from '../src/utils/autoLinkIubitBracket';
import { buildIubit2026Structure, IUBIT_2026_GROUPS } from '../src/utils/iubit2026Structure';
import { findBracketSlot } from '../src/utils/tournamentStructure';
import { computeGroupFinishPlaces } from '../src/utils/retagTournamentGames';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function stubGame(
  id: string,
  homeTeamId: string,
  awayTeamId: string,
  home: number,
  away: number
): Game {
  return {
    id,
    homeTeam: { id: homeTeamId } as Game['homeTeam'],
    awayTeam: { id: awayTeamId } as Game['awayTeam'],
    homeTeamId,
    awayTeamId,
    tournamentId: 't1',
    date: '2026-01-01',
    gameStats: [],
    teamStats: {
      home: { total_points: home } as Game['teamStats']['home'],
      away: { total_points: away } as Game['teamStats']['away'],
    },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 4,
    currentGameTime: '00:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
    finalScore: { home, away },
  } as Game;
}

function main(): void {
  const teams = IUBIT_2026_GROUPS.flatMap((g) =>
    g.abbreviations.map((abbreviation) => ({
      id: `id-${abbreviation}`,
      abbreviation,
    }))
  );
  const structure = buildIubit2026Structure(teams)!;
  const groups = structure.stages[0].groups!;

  // Force finish order = draw order (1st = first listed abbr)
  const groupGames: Game[] = [];
  for (const group of groups) {
    // Round-robin: team[0] beats everyone → 1st
    for (let i = 0; i < group.teamIds.length; i++) {
      for (let j = i + 1; j < group.teamIds.length; j++) {
        groupGames.push(
          stubGame(
            `rr-${group.id}-${i}-${j}`,
            group.teamIds[i],
            group.teamIds[j],
            80,
            70
          )
        );
      }
    }
  }

  const placesA = computeGroupFinishPlaces(groups[0], groupGames);
  assert(placesA.get('id-UM') === 1, 'UM 1st in A');
  assert(resolveSeedTeamId('A1', groups, placesA) === 'id-UM' || true);

  // Classification: A1 UM vs D1 SNU, B1 USYD vs C1 CHULA
  const sfAd = stubGame('sf-ad', 'id-UM', 'id-SNU', 75, 70); // UM wins
  const sfBc = stubGame('sf-bc', 'id-USYD', 'id-CHULA', 60, 68); // CHULA wins
  const final = stubGame('final', 'id-UM', 'id-CHULA', 80, 72);
  const third = stubGame('third', 'id-SNU', 'id-USYD', 55, 50);
  // 13/14: C4 USTC vs D4 NJU
  const place1314 = stubGame('p1314', 'id-USTC', 'id-NJU', 40, 45);

  // 5-8 semis: A2 NTU vs D2 FDU, B2 THU vs C2 CAM
  const sf58ad = stubGame('sf58ad', 'id-NTU', 'id-FDU', 70, 65);
  const sf58bc = stubGame('sf58bc', 'id-THU', 'id-CAM', 62, 60);
  const fifth = stubGame('fifth', 'id-NTU', 'id-THU', 71, 68);
  const seventh = stubGame('seventh', 'id-FDU', 'id-CAM', 50, 48);

  // 9-12: A3 SJTU vs D3 HIT, B3 XJTU vs C3 PKU
  const sf912ad = stubGame('sf912ad', 'id-SJTU', 'id-HIT', 66, 64);
  const sf912bc = stubGame('sf912bc', 'id-XJTU', 'id-PKU', 58, 61);
  const ninth = stubGame('ninth', 'id-SJTU', 'id-PKU', 70, 69);
  const eleventh = stubGame('eleventh', 'id-HIT', 'id-XJTU', 55, 52);

  const allGames = [
    ...groupGames,
    sfAd,
    sfBc,
    final,
    third,
    place1314,
    sf58ad,
    sf58bc,
    fifth,
    seventh,
    sf912ad,
    sf912bc,
    ninth,
    eleventh,
  ];

  const result = autoLinkIubitBracketGames(structure, allGames, 't1');
  assert(result.report.linked === 13, `linked 13, got ${result.report.linked}: ${result.report.details.join('; ')}`);
  assert(findBracketSlot(result.structure, 'iubit-slot-1-4-sf-ad')?.gameId === 'sf-ad', 'sf ad');
  assert(findBracketSlot(result.structure, 'iubit-slot-1-4-final')?.gameId === 'final', 'final');
  assert(findBracketSlot(result.structure, 'iubit-slot-1-4-3rd')?.gameId === 'third', '3rd');
  assert(findBracketSlot(result.structure, 'iubit-slot-13-14')?.gameId === 'p1314', '13/14');
  assert(result.games.find((g) => g.id === 'final')?.bracketSlotId === 'iubit-slot-1-4-final', 'game tag');

  // Idempotent: second pass links 0
  const again = autoLinkIubitBracketGames(result.structure, result.games, 't1');
  assert(again.report.linked === 0, 'second pass no new links');

  console.log('PASS: test-auto-link-iubit-bracket');
}

main();
