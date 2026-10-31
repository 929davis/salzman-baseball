-- Tape-measure body segment lengths, added to `profiles` per the mechanics test protocol
-- discussed with Davis (2026-10-31): upper arm, forearm-to-wrist, upper leg, lower leg,
-- shoulder width, trunk length. Single value per measurement (not per-side) -- Davis's
-- explicit choice over a throwing/glove-arm or trail/lead-leg split like the existing
-- humeral/femoral torsion fields.
--
-- No new RLS policy needed -- the existing "profiles coach update" policy
-- (sql/profile_body_classification.sql) already covers UPDATE on the whole profiles row,
-- including these new columns.
--
-- Not executed automatically -- run manually in the Supabase SQL Editor after reviewing.

begin;

alter table profiles add column if not exists upper_arm_in numeric;
alter table profiles add column if not exists forearm_in numeric;
alter table profiles add column if not exists upper_leg_in numeric;
alter table profiles add column if not exists lower_leg_in numeric;
alter table profiles add column if not exists shoulder_width_in numeric;
alter table profiles add column if not exists trunk_length_in numeric;

commit;
