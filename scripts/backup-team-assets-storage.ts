/**
 * Download team-assets Storage bucket icons to local folder.
 *
 * Usage:
 *   npm run backup:team-assets
 *   npm run backup:team-assets -- --out backups/milestone-.../storage
 *   npm run backup:team-assets -- --restore --from backups/milestone-.../storage
 */

import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { pipeline } from 'stream/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TEAM_ASSETS_BUCKET, type TeamAssetKind } from '../src/lib/teamAssetStorage';
import { DEFAULT_MILESTONE_SLUG, ensureMilestoneDir } from './lib/backupPaths';
import { requireSupabaseCliClient } from './lib/supabaseCli';

async function listAllObjects(
  supabase: SupabaseClient,
  prefix: string
): Promise<string[]> {
  const names: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(TEAM_ASSETS_BUCKET)
      .list(prefix, { limit: 100, offset });
    if (error) {
      throw new Error(`storage list ${prefix}: ${error.message}`);
    }
    if (!data?.length) break;

    for (const item of data) {
      if (item.name && !item.name.endsWith('/')) {
        names.push(item.name);
      }
    }

    offset += data.length;
    if (data.length < 100) break;
  }

  return names;
}

async function downloadKind(
  supabase: SupabaseClient,
  kind: TeamAssetKind,
  outRoot: string
): Promise<number> {
  const files = await listAllObjects(supabase, kind);
  const outDir = join(outRoot, kind);
  mkdirSync(outDir, { recursive: true });

  let count = 0;
  for (const fileName of files) {
    const storagePath = `${kind}/${fileName}`;
    const { data, error } = await supabase.storage
      .from(TEAM_ASSETS_BUCKET)
      .download(storagePath);
    if (error) {
      console.warn(`  skip ${storagePath}: ${error.message}`);
      continue;
    }

    const dest = join(outDir, fileName);
    const buffer = Buffer.from(await data.arrayBuffer());
    await pipeline(
      (async function* () {
        yield buffer;
      })(),
      createWriteStream(dest)
    );
    count++;
    console.log(`  downloaded ${storagePath}`);
  }

  return count;
}

async function restoreKind(
  supabase: SupabaseClient,
  kind: TeamAssetKind,
  fromRoot: string
): Promise<number> {
  const dir = join(fromRoot, kind);
  if (!existsSync(dir)) {
    console.log(`  no ${kind}/ folder, skipping`);
    return 0;
  }

  let count = 0;
  for (const fileName of readdirSync(dir)) {
    if (!fileName.endsWith('.png')) continue;
    const storagePath = `${kind}/${fileName}`;
    const bytes = readFileSync(join(dir, fileName));
    const { error } = await supabase.storage.from(TEAM_ASSETS_BUCKET).upload(storagePath, bytes, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '31536000',
    });
    if (error) {
      throw new Error(`upload ${storagePath}: ${error.message}`);
    }
    count++;
    console.log(`  uploaded ${storagePath}`);
  }

  return count;
}

function parseArgs(): {
  out: string;
  slug: string;
  restore: boolean;
  from: string;
} {
  const args = process.argv.slice(2);
  let out = '';
  let slug = DEFAULT_MILESTONE_SLUG;
  let restore = false;
  let from = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      out = resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--slug' && args[i + 1]) {
      slug = args[++i];
    } else if (args[i] === '--from' && args[i + 1]) {
      from = resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--restore') {
      restore = true;
    }
  }

  if (!out && !from) {
    out = resolve(ensureMilestoneDir(process.cwd(), slug), 'storage');
  }
  if (restore && !from) {
    from = out;
  }

  return { out, slug, restore, from };
}

async function main(): Promise<void> {
  const { out, restore, from } = parseArgs();
  const supabase = requireSupabaseCliClient();

  if (restore) {
    console.log(`RunItBack — restore team-assets from ${from}\n`);
    const teams = await restoreKind(supabase, 'teams', from);
    const tournaments = await restoreKind(supabase, 'tournaments', from);
    console.log(`\nRestored ${teams + tournaments} file(s).`);
    return;
  }

  mkdirSync(out, { recursive: true });
  console.log(`RunItBack — backup team-assets → ${out}\n`);

  const teams = await downloadKind(supabase, 'teams', out);
  const tournaments = await downloadKind(supabase, 'tournaments', out);
  console.log(`\nDownloaded ${teams + tournaments} file(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
