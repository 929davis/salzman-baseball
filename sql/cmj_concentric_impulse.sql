-- Adds a column for the new "concentric impulse, full phase" metric to cmj_results.
-- NOT the same thing as CI-100 (the force-plate metric from the Sakurai et al. study) -- this
-- is a physics-derived estimate of impulse across the WHOLE concentric phase (bottom of the
-- squat to takeoff), not specifically the first 100ms of it. See the comment above
-- concentricImpulseNs in lib/cmj.ts for the full explanation and the formula used.
--
-- Nullable and optional, same as the other phase-timing columns added in
-- sql/cmj_phase_timestamps.sql -- only populated when the coach/athlete entered the optional
-- "bottom of the loading phase" timestamp.
--
-- Run this in the Supabase SQL editor before using this field in the app.

alter table cmj_results add column if not exists concentric_impulse_ns double precision;

comment on column cmj_results.concentric_impulse_ns is 'Physics-estimated impulse (N*s) across the full concentric phase (bottom-of-squat to takeoff), derived from takeoff velocity and concentric duration. NOT CI-100 -- that is a force-plate-only metric measuring just the first 100ms of this same phase.';
