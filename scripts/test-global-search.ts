import assert from 'node:assert/strict';
import type { Game, Player, Team, Tournament } from '../src/App';
import {
  buildGlobalSearchResults,
  scoreSearchMatch,
} from '../src/utils/globalSearch';

function makeTournament(id: string, name: string): Tournament {
  return {
    id,
    name,
    year: 2026,
    month: 'Jan',
    teams: [],
    games: [],
    standings: [],
  };
}

function makeTeam(id: string, name: string): Team {
  return { id, name, abbreviation: name.slice(0, 3).toUpperCase(), players: [] };
}

function makePlayer(id: string, name: string): Player {
  return {
    id,
    name,
    number: 1,
    position: 'G',
    height: '180',
    weight: '80',
    age: 20,
  };
}

function makeGame(id: string, home: Team, away: Team): Game {
  return {
    id,
    homeTeam: home,
    awayTeam: away,
    homeTeamId: home.id,
    awayTeamId: away.id,
    date: '2026-01-01',
    gameStats: [],
    teamStats: { home: {} as Game['teamStats']['home'], away: {} as Game['teamStats']['away'] },
    shots: [],
    events: [],
    lineupStints: [],
    currentPeriod: 1,
    currentGameTime: '10:00',
    homeStarters: [],
    awayStarters: [],
    trackBothTeams: true,
    isActive: false,
    isCompleted: true,
  };
}

function testScoreSearchMatch() {
  assert.equal(scoreSearchMatch('Carl', 'carl'), 4100);
  assert.equal(scoreSearchMatch('Carl Belanger', 'car'), 3075);
  assert.ok(scoreSearchMatch('Nanyang Technological University', 'ca') < scoreSearchMatch('Carl Belanger', 'ca'));
  assert.ok(scoreSearchMatch('Macau', 'ca') < scoreSearchMatch('Carl Belanger', 'ca'));
  assert.ok(scoreSearchMatch('Carl Belanger', 'ca') > scoreSearchMatch('Cambridge Basketball Club', 'ca'));
  assert.ok(scoreSearchMatch('Carl Belanger', 'ca') > scoreSearchMatch('Nanyang Technological University', 'ca'));
}

function testCarlRanksAboveWeakSubstringMatches() {
  const tournaments = [
    makeTournament('t-macau', 'Macau Invitational'),
    makeTournament('t-ntu', 'Nanyang Technological University Open'),
  ];
  const teams = [makeTeam('team-cambridge', 'Cambridge Basketball Club')];
  const players = [makePlayer('player-carl', 'Carl Belanger')];
  const games: Game[] = [];

  const results = buildGlobalSearchResults('ca', {
    tournaments,
    teams,
    games,
    orphanPlayers: players,
  });
  const labels = results.map((result) => {
    if (result.type === 'player') return result.player?.name;
    if (result.type === 'team') return result.team?.name;
    if (result.type === 'tournament') return result.tournament?.name;
    return result.game?.id;
  });

  assert.equal(labels[0], 'Carl Belanger');
}

function testExactMatchBeatsPrefix() {
  const players = [
    makePlayer('player-car', 'Car'),
    makePlayer('player-carl', 'Carl Belanger'),
  ];

  const results = buildGlobalSearchResults('car', {
    tournaments: [],
    teams: [],
    games: [],
    orphanPlayers: players,
  });
  assert.equal(results[0].player?.name, 'Car');
}

function testWordPrefixBeatsSubstring() {
  const teams = [
    makeTeam('team-ntu', 'Nanyang Technological University'),
    makeTeam('team-carl', 'Carlton Tigers'),
  ];

  const results = buildGlobalSearchResults('car', { tournaments: [], teams, games: [] });
  assert.equal(results[0].team?.name, 'Carlton Tigers');
}

function testMixedTypesSortedByScore() {
  const tournaments = [makeTournament('t1', 'Carl Classic')];
  const teams = [makeTeam('team1', 'Carlton')];
  const players = [makePlayer('p1', 'Carl')];
  const home = makeTeam('home', 'Carl Home');
  const away = makeTeam('away', 'Carl Away');
  const games = [makeGame('game-carl-2026', home, away)];

  const results = buildGlobalSearchResults('carl', {
    tournaments,
    teams,
    games,
    orphanPlayers: players,
  });
  assert.ok(results.length >= 4);
  assert.ok(results.every((result) => result.score >= 3000));
}

function testLimit() {
  const players = Array.from({ length: 20 }, (_, index) =>
    makePlayer(`p${index}`, `Carl Player ${index}`)
  );

  const results = buildGlobalSearchResults(
    'carl',
    { tournaments: [], teams: [], games: [], orphanPlayers: players },
    5
  );
  assert.equal(results.length, 5);
}

function main() {
  testScoreSearchMatch();
  testCarlRanksAboveWeakSubstringMatches();
  testExactMatchBeatsPrefix();
  testWordPrefixBeatsSubstring();
  testMixedTypesSortedByScore();
  testLimit();
  console.log('test-global-search: all passed');
}

main();
