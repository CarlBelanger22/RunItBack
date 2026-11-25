# RunItBack Performance Audit (Phase 1)

**Date:** 2026-11-26  
**Mode:** Designer — audit only (no application code changes in this phase)  
**Constraint:** Optimizations must not change player stats, metrics, awards formulas, or tie-breakers — identical numbers only.

**Observed symptom:** Chrome “Page Unresponsive” / Wait vs Exit while browsing (especially `?tab=awards`), plus occasional unclickable/hung UI during live scoring or large tournament views.

**Scale context:** ~30+ tournaments, ~1,000+ players, ~800+ games with embedded `game_stats` / `events` / `shots` loaded client-side.

---

## Executive verdict

This is **not** primarily a Realtime-leak or auth-deadlock app. There are **no** `supabase.channel` / Realtime subscriptions in `src/`. Auth `onAuthStateChange` does **not** await DB work.

The freezes are almost entirely:

1. **Synchronous O(games × box rows × roster/league scans)** on the main thread  
2. **Unmemoized TournamentPage** recomputing standings + leaders on every render  
3. **Awards mounting three full aggregation pipelines**  
4. **Full-league `games.select('*')`** pulling all PBP/shots into memory, then **`JSON.stringify` deep-diffing the entire `games[]`** on live updates  

“Random” = user hit a heavy tab / busy re-render / large season. Small cups often feel fine.

---

## Confirmed issues (ranked)

Severity: **Critical** = multi-second main-thread block / Chrome dialog at current scale. **High** = major hitch or lockup risk. **Medium** = jank / debt / latent risk.

### Critical

| ID | Issue | Location | Why it freezes @ 800g / 1k players |
|----|--------|----------|-------------------------------------|
| C1 | **TournamentPage recomputes standings + leaders every render (no `useMemo`)** | `src/components/TournamentPage.tsx` — `calculateStandings` / `calculateHomeStandings` / `getTournamentLeaders` **L213–389**; invoked at **L411–430** (`standings`, `homeStandings`, `leaders`, `extendedStandings`, `groupStandingsTables`). Component uses `useState`/`useCallback` only — **no `useMemo`**. | Any keystroke in add-team dialog, tab chrome, cloud tick, or parent `App` re-render re-runs RR standings + home standings + extended shooting + **all group tables** + full leaders (10 sorts). Cost is paid **even when Awards/Players is the active tab**. |
| C2 | **Unindexed per–box-score-row roster resolution (quadratic/cubic)** | `src/utils/tournamentAwards.ts` `aggregateTournamentAwardPlayers` **L254–284**; `src/utils/tournamentRosters.ts` `resolvePlayerTeamFromTournamentRoster` **L485–506**, `getPlayersForTeamInTournament` **L407–444**, `findPlayerProfile` **L697–707**; same pattern in `TournamentPage.tsx` `getTournamentLeaders` **L233–270**. | Per completed game × ~20 `gameStats` rows: `rosters.find` + rebuild team roster (`rosters.filter` + `findPlayerProfile` scanning **all** clubs) + optional `resolvePlayerTeamInGame`. → tens of millions of linear scans at league scale. |
| C3 | **`resolvePlayerTeamInGame` rebuilds club roster Map on every call** | `src/utils/rosterPlayers.ts` `resolvePlayerTeamInGame` **L277–291** (`buildClubRosterByTeam(teams)` inside hot path). Callers include awards fallback and `buildTeamDefenseBoxMetrics`. | TeamDef / DPOY / All-Defensive box pass = games × stats × full club-map rebuild. Dominates defensive award math. |
| C4 | **Awards tab runs three independent full aggregations** | `src/components/TournamentAwardsTab.tsx` `useMemo`s **L923–968**: `buildTournamentAwardsForGames` + `buildAllTournamentTeamsForGames` + `buildAllDefensiveTeamsForGames`. Each calls `aggregateTournamentAwardPlayers` (e.g. awards **~L995**, All-Teams / All-Defensive entry points). | Opening Awards ≈ **3× C2** in one mount. Sub-tabs do not lazy-load. Matches Chrome dialog on `?tab=awards`. Code already comments **Aw Snap** risk around eligibility thaw (**L833–890**). |
| C5 | **MIP / ROTY re-aggregates every earlier series season over `allGames`** | `tournamentAwards.ts` `buildRookieAndMostImprovedSections` (prior-season loop ~**L762–821** / wired via AwardsTab **L933** `allGames={allGames ?? games}`); `TournamentPage` passes league-wide games into Awards. | NBL / REKT award series → N extra full C2 passes over filtered `allGames`. Can exceed current-season cost alone. |
| C6 | **Cloud load: `games.select('*')` pulls full PBP/shots/lineups for every game** | `src/api/supabaseData.ts` **L1164–1171** (also teams/players/rosters `select('*')` nearby **L1109–1198**). `DbGame` includes `events`, `shots`, `lineup_stints`, `game_stats`. | Initial load + revalidate: megabytes of JSON parse + heap. Main-thread stalls applying large state; every later aggregate walks fatter objects. |
| C7 | **Live/save path: `JSON.stringify` deep-diff of entire `games[]` (and teams/rosters)** | `src/App.tsx` `checkAndSave` **L2041–2049**; live updates replace `games` (~**L2405–2434**). Snapshot helpers can re-stringify league (`appDataSnapshot` paths). | Each possession / cloud tick: O(league) stringify of embedded PBP. Strong “UI locks while scoring” candidate stacked with live PBP replay (H4). |

### High

| ID | Issue | Location | Why it matters at scale |
|----|--------|----------|-------------------------|
| H1 | **PlayersTab / TeamStatsTab aggregate with no memo; filters re-aggregate** | `TournamentPage.tsx` `PlayersTab` **~L1450–1471** (`aggregatePlayerSeasonStats` + multiple coverage scans); `TeamStatsTab` **~L877–881** (`aggregateTournamentTeamSeasonStats`). Nested as functions in parent — re-run when parent re-renders. | Entering Players/Team Stats or changing Team/Position filters can block for seconds; filter should hit cached rows (`filterPlayerSeasonRows`) only. |
| H2 | **TeamDef box metrics: per-stat `resolvePlayerTeamInGame`** | `src/utils/tournamentAwardScoring.ts` `buildTeamDefenseBoxMetrics` **~L415–456**; `buildTeamDef01Map` **~L496–503**. Called from awards **and** All-Defensive (duplicate). | Second/third full games×stats pass with C3 map rebuilds. |
| H3 | **Clutch award sorts all PBP events per game** | `src/utils/tournamentClutch.ts` `selectClutchEventsForGame` **~L115–137**; `aggregateClutchStatsByPlayer` **~L236–245**. | ScoreLab-heavy seasons: copy+sort hundreds of events × completed games on every Awards compute. |
| H4 | **Live PBP rail replays all events for snapshots; UI shows last 40** | `src/components/live/LivePlayByPlayRail.tsx` **L142–149** → `buildPbpStatSnapshots` over **full** `events`. | Late game 300–600 events → CPU spike every new event, on top of C7. |
| H5 | **Standings shooting coverage: O(T×G) + per-roster side resolve** | `src/utils/tournamentStandings.ts` `calculateTeamStandings` **~L319–327**; `withExtendedShootingStats` / `shootingTotalsForTeamGame` **~L244–267, L367–412**. Used for extended + every group table (TournamentPage **L420–430**). | Multiplied by number of groups; always computed even off Standings tab (via C1). |
| H6 | **Player season shot/paint path rescans shots per box row** | `src/utils/playerSeasonStats.ts` aggregate **~L445–507**; `getPlayerPaintAndFastbreakPoints` usage. | O(games × box players × shots) when shot charts exist. |
| H7 | **Global search: sync score of all tournaments/teams/players/games per keystroke** | `src/App.tsx` search Input **~L3469–3477**; `buildGlobalSearchResults` / `searchResults` **~L3306–3313**; `src/utils/globalSearch.ts` **~L120–180**. No debounce / `useDeferredValue` / `useTransition` on search. | 1k players + 800 games rescored on every character. |
| H8 | **Unvirtualized stats tables** | `src/components/PlayerStatsTable.tsx` **~L517–518** (`sortedRows.map` full DOM); `TeamStatsTable.tsx` **~L261**; tournament/team pages. No `react-window` / virtualizer in repo. | 100–400 rows × many columns → layout thrash (secondary to compute, still hurts). |
| H9 | **Heavy SVG court: floor + all markers reconcile together** | `src/components/figma/figmaHorizontalCourtSvg.tsx` markers **~L118–157**, floor **~L267–278**; used by live court, `CourtView`, `PlayerShotChart`, `ShotChart`. | Career / filter changes reconcile hundreds–thousands of SVG nodes with static floor geometry. |
| H10 | **Monolithic `App` state + Auth context breadth** | `src/App.tsx` holds `games`/`teams`/`tournaments`/…; `src/lib/auth/AuthProvider.tsx` **L127–142** context value; `main.tsx` wraps App. Live `setGames` re-renders large tree. | Amplifies C1: one game update → TournamentPage still mounted paths recompute if navigated back with stale work, or App children re-render. |
| H11 | **ErrorBoundary gaps on Tournament + Live routes** | Root EB in `main.tsx` **L11–15**; Team/Player wrapped in `AppRoutes.tsx` **~L262, L354**. **Tournament route** renders `<TournamentPage>` **~L168** with **no** local EB. Live route similarly uncovered. | Unhandled throw → blank/stuck UI instead of recovery. |
| H12 | **N+1-style roster delete writes** | `src/api/supabaseData.ts` **~L524–560** per-row deletes (concurrency pool). | “Saving…” hangs on large roster remaps (network, not render). |
| H13 | **`@supabase/supabase-js` 2.106.2 — auth callback OK today** | `package.json` / lock **2.106.2**; `AuthProvider.tsx` **L47–54** sets session only; DB sync in separate effect **L62–102**. | Classic getSession deadlock **avoided**. Residual: TOKEN_REFRESHED → full Auth consumers re-render; do not add `await` inside callback later. |

### Medium

| ID | Issue | Location | Notes |
|----|--------|----------|-------|
| M1 | **No Supabase Realtime channels** | Repo-wide: no `supabase.channel` / `removeChannel` | Classic “leaked Realtime” **not applicable**. Live updates are local React state + cloud save. |
| M2 | **Awards eligibility timers may fire after unmount** | `TournamentAwardsTab.tsx` **~L843, L863, L888** (`setTimeout` / idle thaw) | Possible setState-after-unmount; not primary freeze. |
| M3 | **Live court overlay can trap pointer-events if phase stuck** | `LiveCourtOverlayShell` absolute `inset-0` `pointer-events-auto` while phase ≠ idle | Unclickable court (not full document) if phase never clears. |
| M4 | **Mark Rookies sort calls `findPlayerProfile` in comparator** | `MarkRookiesCard.tsx` **~L142–148, L225** | O(n log n × clubs×players) when opening eligibility. |
| M5 | **`sessionBrowseLookup` O(G×T)** | `App.tsx` **~L3328–3333** | Secondary. |
| M6 | **Stuck loading surfaces** | App `isDataLoading` gate; cloud retry loop banners; bare “Loading…” on some pages | Rare full-page block if cache miss + slow fetch. |
| M7 | **Duplicate `buildClubRosterByTeam` helpers** | `gameTeamRosters.ts` vs `rosterPlayers.ts` | Consistency / double-work risk. |
| M8 | **Radix dialog body scroll lock** | Nested dialogs on Tournament/Team | Low risk of stuck scroll if unmount mid-open. |

---

## Non-issues / already mitigated (do not “fix” as Batch 1 phantoms)

| Topic | Finding |
|-------|---------|
| Realtime channel leaks | **None** — no Realtime usage found. |
| Auth `onAuthStateChange` DB deadlock | **Mitigated** — sync is outside the callback (`AuthProvider.tsx` L47–54 vs L62–102). |
| Infinite `useEffect` setState loops | No confirmed hard infinite loop; cost is **finite but huge** sync work per render/update. |
| All-Defensive 2G+3F seat fill | Negligible vs aggregation (`fillOneSquad` is small). |
| Player Stats checkbox filters | Cheap; freeze is upstream re-aggregate (H1). |
| Placing/Finals rename (GL S3) | Display/structure only — not a compute regression. |

---

## Phased Fix Plan

**Invariant for all batches:** golden tests / spot checks that award ranks, standings W-L, FG%, TSI, DPOY, All-Teams, All-Defensive membership, and clutch leaders stay **bit-identical** (or documented float-stable) vs pre-change fixtures.

### Batch 1 — Immediate Freeze Killers

Classic checklist items (Realtime / auth deadlock / stuck overlay loops) are **largely absent**. For RunItBack, “immediate” means **stop Chrome Unresponsive** on browse/Awards:

1. **Memoize / tab-gate TournamentPage heavy compute (C1, H1, H5)**  
   - `useMemo` for standings, extended standings, group tables, leaders.  
   - Prefer compute **only for active tab** (Home needs home standings + leaders; Standings needs tables; Players/Team Stats their aggregates; Awards its pipeline).  
   - Dialog keystrokes must not invalidate those memos.

2. **Index roster/player resolution once per aggregate (C2, C3)**  
   - Build `Map` playerId→profile, `(tournamentId,playerId)→roster entry/team`, hoist `buildClubRosterByTeam` **once**.  
   - Change `resolvePlayerTeamInGame` / `resolvePlayerTeamFromTournamentRoster` call sites in hot loops to use prebuilt indexes (or add optional index params).  
   - **Do not change** which team/player is chosen — same resolution rules, O(1) lookup.

3. **Share one awards aggregate across Individual / All-Teams / All-Defensive (C4, H2)**  
   - Single `aggregateTournamentAwardPlayers` (+ shared TeamDef/TSI maps) feeding all three panels.  
   - Lazy-mount All-Teams / All-Defensive panels optional stretch.

4. **Stop full-league `JSON.stringify` on every live tick (C7)**  
   - Version stamps / structural sharing / per-game dirty flags; keep live save on single-game path.  
   - Must not drop cloud persistence.

5. **Cap live PBP snapshot replay (H4)**  
   - Incremental snapshots or windowed rebuild aligned with `maxEvents` display — **display numbers for visible rows must match** current semantics.

6. **ErrorBoundaries on Tournament + Live routes (H11)**  
   - Recovery UI instead of blank page after throw.

7. **Residual classic items**  
   - Clear Awards idle timeouts on unmount (M2).  
   - Guard live overlay phase reset on error (M3).  
   - Keep auth callback free of `await` (H13).

### Batch 2 — Frontend Compute & DOM

1. **MIP/ROTY: cache prior-season aggregates by tournamentId (C5)** — reuse indexed aggregate; still same GP/TSI inputs.  
2. **TeamDef single pass + shared map (H2)** — one `buildTeamDefenseBoxMetrics` per tournament view.  
3. **Clutch: avoid full-array sort when possible (H3)** — filter then sort, or index by quarter; identical clutch event set.  
4. **Player/team season: single-pass shots/paint; memo rows; filter cached rows (H1, H6)**  
5. **Debounce / `useDeferredValue` global search (H7)**; pre-index player pool.  
6. **Virtualize `PlayerStatsTable` / large tables (H8)** — same sort order, windowed DOM.  
7. **Split court SVG static floor vs markers `memo` (H9)**  
8. **Mark Rookies profile Map (M4)**  
9. **Optional:** narrow Auth/App re-render surface (H10) without changing data model.

### Batch 3 — Database Pushdown

Write review SQL under `supabase/migrations/` (review-first; **do not break** existing client contracts until a cutover plan exists):

1. **List/load column projection** — stop selecting `events`/`shots`/`lineup_stints` on league bootstrap (C6); lazy-fetch per game id for Live/Summary.  
2. **Views / RPCs (candidates)**  
   - `game_list_v` — schedule fields + scores without PBP blobs  
   - `tournament_box_agg_v` / RPC — per-player season totals for a `tournament_id` (must match client aggregate definitions exactly before cutover)  
   - Materialized standings W-L for RR stages (refresh on game complete)  
3. **Indexes** — `(league_id)`, `(tournament_id)`, `(tournament_id, player_id)` on rosters/games as needed for RPCs.  
4. **RLS review** — ensure new views/RPCs respect league membership.  
5. **Batch roster writes** — replace per-row delete N+1 (H12) with set-based SQL.

Until Batch 3 ships, Batch 1–2 keep math on the client but with indexed, memoized execution.

---

## Suggested execution order

| Priority | Batch | Rationale |
|----------|-------|-----------|
| **First** | **Batch 1** | Directly kills “Page Unresponsive” on browse/Awards/live stringify. |
| Second | Batch 2 | Removes remaining hitch and DOM cost; still identical numbers. |
| Third | Batch 3 | Structural; requires migration review + parity tests before switching clients off full `select('*')`. |

---

## Out of scope for Phase 1

- No application code edits (this document only).  
- No formula / tie-breaker changes.  
- No production migration apply in Phase 1.

---

## Ask before Phase 2

**Which batch should Executor run first?**

Recommended: **Batch 1 (Immediate Freeze Killers)** as defined above.
