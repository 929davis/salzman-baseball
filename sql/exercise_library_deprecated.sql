-- Adds `deprecated` to custom_exercises, matching the same field just added to
-- BUILT_IN_EXERCISES in code (app/coach/page.tsx). Not currently set true on any custom
-- exercise -- this pass only deprecates two built-ins (Power Clean, Hang Clean), replaced by
-- weighted jumps. Existing rows default to false.
alter table custom_exercises add column if not exists deprecated boolean not null default false;
