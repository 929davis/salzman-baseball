-- Extends the Structural Profile from sql/profile_structural_profile.sql with two real gaps:
-- (1) torsion was forced into a binary (retroverted/anteverted) with no room for a genuinely
--     balanced structure, even though torsion is a population continuum, not two buckets;
-- (2) laxity (how big the total rotational arc is) was only tracked for the elbow, even
--     though it's a real, separate axis from torsion (which describes where the arc is
--     centered, not how big it is) and applies the same way to the shoulder and hip.
--
-- No new RLS policy needed -- the existing "profiles coach update" policy already covers
-- UPDATE on the whole profiles row, including these columns.
--
-- Not executed automatically -- run manually in the Supabase SQL Editor after reviewing.

begin;

-- Add 'neutral' to the four torsion columns' check constraints. Postgres has no ALTER CHECK,
-- so each is dropped and recreated -- using the default auto-generated constraint name
-- (<table>_<column>_check) since none of these were given an explicit name originally.
alter table profiles drop constraint if exists profiles_humeral_torsion_throwing_arm_check;
alter table profiles add constraint profiles_humeral_torsion_throwing_arm_check
  check (humeral_torsion_throwing_arm is null or humeral_torsion_throwing_arm in ('retroverted','anteverted','neutral'));

alter table profiles drop constraint if exists profiles_humeral_torsion_glove_arm_check;
alter table profiles add constraint profiles_humeral_torsion_glove_arm_check
  check (humeral_torsion_glove_arm is null or humeral_torsion_glove_arm in ('retroverted','anteverted','neutral'));

alter table profiles drop constraint if exists profiles_femoral_torsion_trail_leg_check;
alter table profiles add constraint profiles_femoral_torsion_trail_leg_check
  check (femoral_torsion_trail_leg is null or femoral_torsion_trail_leg in ('retroverted','anteverted','neutral'));

alter table profiles drop constraint if exists profiles_femoral_torsion_lead_leg_check;
alter table profiles add constraint profiles_femoral_torsion_lead_leg_check
  check (femoral_torsion_lead_leg is null or femoral_torsion_lead_leg in ('retroverted','anteverted','neutral'));

-- New rotational-laxity columns -- one value per joint (not per-side like torsion), since
-- laxity is usually a systemic/whole-body trait rather than throwing-adaptation-driven.
alter table profiles add column if not exists shoulder_laxity text
  check (shoulder_laxity is null or shoulder_laxity in ('hypermobile','normal'));
alter table profiles add column if not exists hip_laxity text
  check (hip_laxity is null or hip_laxity in ('hypermobile','normal'));

commit;
