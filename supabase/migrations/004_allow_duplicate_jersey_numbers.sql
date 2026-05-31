-- C13: Allow multiple players on the same team to share a jersey number.
-- Run after 003_player_global_position.sql (or 002 if 003 not applied).

drop index if exists public.team_players_team_number_uidx;
