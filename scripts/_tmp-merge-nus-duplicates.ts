/**
 * Merge NUS duplicate profiles into NBL profiles that already have games.
 *
 *   Paolo Lim:   NUS → Xin Hua (xh-12-paolo)
 *   Zachary Gan: NUS → SBA (sba-00-zachary)
 *   Yifan Huang: NUS → Chong Ghee (cg-22-yifan)
 *
 * Usage: npx tsx scripts/_tmp-merge-nus-duplicates.ts [--apply]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv() {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

loadEnv();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

const apply = process.argv.includes('--apply');
const NUS = 'team-sunig-nus';
const SUNIG = 'tournament-1786255606272';

type Merge = {
  label: string;
  canonical: string;
  duplicate: string;
  nusNumber: number;
  nusPosition: string;
  bio: {
    height: string;
    weight: string;
    date_of_birth: string;
    position: string;
  };
};

const merges: Merge[] = [
  {
    label: 'Paolo Lim',
    canonical: 'player-nbl-d1-2026-xh-12-paolo',
    duplicate: 'player-sunig-nus-14-paolo',
    nusNumber: 14,
    nusPosition: 'PF',
    bio: {
      height: '187',
      weight: '80',
      date_of_birth: '2005-05-18',
      position: 'PF',
    },
  },
  {
    label: 'Zachary Gan',
    canonical: 'player-nbl-d1-2026-sba-00-zachary',
    duplicate: 'player-sunig-nus-00-zachary-gan',
    nusNumber: 0,
    nusPosition: 'SG',
    bio: {
      height: '178',
      weight: '74',
      date_of_birth: '2001-04-25',
      position: 'SG',
    },
  },
  {
    label: 'Yifan Huang',
    canonical: 'player-nbl-d1-2026-cg-22-yifan',
    duplicate: 'player-sunig-nus-22-yifan',
    nusNumber: 22,
    nusPosition: 'SG',
    bio: {
      height: '179',
      weight: '68',
      date_of_birth: '2000-02-19',
      // Keep NUS Sunig pos as SG on roster; profile position from NUS bio.
      position: 'SG',
    },
  },
];

function rewriteIdsInJson(value: unknown, from: string, to: string): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return value === from ? to : value;
  if (Array.isArray(value)) {
    return value.map((v) => rewriteIdsInJson(v, from, to));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (
        (k === 'playerId' ||
          k === 'player_id' ||
          k === 'assisterId' ||
          k === 'foulerId' ||
          k === 'stolenFromId' ||
          k === 'blockerId') &&
        v === from
      ) {
        out[k] = to;
      } else {
        out[k] = rewriteIdsInJson(v, from, to);
      }
    }
    return out;
  }
  return value;
}

async function main() {
  console.log(apply ? 'APPLY' : 'DRY-RUN');

  for (const m of merges) {
    console.log(`\n=== ${m.label}: ${m.duplicate} → ${m.canonical}`);

    const { data: canon } = await supabase
      .from('players')
      .select('*')
      .eq('id', m.canonical)
      .maybeSingle();
    if (!canon) throw new Error(`missing canonical ${m.canonical}`);

    const profilePatch = {
      height: m.bio.height || canon.height,
      weight: m.bio.weight || canon.weight,
      date_of_birth: m.bio.date_of_birth || canon.date_of_birth,
      position: m.bio.position || canon.position,
    };
    console.log(' profile enrich', profilePatch);

    console.log(
      ` team_players upsert ${NUS} #${m.nusNumber} → ${m.canonical}`
    );
    console.log(
      ` tournament_rosters upsert Sunig ${NUS} #${m.nusNumber} ${m.nusPosition}`
    );
    console.log(` delete duplicate team/roster/player ${m.duplicate}`);

    // Scan games for duplicate ids (should be none)
    const { data: games } = await supabase
      .from('games')
      .select('id,game_stats,events,shots,team_stats');
    const touched: string[] = [];
    for (const g of games ?? []) {
      const blob = JSON.stringify({
        game_stats: g.game_stats,
        events: g.events,
        shots: g.shots,
        team_stats: g.team_stats,
      });
      if (blob.includes(m.duplicate)) touched.push(g.id);
    }
    console.log(' games referencing duplicate', touched.length, touched);

    if (!apply) continue;

    const { error: pErr } = await supabase
      .from('players')
      .update(profilePatch)
      .eq('id', m.canonical);
    if (pErr) throw new Error(`players update: ${pErr.message}`);

    const { error: tpErr } = await supabase.from('team_players').upsert(
      {
        team_id: NUS,
        player_id: m.canonical,
        number: m.nusNumber,
      },
      { onConflict: 'team_id,player_id' }
    );
    if (tpErr) throw new Error(`team_players upsert: ${tpErr.message}`);

    let { error: trErr } = await supabase.from('tournament_rosters').upsert(
      {
        tournament_id: SUNIG,
        team_id: NUS,
        player_id: m.canonical,
        number: m.nusNumber,
        position: m.nusPosition,
        secondary_position: null,
      },
      { onConflict: 'tournament_id,team_id,player_id' }
    );
    if (trErr) {
      ({ error: trErr } = await supabase.from('tournament_rosters').upsert(
        {
          tournament_id: SUNIG,
          team_id: NUS,
          player_id: m.canonical,
          number: m.nusNumber,
          position: m.nusPosition,
          secondary_position: null,
        },
        { onConflict: 'tournament_id,player_id' }
      ));
    }
    if (trErr) throw new Error(`tournament_rosters: ${trErr.message}`);

    for (const gameId of touched) {
      const g = (games ?? []).find((x) => x.id === gameId)!;
      const next = {
        game_stats: rewriteIdsInJson(g.game_stats, m.duplicate, m.canonical),
        events: rewriteIdsInJson(g.events, m.duplicate, m.canonical),
        shots: rewriteIdsInJson(g.shots, m.duplicate, m.canonical),
        team_stats: rewriteIdsInJson(g.team_stats, m.duplicate, m.canonical),
      };
      const { error } = await supabase.from('games').update(next).eq('id', gameId);
      if (error) throw new Error(`game ${gameId}: ${error.message}`);
      console.log(' rewrote game', gameId);
    }

    const { error: dTp } = await supabase
      .from('team_players')
      .delete()
      .eq('player_id', m.duplicate);
    if (dTp) throw new Error(`delete team_players: ${dTp.message}`);

    const { error: dTr } = await supabase
      .from('tournament_rosters')
      .delete()
      .eq('player_id', m.duplicate);
    if (dTr) throw new Error(`delete tournament_rosters: ${dTr.message}`);

    const { error: dP } = await supabase
      .from('players')
      .delete()
      .eq('id', m.duplicate);
    if (dP) throw new Error(`delete player: ${dP.message}`);
  }

  if (!apply) {
    console.log('\nRe-run with --apply to write.');
    return;
  }

  console.log('\nVERIFY');
  for (const m of merges) {
    const { data: pl } = await supabase
      .from('players')
      .select('id,name,height,weight,date_of_birth,position')
      .eq('id', m.canonical)
      .maybeSingle();
    const { data: tp } = await supabase
      .from('team_players')
      .select('team_id,number')
      .eq('player_id', m.canonical);
    const { data: tr } = await supabase
      .from('tournament_rosters')
      .select('tournament_id,team_id,number,position')
      .eq('player_id', m.canonical);
    const { data: dup } = await supabase
      .from('players')
      .select('id')
      .eq('id', m.duplicate)
      .maybeSingle();
    console.log(m.label, {
      profile: pl,
      teams: tp,
      rosters: tr,
      duplicateGone: !dup,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
