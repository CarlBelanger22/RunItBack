# Live Stat Entry — QA Checklist

Work through **in order**. For each item, verify **score**, **play-by-play**, **box score**, then try **Undo** if noted.

Mark results: `[ ]` not tested · `[x]` pass · `[!]` fail (add note inline)

**Prerequisites:** Desktop ≥1280px · active game · **Track both teams** (default) **or** single-team with Opp unit panel

---

## Resume here (2026-07-03)

| Status | Detail |
|--------|--------|
| **Done** | Phases **1–9** (full required QA) |
| **Optional** | Phase 10 edge cases; mini-game steps 9–10 |
| **Automated** | Full terminal suite green (see bottom) |

---

## Phase 1 — Get into the game

| # | Test | Pass | Notes |
|---|------|------|-------|
| 1.1 | New game loads live entry (no desktop / track-both blockers) | [x] | |
| 1.2 | **Opening tip** — pick winner | [x] | Possession set; can log first shot |
| 1.3 | Offense highlight on correct on-court column | [x] | |

---

## Phase 2 — Shooting (core)

| # | Test | Pass | Notes |
|---|------|------|-------|
| 2.1 | **2PT make** — tap paint → MAKE → pick shooter → pick assister → Commit (fastbreak overlay) | [x] | Score +2; PBP shows assist (`AST`) |
| 2.2 | **2PT make, no assist** — same path → **No assist** → Commit | [x] | Score +2; no AST in PBP |
| 2.3 | **3PT make** — tap 3pt zone → MAKE → shooter → assist optional → Commit | [x] | Score +3; 3PM/A in box |
| 2.4 | **2PT miss → DRB** — MISS → shooter → rebound overlay **DRB** → pick player | [x] | DRB stat; possession flips |
| 2.5 | **2PT miss → ORB** — MISS → shooter → rebound overlay **ORB** → pick player | [x] | ORB stat; offense retained |
| 2.6 | **Block** — BLOCK → pick blocker → shooter → rebound flow | [x] | Block + miss recorded |
| 2.7 | **Cancel shot** — court tap → MAKE/MISS overlay → Cancel | [x] | Returns to idle; no event |
| 2.8 | Shot markers on court (green make / red miss) | [x] | |

---

## Phase 3 — Turnovers

| # | Test | Pass | Notes |
|---|------|------|-------|
| 3.1 | **Player turnover** — TO → pick player on roster | [x] | TO stat; possession flips |
| 3.2 | **Team turnover** — TO → overlay **Team turnover** | [x] | |
| 3.3 | **Turnover + steal** — TO → pick TO player → **Turnover + steal** → pick stealer | [x] | STL + TO in box |

---

## Phase 4 — Free throws (regression)

| # | Test | Pass | Notes |
|---|------|------|-------|
| 4.1 | **Personal foul → 1 FT** — make | [x] | Court overlay only (no action bar FT) |
| 4.2 | **Personal foul → 2 FT** — make both | [x] | FTM/A; possession after 2nd |
| 4.3 | **2 FT — miss final attempt** | [x] | Rebound flow starts |
| 4.4 | **And-1** — make → +Foul → foul committer → FT make | [x] | Basket + foul + FT point |
| 4.5 | **Undo** during / after FT sequence | [x] | |

---

## Phase 5 — Foul variants

| # | Test | Pass | Notes |
|---|------|------|-------|
| 5.1 | **Personal → 0 FT** — foul only, no FT phase | [x] | |
| 5.2 | **Technical foul** — category → committer → tech shooter → 1 FT | [x] | LE-50 re-test pass (made + missed possession) |
| 5.3 | **Unsportsmanlike** — 2 or 3 FT on overlay; complete sequence | [x] | See **5.3 checks** below |
| 5.4 | **Team foul** — entity Team → category → 0 FT path | [x] | |
| 5.5 | **Double foul** — both committers → confirm | [x] | 0 FT; both PF |
| 5.6 | All **foul / rebound / turnover overlay buttons** respond to clicks | [x] | Nested court overlays — test each once |
| 5.7 | **Offensive foul** — Player → Offensive → offense player (immediate commit) | [ ] | PF + TO; possession flips; no FT |

### 5.7 — Offensive foul: what to check

Setup: note **who has the ball** (offense highlight). Run **Foul → Player → Offensive → pick offense player** (no confirm step).

| Check | Expected |
|-------|----------|
| Committer roster | Player picker shows **offense** team only |
| PF stat | Offender +1 PF; team fouls +1 |
| TO stat | Offender +1 TO; team TO +1 |
| Free throws | None — no FT phase |
| Fouls drawn | None on defender |
| Possession after | **Defense** has the ball (same as turnover) |
| Play-by-play | `OFF FOUL` label with offender name |

### 5.2 — Technical foul: what to check (re-test)

Setup: note **who has the ball** before the foul (offense highlight). Run **twice** — once make FT, once miss FT.

| Check | Expected | Made FT | Missed FT |
|-------|----------|---------|-----------|
| FT shooter | Player on **non-fouling** team | [x] | [x] |
| FT point | +1 in score / box if made | [x] | n/a |
| **Possession after FT** | **Same team that had the ball** before the tech | [x] | [x] |
| **Turnover (TO) stat** | No auto TO (see table below) | [x] | [x] |

**LE-50 fix (2026-07-03):** code now sets `possessionTeamAfterFt` to the offense team at foul time. Change `[!]` → `[x]` only after both made and missed paths pass.

### 5.3 — Unsportsmanlike: what to check

| Check | Expected |
|-------|----------|
| FT count | 1, 2, or 3 per overlay choice |
| **Possession after final made FT** | **Offended team** (team that was fouled) keeps the ball |
| **Possession after final missed FT** | Offended team retains (team ORB flow) |
| **Turnover (TO) stat** | Unsportsmanlike is **not** a turnover — no TO on fouling player/team unless you log one separately |

### Turnovers vs technical / unsportsmanlike fouls

| Foul type | Player TO? | Team/coach TO row? | Possession after FT |
|-----------|------------|--------------------|---------------------|
| **Technical (player)** | No auto TO today | No auto TO today | Team that **had the ball** at foul |
| **Technical (coach)** | No | No auto TO today (coach PF only) | Team that **had the ball** at foul |
| **Unsportsmanlike** | No | No | **Offended team** retains |

If you expect **coach technical = team turnover** on the Team/Coach box score line, that is **not implemented yet** (LE-51 backlog) — note in failure log if required for your league.

### 5.7 — Personal foul FT → rebound possession (LE-63)

Setup: team on offense is fouled → shoot **2 FTs**. Note possession dot before rebound.

| # | Test | Pass | Expected |
|---|------|------|----------|
| 5.7.1 | Make FT 1, **miss** FT 2 → log **ORB** (shooting team) | [ ] | Possession dot stays on **shooting team** |
| 5.7.2 | Make FT 1, **miss** FT 2 → log **DRB** (defense) | [ ] | Possession dot flips to **defense** |
| 5.7.3 | **Make** both FTs (or final FT made) | [ ] | Possession to **defense** (`possessionTeamAfterFt`) |

---

## Phase 6 — Jump ball

| # | Test | Pass | Notes |
|---|------|------|-------|
| 6.1 | **Held ball** — JUMP BALL (arrow set) → complete flow | [x] | Possession per arrow rules |

---

## Phase 7 — Substitutions & minutes

| # | Test | Pass | Notes |
|---|------|------|-------|
| 7.1 | **Substitution** — column SUB → out + in + clock → confirm | [x] | On-court column updates |
| 7.2 | Box score on-court dot matches who is on floor | [x] | |
| 7.3 | **Undo** substitution | [x] | |
| 7.4 | **Sub bench list after sleep / cloud sync** (LE-64) — mid-game, let Mac sleep or go offline → wake → open SUB | [ ] | **In** list = tournament roster only (not full club); no duplicate jersey ghosts |

---

## Phase 8 — Period & game end

| # | Test | Pass | Notes |
|---|------|------|-------|
| 8.1 | **End Q** (mid-regulation) — lineup overlay → confirm | [x] | Period +1; clock resets; **arrow team** starts next Q (LE-53) |
| 8.2 | Quarter points in team stats (Q1, Q2, …) | [x] | |
| 8.3 | **End Game** — when header says "End Game" (ahead in Q4) | [x] | Game completes |
| 8.4 | **Overtime** — tied Q4 → End Q → OT lineup → play | [x] | Period 5; OT clock; arrow team starts OT |

### 8.1 — Quarter start possession (FIBA Art. 12.6.3)

Before **End Q1**: note possession **arrow** team (header arrow indicator).

| Check | Expected |
|-------|----------|
| After Q2 lineup confirm | **Arrow team** has offense highlight |
| PBP | `START Q2` card shows `{TEAM} ball` |
| Arrow after Q2 start | Flips to the other team (AP consumed) |

---

## Phase 9 — Edit, undo, integrity

| # | Test | Pass | Notes |
|---|------|------|-------|
| 9.1 | **Undo** 3+ mixed events in a row (shot, foul, TO) | [x] | |
| 9.2 | **Edit PBP** — double-click card → change → save | [x] | Stats replay correctly |
| 9.3 | Box score column sort | [x] | |
| 9.4 | Scoreboard header matches box score totals | [x] | |
| 9.5 | **Edit game** metadata (header) | [x] | |
| 9.6 | **Back** to dashboard without crash | [x] | |
| 9.7 | Refresh page mid-game — state persists (if using save) | [ ] | Skipped if not using cloud save |

---

## Phase 10 — Optional / edge

| # | Test | Pass | Notes |
|---|------|------|-------|
| 10.1 | Fastbreak toggle on make → `fastbreak_points` (if tracked) | [ ] | |
| 10.2 | Paint 2PT → `points_in_paint` | [ ] | |
| 10.3 | Team ORB / Team DRB (no player) | [ ] | |
| 10.4 | Keyboard **M** / **X** during FT | [ ] | Hidden shortcut |
| 10.5 | **3×3 game format** (if you use it) | [ ] | 21-point win rules |

---

## Phase 11 — Foul-out / forced bench (LE-36, 5v5 only)

**Foul-out triggers (any one):** 5 total fouls · 2 technical · 2 unsportsmanlike · 1 technical + 1 unsportsmanlike.

| # | Test | Pass | Expected |
|---|------|------|----------|
| 11.1 | **5th personal foul** (no FT) on an on-court player | [ ] | Blocking **"Foul out — #n Name must be replaced"** dialog opens for that team; can't close (no X / Esc / outside click) |
| 11.2 | Pick replacement + clock → **Confirm replacement** | [ ] | Player subbed out; on-court column updates; play resumes |
| 11.3 | **Foul-out via FTs** — 5th foul that awards FTs (foul the shooter) | [ ] | Replace dialog appears **before** FTs; after confirming, FT overlay resumes and FTs are shot |
| 11.4 | **Re-entry lock** — open any later SUB for that team | [ ] | Fouled-out player is **not** in the "In" bench list |
| 11.5 | **2 technical fouls** on one player | [ ] | Foul-out dialog triggers (even if total < 5) |
| 11.6 | **2 unsportsmanlike fouls** on one player | [ ] | Foul-out dialog triggers |
| 11.7 | **1 technical + 1 unsportsmanlike** on one player | [ ] | Foul-out dialog triggers |
| 11.8 | **Live box score** PF for fouled-out player | [ ] | `PF` shows **solid red + bold** (others stay faint) |
| 11.9 | **Completed-game box score** PF (Complete game → open Box Score) | [ ] | Fouled-out player's `PF` shows a **red badge** (like negative EFF/GmSc) |
| 11.10 | **Undo** the forced sub, then undo the disqualifying foul | [ ] | Sub reverts, then PF drops below limit and red highlight clears |
| 11.11 | **3×3 game** — give a player 5 fouls | [ ] | **No** foul-out prompt and **no** red PF highlight (foul-out is 5v5 only) |
| 11.13 | **Escape hatch** — in the blocking dialog, click **"Cancel & undo foul (wrong entry)"** | [ ] | Triggering foul is undone, dialog closes, app returns to idle (recovery from a mis-click) |
| 11.14 | **Locked cards** — open the forced sub "In" list and the period-start lineup picker | [ ] | Fouled-out players show as **dimmed/disabled cards with a red "Fouled out" tag** (visible but not selectable) |

### 11.12 — Short-handed continuation (rare: no eligible bench)

Setup: reduce a team so it has **no eligible bench** (e.g. dress exactly 5, or foul out enough that no one is left on the bench), then foul out an on-court player.

| Check | Expected |
|-------|----------|
| Dialog "In" column | Shows **"No available substitutes — {ABBR} continues with N players"** (no bench list) |
| Confirm button | Reads **"Acknowledge — continue short-handed"**; enabled once clock is valid |
| After acknowledge | That team plays on with **4 on court**; minutes/±/box score stay correct |
| **Next period start** | Lineup picker lets the depleted team start with **4** (`n/4`); the full-roster team still requires **5** |

---

## Phase 12 — Single-team live entry (LE-91)

**Setup:** New game → turn **off** “Track both teams” → pick Opponent from **tournament teams** (or Create new: name + abbrev only) → start live entry (≥1280px). Home = your roster; Away = Opp unit panel (identity only — no Opp player stats). Your team cannot also be selected as Opponent.

| # | Test | Pass | Expected |
|---|------|------|----------|
| 12.0 | Opp identity at setup | [x] | Tournament dropdown (not free-text name); create = name+abbrev, no logo; Start enabled; scoreboard shows real Opp name/abbrev |
| 12.1 | Live UI opens (no “paused” blocker) | [x] | Home column + court + **Opp unit** panel |
| 12.2 | Tip / possession | [x] | Opening tip works; arrow + possession still tracked |
| 12.3 | Opp shot make/miss/block | [x] | Court tap while Opp has ball → make/miss; block → **home** blocker; score / Opp FG update |
| 12.4 | Rebound after Opp miss | [x] | Home DRB / Team DRB / **Opp ORB** / Skip |
| 12.5 | Rebound after home miss | [x] | Home ORB / Team ORB / **Opp DRB** |
| 12.6 | Opp TO + steal | [x] | Opp panel TO → TO+steal → pick **home** stealer |
| 12.7 | Home TO | [x] | No Opp stealer; ball to Opp |
| 12.8 | Opp foul → home FD / FTs | [x] | Opp foul → home recipient / charge drawer; home FTs when awarded |
| 12.9 | Home foul → Opp FTs | [x] | Opp **team** FT make/miss; score + FT line on Opp strip |
| 12.10 | Live box Opp strip | [x] | Home player box; Opp **team totals** (FG/3PT/FT/PTS/REB/TO/PF) — no empty Away player table |
| 12.11 | End Q lineup | [x] | **Home lineup only** (narrow ~280px panel) |
| 12.12 | PBP Opp read-only | [x] | Double-click Opp card does **not** open edit; home cards still editable; undo still works |
| 12.13 | Opp make + Foul (and-1) | [x] | Opp MAKE confirm shows **+ Foul** → pick home fouler → Opp 1 team FT → possession to home |

**Phase 12 sign-off:** User confirmed complete 2026-07-26 (includes LE-91.7–91.9 QA fixes: Opp identity, tip panel, court label colors, Opp strip refresh, End Q width). **12.13** (LE-93) user-confirmed 2026-08-05.

---

## Phase 13 — Friendly games (LE-92)

**Setup:** Game Setup → turn **on** “Friendly game (not a tournament)” (default is off). No tournament picker. Pick any club / create for home (and Opp if single-team, or both clubs if Track both teams). Complete at least one friendly with player stats so Player Stats can show a Friendlies row.

| # | Test | Pass | Expected |
|---|------|------|----------|
| 13.1 | Setup toggle off (default) | [x] | Tournament picker shown; Start still requires a tournament |
| 13.2 | Setup toggle on | [x] | Tournament picker hidden; club pickers (not tournament-roster-only); Start works without a tournament |
| 13.3 | Single-team friendly | [x] | Home roster + Opp unit (any club / create name+abbrev); live entry works like LE-91 |
| 13.4 | Both-team friendly | [x] | Two clubs with rosters; full live entry as usual |
| 13.5 | Persist / resume | [x] | Friendly stays `isFriendly` after refresh / resume; still no tournament |
| 13.6 | Lists label | [x] | Dashboard Latest Games, Recent Games, Team Games, Player game log show **Friendly** (plain text; Team Games **not** a tournament link) |
| 13.7 | Game page + live header | [x] | **Friendly game** on Game Summary header and live scoreboard meta (and resume banner if in progress) |
| 13.8 | Aggregates excluded | [x] | Friendly points do **not** change team season PPG / W–L, player All Time, or H2H when comparing to before the friendly |
| 13.9 | Player Stats Friendlies row | [x] | Under All Time: **Friendlies** summary row with GP/PTS matching friendly games only; **not** clickable |
| 13.10 | Friendlies row + tournament filter | [x] | Filter Player Stats to one tournament → Friendlies row **hidden**; All tournaments → row returns |
| 13.11 | PDF | [x] | Export game PDF shows **Friendly** in the tournament title slot |
| 13.12 | Official games unchanged | [x] | Non-friendly games still show real tournament names / links / aggregates |
| 13.13 | Edit friendly — court flip | [x] | Edit Game on a live friendly: toggle Flip court sides → **Update Game** saves; no tournament picker (shows “Friendly game”) |
| 13.14 | Friendly subs — game-day roster | [x] | Sub dialog **In** lists only Starters+Bench from setup (not full club; Inactive excluded) |
| 13.15 | Friendly setup Inactive | [x] | Drag players to **Inactive**; Start game embeds only active; live subs omit Inactive |

**Automated (LE-92):** `npm run test:friendly-game` (+ `npm run test:game-report-model` for PDF classification).

**Phase 13 sign-off:** User confirmed complete 2026-08-05 (LE-92 + LE-94).

---

## Mini-game script (optional single sitting)

Do in one session after Phase 1–4 pass:

1. [x] Tip → home  
2. [x] Home 2PT + assist  
3. [x] Away 3PT miss → DRB  
4. [x] Away TO + steal  
5. [x] Home and-1  
6. [x] Away foul → 2 FT (1 make, 1 miss)  
7. [x] Sub one player  
8. [x] End Q1 + lineups  
9. [x] Undo last event → redo  
10. [x] Edit one PBP card  

---

## Automated tests (terminal)

Run before final sign-off:

```bash
npm run test:live-entry-state-machine && \
npm run test:live-entry-rebound && \
npm run test:foul-flow && \
npm run test:foul-out && \
npm run test:and1-ft-flow && \
npm run test:court-overlay-active && \
npm run test:opening-tip && \
npm run test:possession-engine && \
npm run test:minutes-engine && \
npm run test:game-clock && \
npm run test:end-period && \
npm run test:stat-recording && \
npm run test:single-team-entry && \
npm run test:single-team-away-identity && \
npm run test:friendly-game && \
npm run test:pbp-edit
```

| Suite | Pass | Notes |
|-------|------|-------|
| All commands above exit 0 | [x] | Verified 2026-07-03 (includes LE-50 `testTechnicalFtRetainsPossessionTeam`) |

---

## Sign-off

| Milestone | Done |
|-----------|------|
| Phase 1–4 complete (core loop + FT) | [x] |
| Phase 5–6 complete (fouls + jump ball) | [x] |
| Phase 7–8 complete (subs + periods) | [x] |
| Phase 9 complete (edit / undo / integrity) | [x] |
| Automated tests green | [x] |
| **Ready for real game** | [x] |

---

## Failure log

| # | Failed test | What happened |
|---|-------------|---------------|
| 1 | **5.2** Technical foul | After made FT, possession went to **fouling team** — **LE-50** fixed; re-tested and passed. |

---

*Last updated: 2026-08-04 (Phase 13.14–13.15 LE-94 Inactive / game-day roster)*
