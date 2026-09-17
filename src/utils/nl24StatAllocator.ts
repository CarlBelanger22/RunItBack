/**
 * Distribute locked 3×3 makes + season targets into per-game box rows.
 * Season sums match targets exactly; per-game noise stays near the mean (±2–3).
 * REB split: ~70% DRB / 30% ORB, DRB first (remainder to DRB).
 */

export type LockedMakes = {
  one: number;
  two: number;
  ft: number;
};

export type SeasonTarget = {
  fgM: number;
  fgA: number;
  threeM: number;
  threeA: number;
  ftM: number;
  ftA: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
  fd: number;
};

export type AllocatedGameStats = {
  points: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  orb: number;
  drb: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  tech_fouls: number;
  unsportsmanlike_fouls: number;
  fouls_drawn: number;
  blocks_received: number;
  plus_minus: number;
  minutes_played: number;
};

/** Deterministic PRNG (mulberry32). */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

/**
 * Distribute `total` non-negative integers across n slots.
 * Each slot i must be >= mins[i]. Result stays within ±spread of the
 * residual mean when possible, while preserving the exact sum.
 */
export function distributeExact(
  total: number,
  mins: number[],
  rng: () => number,
  spread = 3
): number[] {
  const n = mins.length;
  assert(n > 0, 'distributeExact: empty');
  assert(Number.isInteger(total) && total >= 0, 'distributeExact: bad total');
  const minSum = mins.reduce((a, b) => a + b, 0);
  assert(total >= minSum, `distributeExact: total ${total} < mins ${minSum}`);

  const out = mins.map((m) => m);
  let remaining = total - minSum;

  // Fill evenly first.
  while (remaining > 0) {
    for (let i = 0; i < n && remaining > 0; i++) {
      out[i]++;
      remaining--;
    }
  }

  // Random pairwise transfers within ±spread of residual mean.
  const residualMean = (total - minSum) / n;
  const lo = (i: number) => mins[i] + Math.max(0, Math.floor(residualMean) - spread);
  const hi = (i: number) => mins[i] + Math.ceil(residualMean) + spread;

  for (let step = 0; step < n * 40; step++) {
    const i = Math.floor(rng() * n);
    const j = Math.floor(rng() * n);
    if (i === j) continue;
    if (out[i] <= lo(i)) continue;
    if (out[j] >= hi(j)) continue;
    out[i]--;
    out[j]++;
  }

  return out;
}

/** Split reb into ORB/DRB with ~30/70, DRB first (gets remainder). */
export function splitReb(reb: number): { orb: number; drb: number } {
  assert(Number.isInteger(reb) && reb >= 0, 'splitReb: bad reb');
  const orb = Math.floor(reb * 0.3);
  return { orb, drb: reb - orb };
}

export function pointsFromMakes(m: LockedMakes): number {
  return m.one + 2 * m.two + m.ft;
}

export function allocatePlayerSeasonStats(
  gameMakes: LockedMakes[],
  target: SeasonTarget,
  seed: number
): AllocatedGameStats[] {
  const n = gameMakes.length;
  assert(n > 0, 'no games');

  const sumOne = gameMakes.reduce((a, m) => a + m.one, 0);
  const sumTwo = gameMakes.reduce((a, m) => a + m.two, 0);
  const sumFt = gameMakes.reduce((a, m) => a + m.ft, 0);
  const sumFg = sumOne + sumTwo;

  assert(sumFg === target.fgM, `fgM ${sumFg} !== ${target.fgM}`);
  assert(sumTwo === target.threeM, `threeM ${sumTwo} !== ${target.threeM}`);
  assert(sumFt === target.ftM, `ftM ${sumFt} !== ${target.ftM}`);
  assert(target.fgA >= target.fgM, 'fgA < fgM');
  assert(target.threeA >= target.threeM, 'threeA < threeM');
  assert(target.ftA >= target.ftM, 'ftA < ftM');
  assert(target.fgA - target.fgM >= target.threeA - target.threeM, 'fg misses < three misses');

  const rng = createRng(seed);
  const zeroMins = () => Array(n).fill(0) as number[];

  const threeMiss = distributeExact(target.threeA - target.threeM, zeroMins(), rng);
  const oneMissTotal = target.fgA - target.fgM - (target.threeA - target.threeM);
  const oneMiss = distributeExact(oneMissTotal, zeroMins(), rng);
  const ftMiss = distributeExact(target.ftA - target.ftM, zeroMins(), rng);

  const reb = distributeExact(target.reb, zeroMins(), rng);
  const ast = distributeExact(target.ast, zeroMins(), rng);
  const stl = distributeExact(target.stl, zeroMins(), rng);
  const blk = distributeExact(target.blk, zeroMins(), rng);
  const to = distributeExact(target.to, zeroMins(), rng);
  const fd = distributeExact(target.fd, zeroMins(), rng);

  return gameMakes.map((m, i) => {
    const fg_made = m.one + m.two;
    const three_made = m.two;
    const ft_made = m.ft;
    const three_attempted = three_made + threeMiss[i];
    const fg_attempted = fg_made + oneMiss[i] + threeMiss[i];
    const ft_attempted = ft_made + ftMiss[i];
    const { orb, drb } = splitReb(reb[i]);

    assert(fg_attempted >= fg_made, 'fgA < fgM game');
    assert(three_attempted >= three_made, '3A < 3M game');
    assert(ft_attempted >= ft_made, 'ftA < ftM game');
    assert(fg_attempted - three_attempted >= m.one, '1PT A < 1PT M');

    return {
      points: pointsFromMakes(m),
      fg_made,
      fg_attempted,
      three_made,
      three_attempted,
      ft_made,
      ft_attempted,
      orb,
      drb,
      assists: ast[i],
      steals: stl[i],
      blocks: blk[i],
      turnovers: to[i],
      fouls: 0,
      tech_fouls: 0,
      unsportsmanlike_fouls: 0,
      fouls_drawn: fd[i],
      blocks_received: 0,
      plus_minus: 0,
      minutes_played: 0,
    };
  });
}
