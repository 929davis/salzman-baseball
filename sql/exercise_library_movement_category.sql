-- Adds movement_category and equipment_tier to custom_exercises, matching the same two fields
-- just added to BUILT_IN_EXERCISES (app/coach/page.tsx) in code. Both nullable -- the 7
-- existing custom_exercises rows have neither assigned yet (equipment_tier isn't assigned
-- anywhere yet, built-in or custom; see the report on why).
--
-- These are read at render time to resolve a substitution ladder for a given exercise slot
-- (same movement_category = valid substitute). Deliberately NOT stored per-program -- a
-- substitution ladder is a property of the movement category itself, not authored into
-- programs.structured_days.
alter table custom_exercises add column if not exists movement_category text;
alter table custom_exercises add column if not exists equipment_tier text;
