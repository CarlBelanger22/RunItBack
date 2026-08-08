/**
 * Realize a tournament (oriented complete graph) with prescribed win counts.
 * Used by LE-130 to fill the 55 missing NBL Div 2 RR games among non–Kai Xuan teams.
 */

export type WinTarget = { id: string; wins: number };

export type DirectedEdge = { winnerId: string; loserId: string };

/**
 * Landau check: sorted ascending scores s[0] ≤ … ≤ s[n-1] with sum C(n,2)
 * and for every k < n, sum of first k ≥ C(k,2).
 */
export function isLandauScoreSequence(wins: number[]): boolean {
  const n = wins.length;
  const s = [...wins].sort((a, b) => a - b);
  const total = (n * (n - 1)) / 2;
  let sum = 0;
  for (let k = 0; k < n; k++) {
    if (s[k] < 0 || s[k] > n - 1) return false;
    sum += s[k];
    if (k < n - 1 && sum < (k * (k + 1)) / 2) return false;
  }
  return sum === total;
}

/**
 * Constructive realization via recursive Landau method:
 * give the strongest remaining team wins against the weakest opponents that
 * still have residual win capacity after accounting for forced losses.
 *
 * Returns directed edges (winner → loser), or null if impossible.
 */
export function realizeTournament(targets: WinTarget[]): DirectedEdge[] | null {
  if (!isLandauScoreSequence(targets.map((t) => t.wins))) return null;

  const n = targets.length;
  const ids = targets.map((t) => t.id);
  const need = new Map(targets.map((t) => [t.id, t.wins]));
  const edges: DirectedEdge[] = [];
  const decided = new Set<string>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  // Backtracking: try undecided pairs ordered by (remaining capacity tightness).
  const pairs: [string, string][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }

  function remainingGames(id: string): number {
    let left = 0;
    for (const other of ids) {
      if (other === id) continue;
      if (!decided.has(pairKey(id, other))) left++;
    }
    return left;
  }

  function feasible(): boolean {
    for (const id of ids) {
      const w = need.get(id)!;
      const left = remainingGames(id);
      if (w < 0 || w > left) return false;
    }
    // Partial Landau-ish: sum of remaining wins must equal remaining undecided pairs
    let remWins = 0;
    let remPairs = 0;
    for (const id of ids) remWins += need.get(id)!;
    for (const [a, b] of pairs) {
      if (!decided.has(pairKey(a, b))) remPairs++;
    }
    return remWins === remPairs;
  }

  function choosePair(): [string, string] | null {
    // Prefer pairs involving the team with fewest remaining games relative to needed wins.
    let best: [string, string] | null = null;
    let bestScore = Infinity;
    for (const [a, b] of pairs) {
      if (decided.has(pairKey(a, b))) continue;
      const ta = need.get(a)!;
      const tb = need.get(b)!;
      const la = remainingGames(a);
      const lb = remainingGames(b);
      // Tightness: forced decisions first
      const forceA = ta === la || ta === 0;
      const forceB = tb === lb || tb === 0;
      const score = (forceA || forceB ? 0 : 10) + Math.min(la, lb);
      if (score < bestScore) {
        bestScore = score;
        best = [a, b];
      }
    }
    return best;
  }

  function assign(winner: string, loser: string): boolean {
    const key = pairKey(winner, loser);
    if (decided.has(key)) return false;
    decided.add(key);
    need.set(winner, need.get(winner)! - 1);
    edges.push({ winnerId: winner, loserId: loser });
    return true;
  }

  function undo(winner: string, loser: string): void {
    const key = pairKey(winner, loser);
    decided.delete(key);
    need.set(winner, need.get(winner)! + 1);
    edges.pop();
  }

  function solve(): boolean {
    if (!feasible()) return false;
    const pair = choosePair();
    if (!pair) return true; // all decided

    const [a, b] = pair;
    const ta = need.get(a)!;
    const tb = need.get(b)!;
    const la = remainingGames(a);
    const lb = remainingGames(b);

    const tryOrder: Array<[string, string]> = [];
    // Forced orientations
    if (ta === la && tb === lb) {
      // both must win all remaining — impossible for this pair
      return false;
    }
    if (ta === la) tryOrder.push([a, b]);
    else if (tb === lb) tryOrder.push([b, a]);
    else if (ta === 0) tryOrder.push([b, a]);
    else if (tb === 0) tryOrder.push([a, b]);
    else {
      // Prefer giving the win to whoever is further behind relative to remaining
      const urgencyA = ta / la;
      const urgencyB = tb / lb;
      if (urgencyA >= urgencyB) {
        tryOrder.push([a, b], [b, a]);
      } else {
        tryOrder.push([b, a], [a, b]);
      }
    }

    for (const [w, l] of tryOrder) {
      assign(w, l);
      if (solve()) return true;
      undo(w, l);
    }
    return false;
  }

  if (!solve()) return null;
  return edges;
}
