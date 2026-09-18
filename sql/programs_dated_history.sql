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

alter table programs
  add column if not exists carried_forward boolean not null default false,
  add column if not exists first_edited_at timestamptz;

-- Backfill first, so existing rows already conform before the constraints below are added.
-- Every existing row's week_of is stale, but its content is a live, actively-maintained
-- program (that's why it's stale -- it keeps getting edited in place). There is no way to
-- recover what was actually true in past weeks; every edit overwrote the previous state with
-- nothing kept. Re-stamping to the current week is the honest move: it starts the dated-
-- history clock from a true statement ("accurate as of now"), not a fabricated one. These
-- rows are backfilled as already-edited (first_edited_at = now(), carried_forward stays
-- false), so none of them are excluded from ledger math.
update programs
set week_of = date_trunc('week', now())::date,
    first_edited_at = coalesce(first_edited_at, now())
where week_of is null or week_of <> date_trunc('week', now())::date;

alter table programs
  alter column week_of set not null;

alter table programs
  add constraint programs_week_of_monday_aligned check (week_of = date_trunc('week', week_of)::date);

alter table programs
  add constraint programs_pitcher_week_unique unique (pitcher_id, week_of);
