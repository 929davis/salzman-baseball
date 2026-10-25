-- Adds four more coach-assessed structural classifications to profiles, same family as
-- height_in/somatotype/isa_classification added in sql/profile_body_classification.sql:
-- fixed-by-bone-growth traits, not trainable, coach/PT-assessed only. Humeral torsion
-- (shoulder) and femoral torsion (hip) are tracked per-side since both are well documented to
-- develop asymmetrically in throwers -- see lib/bodyType.ts's comment for why. Foot arch and
-- elbow carrying angle/laxity are tracked as one value each.
--
-- No new RLS policy needed -- the "profiles coach update" policy added in
-- sql/profile_body_classification.sql already covers UPDATE on the whole profiles row,
-- including these new columns.
--
-- Not executed automatically -- run manually in the Supabase SQL Editor after reviewing.

begin;

alter table profiles add column if not exists humeral_torsion_throwing_arm text
  check (humeral_torsion_throwing_arm is null or humeral_torsion_throwing_arm in ('retroverted','anteverted'));
alter table profiles add column if not exists humeral_torsion_glove_arm text
  check (humeral_torsion_glove_arm is null or humeral_torsion_glove_arm in ('retroverted','anteverted'));

alter table profiles add column if not exists femoral_torsion_trail_leg text
  check (femoral_torsion_trail_leg is null or femoral_torsion_trail_leg in ('retroverted','anteverted'));
alter table profiles add column if not exists femoral_torsion_lead_leg text
  check (femoral_torsion_lead_leg is null or femoral_torsion_lead_leg in ('retroverted','anteverted'));

alter table profiles add column if not exists foot_arch_type text
  check (foot_arch_type is null or foot_arch_type in ('high_arch','flat'));

alter table profiles add column if not exists elbow_carrying_angle text
  check (elbow_carrying_angle is null or elbow_carrying_angle in ('varus','valgus'));
alter table profiles add column if not exists elbow_laxity text
  check (elbow_laxity is null or elbow_laxity in ('hypermobile','normal'));

commit;
