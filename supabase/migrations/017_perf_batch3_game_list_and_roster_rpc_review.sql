-- =============================================================================
-- REVIEW / CUTOVER — Performance Batch 3 (2026-11-26)
-- DO NOT apply blindly in production without client cutover that:
--   1) boots games without events/shots/lineup_stints
--   2) lazy-fetches PBP before Summary / Live / clutch Awards / shot charts
-- =============================================================================
--
-- Goal:
--   - Shrink bootstrap payload (C6): list projection without PBP blobs
--   - Keep game_stats + team_stats on list load (awards / standings / leaders)
--   - Batch tournament_rosters deletes (H12) via RPC
--   - Document indexes + RLS expectations
--
-- Client companion (same PR / follow-up):
--   GAME_LIST_SELECT in src/api/supabaseData.ts
--   fetchGamesPbpByIds + Game.pbpHydrated merge
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Optional view: schedule + box without PBP (for future RPC / admin tools)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.game_list_v AS
SELECT
  g.id,
  g.league_id,
  g.tournament_id,
  g.home_team_id,
  g.away_team_id,
  g.date,
  g.current_period,
  g.current_game_time,
  g.track_both_teams,
  g.is_active,
  g.is_completed,
  g.final_score_home,
  g.final_score_away,
  g.home_starters,
  g.away_starters,
  g.game_stats,
  g.team_stats
  -- intentionally omit: events, shots, lineup_stints
FROM public.games g;

COMMENT ON VIEW public.game_list_v IS
  'Batch 3 review: list/bootstrap projection without PBP blobs. App may select these columns directly from games instead of using the view.';

-- -----------------------------------------------------------------------------
-- 2) Indexes (idempotent) — support list filters + roster RPCs
-- -----------------------------------------------------------------------------
-- games(league_id) / games(tournament_id) expected from 001; ensure present:
CREATE INDEX IF NOT EXISTS games_league_id_idx ON public.games (league_id);
CREATE INDEX IF NOT EXISTS games_tournament_id_idx ON public.games (tournament_id);

CREATE INDEX IF NOT EXISTS tournament_rosters_tournament_player_idx
  ON public.tournament_rosters (tournament_id, player_id);

CREATE INDEX IF NOT EXISTS tournament_rosters_tournament_team_player_idx
  ON public.tournament_rosters (tournament_id, team_id, player_id);

-- -----------------------------------------------------------------------------
-- 3) RPC: batch delete exact tournament_roster rows
--    Payload: [{"tournament_id","team_id","player_id"}, ...]
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_tournament_roster_rows(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN 0;
  END IF;

  WITH doomed AS (
    SELECT DISTINCT
      r.tournament_id,
      r.team_id,
      r.player_id
    FROM jsonb_to_recordset(p_rows) AS r(
      tournament_id text,
      team_id text,
      player_id text
    )
    WHERE r.tournament_id IS NOT NULL
      AND r.team_id IS NOT NULL
      AND r.player_id IS NOT NULL
  ),
  del AS (
    DELETE FROM public.tournament_rosters t
    USING doomed d
    WHERE t.tournament_id = d.tournament_id
      AND t.team_id = d.team_id
      AND t.player_id = d.player_id
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO deleted_count FROM del;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.delete_tournament_roster_rows(jsonb) IS
  'Batch 3: delete tournament_rosters rows by (tournament_id, team_id, player_id) in one round-trip.';

-- -----------------------------------------------------------------------------
-- 4) RPC: clear other-team roster rows for (tournament_id, player_id) keeps
--    Payload: [{"tournament_id","player_id","keep_team_id"}, ...]
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_other_team_tournament_rosters(p_keeps jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  IF p_keeps IS NULL OR jsonb_typeof(p_keeps) <> 'array' THEN
    RETURN 0;
  END IF;

  WITH keeps AS (
    SELECT DISTINCT
      r.tournament_id,
      r.player_id,
      r.keep_team_id
    FROM jsonb_to_recordset(p_keeps) AS r(
      tournament_id text,
      player_id text,
      keep_team_id text
    )
    WHERE r.tournament_id IS NOT NULL
      AND r.player_id IS NOT NULL
      AND r.keep_team_id IS NOT NULL
  ),
  del AS (
    DELETE FROM public.tournament_rosters t
    USING keeps k
    WHERE t.tournament_id = k.tournament_id
      AND t.player_id = k.player_id
      AND t.team_id <> k.keep_team_id
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO deleted_count FROM del;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.clear_other_team_tournament_rosters(jsonb) IS
  'Batch 3: delete stale other-club tournament_rosters rows for kept (tournament, player, team).';

-- -----------------------------------------------------------------------------
-- 5) Grants / RLS notes (review)
-- -----------------------------------------------------------------------------
-- Views/RPCs use SECURITY INVOKER — caller RLS on underlying tables still applies.
-- Ensure league_members / games / tournament_rosters policies already allow the
-- same reads/writes the app uses today (see 008_rls_admin_writes.sql).
-- After apply, grant execute to authenticated role if your project uses it:
--   GRANT EXECUTE ON FUNCTION public.delete_tournament_roster_rows(jsonb) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.clear_other_team_tournament_rosters(jsonb) TO authenticated;
--   GRANT SELECT ON public.game_list_v TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) Future (NOT in this review apply): materialized standings / box RPC
-- -----------------------------------------------------------------------------
-- tournament_box_agg_v / RPC must bit-match client aggregateTournamentAwardPlayers
-- + playerSeasonStats before any Awards cutover. Leave unimplemented until parity tests.

-- Candidate stub only (commented):
-- -- CREATE MATERIALIZED VIEW public.tournament_team_wl_mv AS ...
-- -- REFRESH MATERIALIZED VIEW CONCURRENTLY ...
;