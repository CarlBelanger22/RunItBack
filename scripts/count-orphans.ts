/**
 * Count players/games in DB that are hidden from the web app.
 * Usage: npx tsx scripts/count-orphans.ts
 */

import { loadEnvLocalIntoProcess } from './loadEnvLocal';

loadEnvLocalIntoProcess();

async function main(): Promise<void> {
  const { loadAppDataFromSupabase } = await import('../src/api/supabaseData');
  const { processLoadedAppData } = await import('../src/lib/appDataSnapshot');
  const { isOrphanedIncompleteGame } = await import('../src/utils/activeGame');

  const raw = await loadAppDataFromSupabase();
  const processed = processLoadedAppData(raw);

  const orphanGames = raw.games.filter(isOrphanedIncompleteGame);
  const shownGameIds = new Set(processed.games.map((g) => g.id));

  const onRoster = new Set(
    raw.teams.flatMap((t) => (t.players ?? []).map((p) => p.id))
  );
  const shownOrphans = raw.orphanPlayers.filter((p) => !onRoster.has(p.id));

  console.log('RunItBack — DB vs web app visibility\n');

  console.log('PLAYERS');
  console.log(`  Total player profiles in DB: ${raw.orphanPlayers.length + onRoster.size}`);
  console.log(`  On a team roster (shown on teams): ${onRoster.size}`);
  console.log(`  Orphan in DB (not on any team_players): ${raw.orphanPlayers.length}`);
  console.log(`  Orphan shown in app (Add Player pool only): ${shownOrphans.length}`);
  if (shownOrphans.length > 0) {
    console.log(`  Names: ${shownOrphans.map((p) => p.name).join(', ')}`);
  }

  console.log('\nGAMES');
  console.log(`  Total game rows loaded from DB: ${raw.games.length}`);
  console.log(`  Shown in app (after orphan filter): ${processed.games.length}`);
  console.log(`  Hidden orphan/incomplete games: ${orphanGames.length}`);
  for (const g of orphanGames) {
    const home = g.homeTeam?.abbreviation ?? g.homeTeamId;
    const away = g.awayTeam?.abbreviation ?? g.awayTeamId;
    console.log(
      `   - ${g.id} | ${home} vs ${away} | ${g.date} | active=${g.isActive} completed=${g.isCompleted}`
    );
  }

  console.log('\nOTHER');
  console.log(
    `  Orphan game IDs auto-deleted on load: ${processed.orphanGameIds.length}`
  );
  console.log(`  Tournament roster rows in DB: ${raw.tournamentRosters.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
