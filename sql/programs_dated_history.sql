-- Dated program history: one row per (pitcher_id, week_of), Monday-aligned, enforced. Plus
-- carried-forward/untouched tracking so a pitcher who's stopped being actively programmed
-- doesn't accrue phantom prescribed load every week forever -- the mirror image of the bug
-- this project exists to fix.
--
-- Before this migration: `programs` had no uniqueness or alignment guarantee on week_of at
-- all. saveProgram() always overwrote whatever row was already loaded, in place, forever --
-- confirmed against live data: exactly one row per pitcher, week_of frozen at whenever the
-- row was first created (several pitchers share week_of values from a single bulk-onboarding
-- day, not a real week boundary), while updated_at is uniformly recent. "The written program
-- is the load of record" only holds per-week if there's a real, addressable row per week --
-- this migration is what makes that true.

-- All-or-nothing: Postgres DDL is transactional, so if the CHECK or UNIQUE constraint below
-- fails, the backfill UPDATE rolls back too -- never left with re-stamped week_of values and
-- no constraints to show for it.
begin;

alter table programs
  add column if not exists carried_forward boolean not null default false,
  add column if not exists first_edited_at timestamptz,
  -- Descriptive origin, separate from carried_forward/first_edited_at (which govern ledger
  -- exclusion). A row created via copyExerciseToPitcher counts toward load immediately (it's a
  -- real, coach-initiated action -- see the discussion this replaced an earlier "exclude it"
  -- idea with) but must be visibly distinguishable from a genuinely written weekly program, so
  -- the constraints block can say "this is a one-slot week from a copy, not a full plan" rather
  -- than let a single copied exercise read as if it were the whole week's programming.
  add column if not exists created_via text not null default 'direct'
    check (created_via in ('direct', 'rollover', 'copy'));

-- Backfill first, so existing rows already conform before the constraints below are added.
-- Every existing row's week_of is stale, but its content is a live, actively-maintained
-- program (that's why it's stale -- it keeps getting edited in place). There is no way to
-- recover what was actually true in past weeks; every edit overwrote the previous state with
-- nothing kept. Re-stamping to the current week is the honest move: it starts the dated-
-- history clock from a true statement ("accurate as of now"), not a fabricated one.
update programs
set week_of = date_trunc('week', now())::date
where week_of is null or week_of <> date_trunc('week', now())::date;

-- Unconditional, deliberately its own statement -- NOT folded into the week_of backfill's
-- WHERE clause above. Every existing row is a live, actively-maintained program regardless of
-- whether its week_of happened to need re-stamping; scoping this to the same WHERE would skip
-- any row already sitting at the current Monday and leave it with first_edited_at NULL --
-- carried_forward defaults false so it wouldn't wrongly get excluded from ledger math today,
-- but it's a never-edited flag on a program that's actively being edited, an inconsistent
-- state with no reason to exist.
update programs
set first_edited_at = coalesce(first_edited_at, now());

alter table programs
  alter column week_of set not null;

alter table programs
  add constraint programs_week_of_monday_aligned check (week_of = date_trunc('week', week_of)::date);

alter table programs
  add constraint programs_pitcher_week_unique unique (pitcher_id, week_of);

commit;
