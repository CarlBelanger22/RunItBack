/**
 * Create NUS club roster + Sunig 2026 tournament tags.
 * Usage: npx tsx scripts/_tmp-create-nus-roster.ts [--apply]
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

const TEAM_ID = 'team-sunig-nus';
const TOURNAMENT_ID = 'tournament-1786255606272';
const LEAGUE_ID = 'league-default';
const apply = process.argv.includes('--apply');

type Row = {
  id: string;
  number: number;
  name: string;
  position: string;
  date_of_birth: string;
  height: string;
  weight: string;
};

function ageFromDob(dob: string, asOf = new Date('2026-09-10')): number {
  const [y, m, d] = dob.split('-').map(Number);
  let age = asOf.getFullYear() - y;
  const md = asOf.getMonth() + 1 - m;
  if (md < 0 || (md === 0 && asOf.getDate() < d)) age -= 1;
  return age;
}

const players: Row[] = [
  {
    id: 'player-sunig-nus-02-kaixun',
    number: 2,
    name: 'Kaixun Teow',
    position: 'PG',
    date_of_birth: '2003-02-05',
    height: '179',
    weight: '83',
  },
  {
    id: 'player-sunig-nus-24-zeyuan',
    number: 24,
    name: 'Zeyuan Jing',
    position: 'SF',
    date_of_birth: '2001-04-19',
    height: '183',
    weight: '84',
  },
  {
    id: 'player-sunig-nus-17-sebastian',
    number: 17,
    name: 'Sebastian Tan',
    position: 'C',
    date_of_birth: '2005-05-24',
    height: '195',
    weight: '87',
  },
  {
    id: 'player-sunig-nus-12-beck',
    number: 12,
    name: 'Beck Low',
    position: 'SF',
    date_of_birth: '2005-08-22',
    height: '180',
    weight: '80',
  },
  {
    id: 'player-sunig-nus-03-matthew',
    number: 3,
    name: 'Matthew Biju George',
    position: 'SF',
    date_of_birth: '2004-09-24',
    height: '185',
    weight: '79',
  },
  {
    id: 'player-sunig-nus-14-paolo',
    number: 14,
    name: 'Paolo Lim',
    position: 'PF',
    date_of_birth: '2005-05-18',
    height: '187',
    weight: '80',
  },
  {
    id: 'player-sunig-nus-09-mingzhan',
    number: 9,
    name: 'Mingzhan Cheong',
    position: 'PG',
    date_of_birth: '2004-10-01',
    height: '178',
    weight: '73',
  },
  {
    id: 'player-sunig-nus-21-mekhi',
    number: 21,
    name: 'Mekhi William Anthony Kakaire Hendry',
    position: 'SF',
    date_of_birth: '2006-02-09',
    height: '183',
    weight: '85',
  },
  {
    id: 'player-sunig-nus-13-zachary-ng',
    number: 13,
    name: 'Zachary Ng',
    position: 'SG',
    date_of_birth: '2004-07-22',
    height: '180',
    weight: '75',
  },
  {
    id: 'player-sunig-nus-22-yifan',
    number: 22,
    name: 'Yifan Huang',
    position: 'SG',
    date_of_birth: '2000-02-19',
    height: '179',
    weight: '68',
  },
  {
    id: 'player-sunig-nus-11-auyeung',
    number: 11,
    name: 'Auyeung San Mau',
    position: 'C',
    date_of_birth: '2003-11-23',
    height: '195',
    weight: '95',
  },
  {
    id: 'player-sunig-nus-34-srijesh',
    number: 34,
    name: 'Srijesh Sharma',
    position: 'PG',
    date_of_birth: '2004-12-11', // locked as DD.MM → 11 Dec 2004
    height: '180',
    weight: '80',
  },
  {
    id: 'player-sunig-nus-10-yancheng',
    number: 10,
    name: 'Yancheng Chen',
    position: 'SG',
    date_of_birth: '1988-06-10',
    height: '180',
    weight: '92',
  },
  {
    id: 'player-sunig-nus-35-weiyang',
    number: 35,
    name: 'Weiyang Tan',
    position: 'PF',
    date_of_birth: '2004-08-05',
    height: '188',
    weight: '80',
  },
  {
    id: 'player-sunig-nus-00-zachary-gan',
    number: 0,
    name: 'Zachary Gan',
    position: 'SG',
    date_of_birth: '2001-04-25',
    height: '178',
    weight: '74',
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
      `#${p.number} ${p.name} ${p.position} dob=${p.date_of_birth} ${p.height}/${p.weight}`
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
    .select('id,name')
    .in('id', ids);
  const { data: rost } = await supabase
    .from('tournament_rosters')
    .select('player_id')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('team_id', TEAM_ID);

  const byId = new Map((found ?? []).map((p) => [p.id, p.name]));
  console.log(
    'VERIFY club',
    links?.length,
    (links ?? [])
      .sort((a, b) => a.number - b.number)
      .map((l) => `#${l.number} ${byId.get(l.player_id)}`)
  );
  console.log('VERIFY sunig tags', rost?.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
