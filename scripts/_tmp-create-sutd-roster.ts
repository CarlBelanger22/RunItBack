/**
 * Create SUTD club roster + Sunig 2026 tournament tags.
 * Usage: npx tsx scripts/_tmp-create-sutd-roster.ts [--apply]
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

const TEAM_ID = 'team-sunig-sutd';
const TOURNAMENT_ID = 'tournament-1786255606272';
const LEAGUE_ID = 'league-default';
const apply = process.argv.includes('--apply');

type Row = {
  id: string;
  number: number;
  name: string;
  position: string;
  date_of_birth: string | null;
  height: string;
  weight: string;
};

function ageFromDob(dob: string | null, asOf = new Date('2026-09-10')): number {
  if (!dob) return 0;
  const [y, m, d] = dob.split('-').map(Number);
  let age = asOf.getFullYear() - y;
  const md = asOf.getMonth() + 1 - m;
  if (md < 0 || (md === 0 && asOf.getDate() < d)) age -= 1;
  return age;
}

const players: Row[] = [
  {
    id: 'player-sunig-sutd-03-joseph',
    number: 3,
    name: 'Joseph Rodfel Salas Mauricio',
    position: 'PG',
    date_of_birth: '2002-04-17',
    height: '179',
    weight: '81',
  },
  {
    id: 'player-sunig-sutd-21-santiago',
    number: 21,
    name: 'Santiago De Castro Sacro',
    position: 'C',
    date_of_birth: '2003-04-09',
    height: '184',
    weight: '88',
  },
  {
    id: 'player-sunig-sutd-09-yien',
    number: 9,
    name: 'Yien Lin',
    position: 'PG',
    date_of_birth: '2004-11-15',
    height: '173',
    weight: '63',
  },
  {
    id: 'player-sunig-sutd-11-jinee',
    number: 11,
    name: 'Jinee Lim',
    position: 'SG',
    date_of_birth: '2003-12-09',
    height: '172',
    weight: '65',
  },
  {
    id: 'player-sunig-sutd-08-dylan',
    number: 8,
    name: 'Dylan Soh',
    position: 'SF',
    date_of_birth: '2004-02-26',
    height: '177',
    weight: '70',
  },
  {
    id: 'player-sunig-sutd-20-prethve',
    number: 20,
    name: 'Prethve Deev Anithaa Pandian',
    position: 'SG',
    date_of_birth: null,
    height: '166',
    weight: '55',
  },
  {
    id: 'player-sunig-sutd-12-russell',
    number: 12,
    name: 'Russell Thong',
    position: 'SF',
    date_of_birth: '2002-02-07',
    height: '178',
    weight: '87',
  },
  {
    id: 'player-sunig-sutd-55-johanes',
    number: 55,
    name: 'Johanes Setiawan',
    position: 'PG',
    date_of_birth: '2003-03-01',
    height: '174',
    weight: '74',
  },
  {
    id: 'player-sunig-sutd-00-caleb',
    number: 0,
    name: 'Caleb Wee',
    position: 'SG',
    date_of_birth: '2004-08-30',
    height: '174',
    weight: '82',
  },
  {
    id: 'player-sunig-sutd-07-troy',
    number: 7,
    name: 'Troy Han',
    position: 'SF',
    date_of_birth: '2003-06-20',
    height: '180',
    weight: '88',
  },
  {
    id: 'player-sunig-sutd-22-xinyu',
    number: 22,
    name: 'Xinyu Ye',
    position: 'PG',
    date_of_birth: '2001-07-08',
    height: '172',
    weight: '82',
  },
  {
    id: 'player-sunig-sutd-36-anirudh',
    number: 36,
    name: 'Anirudh Banerjee',
    position: 'SG',
    date_of_birth: '2006-11-23',
    height: '178',
    weight: '74',
  },
  {
    id: 'player-sunig-sutd-06-justin',
    number: 6,
    name: 'Justin Carlos Fenol Mangiliman',
    position: 'SF',
    date_of_birth: '2002-01-19',
    height: '183',
    weight: '71',
  },
  {
    id: 'player-sunig-sutd-17-kajun',
    number: 17,
    name: 'Kajun Yap',
    position: 'SG',
    date_of_birth: '2002-02-04',
    height: '177',
    weight: '70',
  },
  {
    id: 'player-sunig-sutd-27-derek',
    number: 27,
    name: 'Derek Teo',
    position: 'SG',
    date_of_birth: '2003-01-12',
    height: '174',
    weight: '72',
  },
];

async function main() {
  console.log(apply ? 'APPLY' : 'DRY-RUN', players.length, 'players');

  const playerRows = players.map((p) => ({
    id: p.id,
    league_id: LEAGUE_ID,
    name: p.name,
    height: p.height,
    weight: p.weight,
    position: p.position,
    secondary_position: null,
    date_of_birth: p.date_of_birth,
    age: ageFromDob(p.date_of_birth),
  }));

  const teamLinks = players.map((p) => ({
    team_id: TEAM_ID,
    player_id: p.id,
    number: p.number,
  }));

  const rosterRows = players.map((p) => ({
    tournament_id: TOURNAMENT_ID,
    team_id: TEAM_ID,
    player_id: p.id,
    number: p.number,
    position: p.position,
    secondary_position: null,
  }));

  for (const p of players) {
    console.log(
      `#${p.number} ${p.name} ${p.position} dob=${p.date_of_birth ?? 'blank'} ${p.height}/${p.weight}`
    );
  }

  if (!apply) {
    console.log('Re-run with --apply to write.');
    return;
  }

  const { error: pErr } = await supabase
    .from('players')
    .upsert(playerRows, { onConflict: 'id' });
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

  const { data: links } = await supabase
    .from('team_players')
    .select('player_id,number')
    .eq('team_id', TEAM_ID);
  const ids = (links ?? []).map((l) => l.player_id);
  const { data: found } = await supabase
    .from('players')
    .select('id,name,date_of_birth,position')
    .in('id', ids);
  const { data: rost } = await supabase
    .from('tournament_rosters')
    .select('player_id,number')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('team_id', TEAM_ID);

  const byId = new Map((found ?? []).map((p) => [p.id, p]));
  console.log(
    'VERIFY club',
    links?.length,
    (links ?? [])
      .sort((a, b) => a.number - b.number)
      .map((l) => `#${l.number} ${byId.get(l.player_id)?.name}`)
  );
  console.log('VERIFY sunig tags', rost?.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
