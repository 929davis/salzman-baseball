-- Data layer for the new Pitch Calling tool (combines Timing IQ + Base Scenario ideas with
-- real hitter swing profiles and pitcher arsenal data to recommend the best 2 pitches to
-- throw in a given at-bat situation).
--
-- pc_hitter_profiles: one row per hitter, season-aggregate swing metrics from Baseball
-- Savant's own Bat Tracking / Swing Path leaderboard (attack angle, attack direction, swing
-- tilt, bat speed) -- NOT re-derived from raw pitch data ourselves.
--
-- pc_pitcher_arsenal: one row per (pitcher, pitch type, source). Usage%/whiff%/K%/run-value/
-- hard-hit% come from Savant's Pitch Arsenal leaderboard; avg_speed/avg_pfx_x/avg_pfx_z come
-- from OUR OWN live statcast_pitches table (already real, already-ingested movement data --
-- no new backfill needed for that part). source='trackman' rows are for pitchers imported
-- from a TrackMan export instead of Savant, same shape, kept apart by source rather than
-- mixed into the same numbers.
--
-- Both tables are fully recomputed/replaced by scripts/build-pitch-calling-profiles.mjs on
-- each run (same pattern as the bs_* Base Scenario tables) -- never written to by the app.
--
-- Not executed automatically -- run manually in the Supabase SQL Editor after reviewing.

begin;

create table if not exists pc_hitter_profiles (
  savant_id bigint primary key,
  name text not null,
  side text,
  avg_bat_speed numeric,
  swing_tilt numeric,
  attack_angle numeric,
  attack_direction numeric,
  ideal_attack_angle_rate numeric,
  competitive_swings integer,
  updated_at timestamptz not null default now()
);

create table if not exists pc_pitcher_arsenal (
  id bigint generated always as identity primary key,
  savant_id bigint not null,
  name text not null,
  pitch_type text not null,
  pitch_name text,
  usage_pct numeric,
  whiff_percent numeric,
  k_percent numeric,
  put_away numeric,
  run_value_per_100 numeric,
  hard_hit_percent numeric,
  est_woba numeric,
  avg_speed numeric,
  avg_pfx_x numeric,
  avg_pfx_z numeric,
  pitch_count integer,
  source text not null default 'savant' check (source in ('savant','trackman')),
  updated_at timestamptz not null default now(),
  unique (savant_id, pitch_type, source)
);

alter table pc_hitter_profiles enable row level security;
alter table pc_pitcher_arsenal enable row level security;

drop policy if exists "pc_hitter_profiles authenticated select" on pc_hitter_profiles;
create policy "pc_hitter_profiles authenticated select" on pc_hitter_profiles
  for select to authenticated using (true);

drop policy if exists "pc_pitcher_arsenal authenticated select" on pc_pitcher_arsenal;
create policy "pc_pitcher_arsenal authenticated select" on pc_pitcher_arsenal
  for select to authenticated using (true);

commit;
