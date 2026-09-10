/**
 * Restore 7 SUSS ghost tournament-roster player ids into players + club + Sunig roster.
 * Usage: npx tsx scripts/_tmp-restore-suss-ghost-players.ts [--apply]
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

const TEAM_ID = 'team-sunig-suss';
const TOURNAMENT_ID = 'tournament-1786255606272';
const LEAGUE_ID = 'league-default';
const apply = process.argv.includes('--apply');

type Profile = {
  id: string;
  number: number;
  name: string;
  height: string;
  weight: string;
  position: string;
  secondary_position: string | null;
};

/** Preserve browser ghost ids so pending tournament_rosters upserts succeed. */
const ghostPlayers: Profile[] = [
  {
    id: 'player-1788948684495',
    number: 4,
    name: 'Ang Zi Yang',
    height: '175',
    weight: '70',
    position: 'SF',
    secondary_position: null,
  },
  {
    id: 'player-1788948749987',
    number: 6,
    name: 'Huang Kaiyu',
    height: '165',
    weight: '74',
    position: 'PG',
    secondary_position: null,
  },
  {
    id: 'player-1788948638096',
    number: 15,
    name: 'Sim Hwee How',
    height: '185',
    weight: '95', // list said 950kg — treated as typo
    position: 'PF',
    secondary_position: 'C',
  },
  {
    id: 'player-1788948805829',
    number: 22,
    name: 'Ong Seanne Patrick Marinas',
    height: '166',
    weight: '67',
    position: 'PG',
    secondary_position: null,
  },
  {
    id: 'player-1788948661469',
    number: 32,
    name: 'Desmond Loh',
    height: '182',
    weight: '106',
    position: 'PF',
    secondary_position: 'C',
  },
  {
    id: 'player-1788948607782',
    number: 34,
    name: 'Bryan Koo Zhuang Yuan',
    height: '181',
    weight: '101',
    position: 'PF',
    secondary_position: 'C',
  },
  {
    id: 'player-1788948718964',
    number: 89,
    name: 'Amos Sin Chin Hong',
    height: '183',
    weight: '',
    position: 'SF',
    secondary_position: null,
  },
];

const existingUpdates: Profile[] = [
  {
    id: 'player-1780482892675',
    number: 14,
    name: 'Eldridge Ocaña Santamina',
    height: '185',
    weight: '85',
    position: 'SF',
    secondary_position: 'PF',
  },
  {
    id: 'player-1788948387478',
    number: 8,
    name: 'Aloysius Lee Jia Wei',
    height: '173',
    weight: '82',
    position: 'PG',
    secondary_position: null,
  },
  {
    id: 'player-nbl-d1-2026-xh-02-kerk',
    number: 2,
    name: 'Kerk Xuan Xian',
    height: '181',
    weight: '86',
    position: 'SG',
    secondary_position: 'SF',
  },
  {
    id: 'player-1788948457832',
    number: 13,
    name: 'Heng Wei Kai Dionysus',
    height: '183',
    weight: '78',
    position: 'SF',
    secondary_position: null,
  },
  {
    id: 'player-1788948510031',
    number: 10,
    name: 'Toh Jia Wei Brandon Scott',
    height: '177',
    weight: '70',
    position: 'SF',
    secondary_position: null,
  },
  {
    id: 'player-1788948539066',
    number: 7,
    name: 'Oh Jian Liang',
    height: '168',
    weight: '70',
    position: 'PG',
    secondary_position: null,
  },
  {
    id: 'player-1788948559501',
    number: 11,
    name: 'Goh Zong Han',
    height: '188',
    weight: '97',
    position: 'C',
    secondary_position: null,
  },
  {
    id: 'player-1788948586074',
    number: 5,
    name: 'Ser Kai Le',
    height: '175',
    weight: '78',
    position: 'SF',
    secondary_position: null,
  },
];

function playerRow(p: Profile) {
  return {
    id: p.id,
    league_id: LEAGUE_ID,
    name: p.name,
    height: p.height,
    weight: p.weight,
    position: p.position,
    secondary_position: p.secondary_position,
    age: 0,
  };
}

async function main() {
  console.log(apply ? 'APPLY' : 'DRY-RUN');

  const all = [...ghostPlayers, ...existingUpdates];
  const playerUpserts = all.map(playerRow);
  const teamLinks = all.map((p) => ({
    team_id: TEAM_ID,
    player_id: p.id,
    number: p.number,
  }));
  const rosterRows = ghostPlayers.map((p) => ({
    tournament_id: TOURNAMENT_ID,
    team_id: TEAM_ID,
    player_id: p.id,
    number: p.number,
    position: p.position,
    secondary_position: p.secondary_position,
  }));

  console.log(
    'ghosts',
    ghostPlayers.map((p) => `#${p.number} ${p.name}`)
  );

  if (!apply) {
    console.log('Re-run with --apply to write.');
    return;
  }

  const { error: pErr } = await supabase
    .from('players')
    .upsert(playerUpserts, { onConflict: 'id' });
  if (pErr) throw new Error(`players: ${pErr.message}`);

  const { error: tpErr } = await supabase
    .from('team_players')
    .upsert(teamLinks, { onConflict: 'team_id,player_id' });
  if (tpErr) throw new Error(`team_players: ${tpErr.message}`);

  let { error: trErr } = await supabase
    .from('tournament_rosters')
    .upsert(rosterRows, { onConflict: 'tournament_id,team_id,player_id' });
  if (trErr) {
    ({ error: trErr } = await supabase
      .from('tournament_rosters')
      .upsert(rosterRows, { onConflict: 'tournament_id,player_id' }));
  }
  if (trErr) throw new Error(`tournament_rosters: ${trErr.message}`);

  const ids = ghostPlayers.map((p) => p.id);
  const { data: found } = await supabase
    .from('players')
    .select('id,name,height,weight,position')
    .in('id', ids);
  const { data: links } = await supabase
    .from('team_players')
    .select('player_id,number')
    .eq('team_id', TEAM_ID);
  const { data: rost } = await supabase
    .from('tournament_rosters')
    .select('player_id,number,position')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('team_id', TEAM_ID)
    .in('player_id', ids);

  console.log(
    'VERIFY ghosts',
    (found ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => `${p.name} ${p.height}/${p.weight} ${p.position}`)
  );
  console.log(
    'VERIFY SUSS club size',
    links?.length,
    (links ?? [])
      .sort((a, b) => a.number - b.number)
      .map((l) => `#${l.number}`)
      .join(' ')
  );
  console.log(
    'VERIFY Sunig roster ghosts',
    (rost ?? []).map((r) => `#${r.number}`).join(' ')
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
