-- Adds coach-assessed body classification to profiles: height (for the bodyweight-to-height
-- ratio card), somatotype (Ecto/Meso/Endomorph), and ISA classification (narrow/wide). All three
-- are set by a coach, never self-reported -- ISA in particular needs a coach/PT to feel the
-- lower rib margins or review a photo (see app/components/BodyTypeGuide.tsx's own copy), so
-- there's no legitimate pitcher-writes-their-own-classification path in this product.
--
-- This is the FIRST write path to profiles in this app: confirmed via grep that every existing
-- `.from('profiles')` call anywhere in app/ is a .select, never .update/.insert, and the only
-- existing policy on this table is "profiles authenticated select" (select-only, read-only
-- today per the note in sql/enable_rls_open_tables.sql). So this migration both adds the columns
-- and adds the first-ever UPDATE policy, scoped coach-only.
--
-- Not executed automatically -- run manually in the Supabase SQL Editor after reviewing, same as
-- every other migration in this directory. Live RLS verification (coach can update, pitcher
-- cannot, anon cannot) still needs to be done against the real project after this runs.

begin;

alter table profiles add column if not exists height_in numeric;
alter table profiles add column if not exists somatotype text
  check (somatotype is null or somatotype in ('ectomorph','mesomorph','endomorph'));
alter table profiles add column if not exists isa_classification text
  check (isa_classification is null or isa_classification in ('narrow','wide'));

-- Covers UPDATE only. SELECT is already covered by the existing "profiles authenticated select"
-- policy (untouched by this migration); no INSERT/DELETE policy is added since profile rows are
-- created by the auth signup flow, not by this app's own code.
drop policy if exists "profiles coach update" on profiles;
create policy "profiles coach update" on profiles
  for update to authenticated
  using (exists (select 1 from profiles me where me.id = auth.uid() and me.role = 'coach'))
  with check (exists (select 1 from profiles me where me.id = auth.uid() and me.role = 'coach'));

commit;
