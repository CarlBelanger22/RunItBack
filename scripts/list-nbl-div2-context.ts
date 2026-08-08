/**
 * Dump NBL Div 2 2024 teams, games, bracket for LE-130.
 */
import { loadEnvLocalIntoProcess } from './loadEnvLocal';

const TOURNAMENT_ID = 'tournament-1780251377063';

async function main(): Promise<void> {
  loadEnvLocalIntoProcess();
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const data = await loadAppDataFromSupabase();
  const t = data.tournaments.find((x) => x.id === TOURNAMENT_ID);
  if (!t) throw new Error('tournament missing');

  console.log('Tournament:', t.name, t.id);
  console.log('\nTeams:');
  for (const id of t.teams ?? []) {
    const team = data.teams.find((x) => x.id === id);
    console.log(`  ${id} | ${team?.name} | ${team?.abbreviation}`);
  }

  const games = (data.games ?? []).filter((g) => g.tournamentId === TOURNAMENT_ID);
  console.log(`\nGames (${games.length}):`);
  for (const g of games.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
    const home = data.teams.find((x) => x.id === g.homeTeamId)?.name ?? g.homeTeamId;
    const away = data.teams.find((x) => x.id === g.awayTeamId)?.name ?? g.awayTeamId;
    const hs = g.finalScore?.home ?? '?';
    const as = g.finalScore?.away ?? '?';
    console.log(
      `  ${g.id} | ${g.date} | ${home} ${hs}–${as} ${away} | stage=${g.stageId ?? '—'} group=${g.groupId ?? '—'}`
    );
  }

  console.log('\nStructure:');
  for (const s of t.structure?.stages ?? []) {
    console.log(`  stage ${s.id} kind=${s.kind} name=${s.name}`);
    if (s.groups?.length) {
      for (const g of s.groups) {
        console.log(
          `    group ${g.id} ${g.name} teams=${(g.teamIds ?? []).join(',')}`
        );
      }
    }
    if (s.bracket) {
      for (const r of s.bracket.rounds) {
        for (const slot of r.slots) {
          console.log(
            `    ${r.name} ${slot.label} id=${slot.id}: home=${slot.homeSeedLabel ?? slot.homeTeamId ?? '—'} away=${slot.awaySeedLabel ?? slot.awayTeamId ?? '—'} game=${slot.gameId ?? '—'} places w=${slot.winnerPlace ?? '—'} l=${slot.loserPlace ?? '—'} homeFrom=${slot.homeFromSlotId ?? '—'}/${slot.homeFromOutcome ?? '—'} awayFrom=${slot.awayFromSlotId ?? '—'}/${slot.awayFromOutcome ?? '—'}`
          );
        }
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
