/**
 * Capture a full milestone backup folder + RESTORE.md instructions.
 *
 * Usage:
 *   npm run backup:milestone
 *   npm run backup:milestone -- --slug milestone-2026-06-02-pre-next-phase
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { DEFAULT_MILESTONE_SLUG, ensureMilestoneDir } from './lib/backupPaths';

function parseArgs(): { slug: string } {
  const args = process.argv.slice(2);
  let slug = DEFAULT_MILESTONE_SLUG;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slug' && args[i + 1]) {
      slug = args[++i];
    }
  }

  return { slug };
}

function gitCommit(): string | null {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function fileSize(path: string): number | null {
  if (!existsSync(path)) return null;
  return statSync(path).size;
}

function runStep(label: string, command: string): void {
  console.log(`\n=== ${label} ===\n`);
  execSync(command, { stdio: 'inherit', cwd: process.cwd() });
}

function buildRestoreMarkdown(slug: string, manifest: Record<string, unknown>): string {
  const dir = `backups/${slug}`;
  return `# Restore RunItBack to milestone backup

**Backup folder:** \`${dir}\`  
**Created:** ${manifest.exportedAt}  
**Git commit (code):** ${manifest.gitCommit ?? 'unknown'}  
**League ID:** ${manifest.leagueId}

This checkpoint was taken before the next development phase. Use these steps if you need to roll Supabase back to this point in time.

---

## What is in this folder

| File | Purpose |
|------|---------|
| \`raw-tables.json\` | **Primary restore** — every Postgres row for the league |
| \`runitback-league.json\` | App-shaped export (teams, games, tournament rosters) |
| \`postgres.dump\` | Optional full Postgres dump (only if \`pg_dump\` was available) |
| \`storage/\` | Team and tournament icon PNGs from Supabase Storage |
| \`MANIFEST.json\` | Counts, file sizes, metadata |

**Code:** check out git commit \`${manifest.gitCommit ?? 'see MANIFEST.json'}\` if you also need the app code from this milestone.

---

## Before you restore

1. **Stop editing data** — close the app or avoid saves while restoring.
2. **Confirm \`.env.local\`** points at the Supabase project you want to roll back.
3. **Read the counts** in \`MANIFEST.json\` so you know what “good” looks like after restore.

---

## Option A — Full league restore (recommended)

Uses \`raw-tables.json\`. Wipes the current league in Supabase, then re-inserts backup rows.

\`\`\`bash
# 1. Dry run (no writes)
npm run restore:supabase-raw -- --file ${dir}/raw-tables.json --dry-run

# 2. Apply restore
npm run restore:supabase-raw -- --file ${dir}/raw-tables.json --apply

# 3. Restore Storage icons (if bucket was cleared or icons are broken)
npm run backup:team-assets -- --restore --from ${dir}/storage

# 4. Hard-refresh the app and spot-check
\`\`\`

**Verify after restore:**
- Game count matches MANIFEST (\`${(manifest.counts as { games?: number })?.games ?? '?'} games\`)
- Tournament roster / jersey numbers (JN-1) look correct
- Sample box scores open (e.g. AUSF 3×3 NTU games)

---

## Option B — Postgres pg_restore (if \`postgres.dump\` exists)

Requires \`pg_restore\` and \`SUPABASE_DB_URL\` in \`.env.local\`.

\`\`\`bash
pg_restore --clean --if-exists -d "$SUPABASE_DB_URL" ${dir}/postgres.dump
npm run backup:team-assets -- --restore --from ${dir}/storage
\`\`\`

**Warning:** This replaces **all** public schema objects in the dump scope. Prefer Option A if you only need the RunItBack league.

---

## Option C — App JSON restore (secondary)

Upserts via the app save path. Does **not** delete rows added after the backup. Use only for partial repair, or after Option A on an empty league.

\`\`\`bash
npm run restore:supabase -- --file ${dir}/runitback-league.json --dry-run
npm run restore:supabase -- --file ${dir}/runitback-league.json --apply
\`\`\`

---

## Re-capture this backup on another machine

\`\`\`bash
npm run backup:milestone -- --slug ${slug}
\`\`\`

For \`postgres.dump\`, install Postgres client tools and add \`SUPABASE_DB_URL\` to \`.env.local\`, then:

\`\`\`bash
npm run backup:postgres -- --slug ${slug}
\`\`\`

---

## Do not use for restore

- \`npm run import:local\` — outdated; missing \`tournament_rosters\` and current schema.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Restore fails on delete | Check Supabase RLS policies (dev policies should allow all) |
| Icons missing after DB restore | Run \`backup:team-assets --restore\` |
| Game stats empty | Restore from \`raw-tables.json\`, not \`import:local\` |
| Wrong project | Fix \`VITE_SUPABASE_URL\` in \`.env.local\` before running restore |
`;
}

async function main(): Promise<void> {
  const { slug } = parseArgs();
  const dir = ensureMilestoneDir(process.cwd(), slug);
  const exportedAt = new Date().toISOString();
  const commit = gitCommit();

  console.log(`RunItBack — milestone backup → ${dir}\n`);

  runStep('League JSON export', `npm run export:supabase -- --slug ${slug}`);
  runStep('Raw table export', `npm run backup:supabase-raw -- --slug ${slug}`);
  runStep('Storage icons', `npm run backup:team-assets -- --slug ${slug}`);
  runStep('Postgres dump (optional)', `npm run backup:postgres -- --slug ${slug}`);

  const leagueJson = join(dir, 'runitback-league.json');
  const rawJson = join(dir, 'raw-tables.json');
  const pgDump = join(dir, 'postgres.dump');
  const storageDir = join(dir, 'storage');

  let counts = {
    teams: 0,
    tournaments: 0,
    games: 0,
    tournamentRosters: 0,
    players: 0,
  };

  if (existsSync(leagueJson)) {
    const league = JSON.parse(readFileSync(leagueJson, 'utf8')) as {
      teams?: unknown[];
      tournaments?: unknown[];
      games?: unknown[];
      tournamentRosters?: unknown[];
    };
    counts = {
      teams: league.teams?.length ?? 0,
      tournaments: league.tournaments?.length ?? 0,
      games: league.games?.length ?? 0,
      tournamentRosters: league.tournamentRosters?.length ?? 0,
      players: 0,
    };
  }

  if (existsSync(rawJson)) {
    const raw = JSON.parse(readFileSync(rawJson, 'utf8')) as {
      tables?: { players?: unknown[] };
    };
    counts.players = raw.tables?.players?.length ?? counts.players;
  }

  const manifest = {
    backupVersion: 1,
    slug,
    label: 'Pre-next-phase milestone',
    exportedAt,
    gitCommit: commit,
    leagueId: 'league-default',
    counts,
    files: {
      runitbackLeagueJson: { path: 'runitback-league.json', bytes: fileSize(leagueJson) },
      rawTablesJson: { path: 'raw-tables.json', bytes: fileSize(rawJson) },
      postgresDump: { path: 'postgres.dump', bytes: fileSize(pgDump) },
      storageDir: { path: 'storage/', exists: existsSync(storageDir) },
    },
  };

  writeFileSync(join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');
  writeFileSync(
    join(dir, 'RESTORE.md'),
    buildRestoreMarkdown(slug, manifest),
    'utf8'
  );

  console.log('\n=== Done ===\n');
  console.log(`  ${join(dir, 'MANIFEST.json')}`);
  console.log(`  ${join(dir, 'RESTORE.md')}`);
  console.log(`  games: ${counts.games}, teams: ${counts.teams}, rosters: ${counts.tournamentRosters}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
