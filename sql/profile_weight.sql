-- Adds a coach-settable bodyweight field to `profiles`, alongside height_in
-- (sql/profile_body_classification.sql) in the Body Classification section of the coach's
-- Edit Profile panel. The pitcher Overview's bodyweight-vs-height card currently falls back
-- to the latest cmj_results.bodyweight (captured per CMJ test) when this is unset -- this is
-- a separate, coach-maintained value, not a replacement for that per-test capture.
--
-- No new RLS policy needed -- the existing "profiles coach update" policy
-- (sql/profile_body_classification.sql) already covers UPDATE on the whole profiles row.
--
-- Not executed automatically -- run manually in the Supabase SQL Editor after reviewing.

begin;

alter table profiles add column if not exists weight_lbs numeric;

commit;
