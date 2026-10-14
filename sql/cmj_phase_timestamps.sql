-- Adds the 3 optional CMJ phase timestamps (bottom of loading phase, landing stabilization,
-- return to upright) and their derived timing-only durations to cmj_results, per the iPhone
-- assessment spec's 6-event CMJ model. The 3 existing required events (start/takeoff/landing)
-- are unchanged. All new columns are nullable -- existing rows and the app's old 3-timestamp
-- code path keep working with no backfill needed.
--
-- Run this in the Supabase SQL editor before using the new timestamp fields in the app --
-- the app will fail to save a CMJ test that includes any of these optional fields until this
-- migration has been applied (existing 3-timestamp-only saves are unaffected either way).

alter table cmj_results
  add column if not exists bottom_frame integer,
  add column if not exists stabilization_frame integer,
  add column if not exists upright_frame integer,
  add column if not exists eccentric_duration_sec double precision,
  add column if not exists concentric_duration_sec double precision,
  add column if not exists landing_stabilization_sec double precision,
  add column if not exists return_to_upright_sec double precision;

comment on column cmj_results.bottom_frame is 'Video frame at the bottom of the loading (countermovement) phase. Optional.';
comment on column cmj_results.stabilization_frame is 'Video frame when the athlete stabilizes after landing. Optional.';
comment on column cmj_results.upright_frame is 'Video frame when the athlete returns to upright standing. Optional.';
comment on column cmj_results.eccentric_duration_sec is 'Timing-only: bottom_frame - start_frame, in seconds. Not a force/impulse measurement.';
comment on column cmj_results.concentric_duration_sec is 'Timing-only: takeoff_frame - bottom_frame, in seconds. Not a force/impulse measurement.';
comment on column cmj_results.landing_stabilization_sec is 'Timing-only: stabilization_frame - landing_frame, in seconds.';
comment on column cmj_results.return_to_upright_sec is 'Timing-only: upright_frame - landing_frame, in seconds.';
