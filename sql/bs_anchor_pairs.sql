-- At-Bat Anchor Model table, feeding a new section of the Effective Velocity tab.
--
-- Sits alongside bs_ev_pairs (sql for that table was never committed -- it, like the other
-- bs_* Base Scenario tables, predates this file and was created outside this repo's sql/
-- convention; this migration does the right thing for the new table going forward rather
-- than leaving it the same way).
--
-- One row per (anchor_type, anchor_diff_bucket): anchor_type is 'running_avg' or 'mode',
-- the two parallel ways of computing a hitter's "anchor speed" from everything he's swung at
-- so far in the at-bat (see scripts/aggregate-base-scenario.mjs's computeAnchorPairs for the
-- exact DuckDB logic). Fully recomputed and replaced by that script on every run -- never
-- written to by the app itself.
--
-- Not executed automatically -- run manually in the Supabase SQL Editor after reviewing.

begin;

create table if not exists bs_anchor_pairs (
  id bigint generated always as identity primary key,
  anchor_type text not null check (anchor_type in ('running_avg','mode')),
  anchor_diff_bucket integer not null,
  n integer not null default 0,
  n_whiff integer not null default 0,
  n_whiff_high integer not null default 0,
  n_whiff_middle integer not null default 0,
  n_whiff_low integer not null default 0,
  n_out_of_zone integer not null default 0,
  n_chase integer not null default 0,
  n_in_play integer not null default 0,
  n_hard_hit integer not null default 0,
  n_barrel integer not null default 0,
  n_pull integer not null default 0,
  n_center integer not null default 0,
  n_oppo integer not null default 0,
  n_pull_ground_ball integer not null default 0,
  sum_pull_gb_run_exp double precision not null default 0,
  sum_pull_gb_run_exp_sq double precision not null default 0,
  n_strikeout_looking integer not null default 0,
  n_strikeout_swinging integer not null default 0,
  sum_delta_run_exp double precision not null default 0,
  sum_delta_run_exp_sq double precision not null default 0,
  unique (anchor_type, anchor_diff_bucket)
);

alter table bs_anchor_pairs enable row level security;

-- Select-only, matching the rest of the Base Scenario reference tables (sql/enable_rls_open_tables.sql's
-- "profiles authenticated select" pattern) -- this is read-only reference data from the app's
-- perspective; all writes come from scripts/aggregate-base-scenario.mjs using the service-role
-- key, which bypasses RLS entirely.
drop policy if exists "bs_anchor_pairs authenticated select" on bs_anchor_pairs;
create policy "bs_anchor_pairs authenticated select" on bs_anchor_pairs
  for select to authenticated using (true);

commit;
