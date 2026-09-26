-- Cross-account data isolation for programs, session_logs, cmj_results, arm_care_tests,
-- athletic_benchmarks, throw_log, and mechanics_frame_logs.
--
-- Live-tested against production (two disposable pitcher accounts, real insert/select/update
-- attempts) before writing this, not assumed from reading policy files:
--   - programs, session_logs, cmj_results, athletic_benchmarks were ALREADY correctly isolated
--     -- one pitcher cannot read or forge-write another's rows. These policies must have been
--     set up directly in the Supabase dashboard at some point; they were never committed to
--     this repo, which is its own risk (undocumented, unreviewable, and one dashboard click
--     from being loosened with no record of it). This migration commits the equivalent
--     policies so the intended behavior is in source control, not just live and undocumented.
--   - arm_care_tests genuinely leaked on BOTH counts: pitcher B could read pitcher A's arm-care
--     test rows, AND pitcher B could self-insert an arm_care_tests row for themselves (HTTP
--     201, confirmed), even though no UI path exists for a pitcher to do this and the product
--     intent (per ArmCareSummary.tsx's own empty-state copy) is "your coach administers this
--     with dumbbells and a stopwatch" -- coach-only, always.
--   - throw_log genuinely leaked on SELECT: sql/throw_log.sql's existing
--     "throw_log authenticated select" policy is `using (true)` -- any authenticated user, any
--     pitcher's rows. Insert/update/delete on that table were already coach-scoped correctly.
--   - mechanics_frame_logs genuinely leaked on BOTH counts, same as arm_care_tests: pitcher B
--     could read pitcher A's frame-by-frame joint-angle data AND forge-insert a row under
--     pitcher A's id (HTTP 201, confirmed) -- the blanket `using (true)` / `with check (true)`
--     policy from sql/enable_rls_open_tables.sql, already live. Added here because
--     PitchMechanics2D (previously coach-only) is being opened up for athletes to use on
--     themselves in this same change -- it would be reckless to give every athlete a direct
--     write path into a table with zero ownership scoping right after fixing this exact class
--     of bug on six other tables.
--
-- Because some of these tables already have policies set up outside this repo (dashboard-only,
-- unknown names), simply adding a narrower policy is not enough to fix the leaky ones --
-- Postgres OR's multiple permissive policies together, so a new narrow policy sitting next to
-- an old `using (true)` policy changes nothing. This migration drops every existing policy on
-- each of the seven tables (whatever it's named, wherever it came from) before recreating the
-- correct set, so the end state is deterministic regardless of what was there before.
--
-- Ownership model (confirmed by reading every write site in app/coach/page.tsx and
-- app/pitcher/page.tsx before writing this, not assumed):
--   programs             -- coach writes/updates for any pitcher; pitcher reads only their own.
--   session_logs         -- pitcher inserts only their own; coach reads any pitcher's.
--   cmj_results          -- pitcher inserts their own; coach can insert/update/delete any
--                           pitcher's (roster-wide entry/correction in the coach dashboard).
--   arm_care_tests       -- coach-only insert, for any pitcher; pitcher never writes this.
--   athletic_benchmarks  -- shared component, used both ways: pitcher can insert/update their
--                           own; coach can insert/update any pitcher's.
--   throw_log            -- coach-only insert/update/delete, for any pitcher; no pitcher UI at
--                           all reads or writes it, but nothing stops a pitcher account from
--                           reading another pitcher's throw_log via a direct API call today,
--                           hence scoping select to own-or-coach rather than leaving it coach-only.
--   mechanics_frame_logs -- same shared-component shape as athletic_benchmarks: PitchMechanics2D
--                           takes a pitcherId prop and is now mounted both in app/coach/page.tsx
--                           (any roster pitcher) and app/pitcher/page.tsx (self only), and both
--                           insert their own analysis frames. No update/delete call exists.
--
-- Not executed automatically -- run manually in the Supabase SQL Editor after reviewing, same
-- as every other RLS migration in this directory.

do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['programs','session_logs','cmj_results','arm_care_tests','athletic_benchmarks','throw_log','mechanics_frame_logs']
  loop
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on %I', pol.policyname, t);
    end loop;
  end loop;
end $$;

alter table programs enable row level security;
alter table session_logs enable row level security;
alter table cmj_results enable row level security;
alter table arm_care_tests enable row level security;
alter table athletic_benchmarks enable row level security;
alter table throw_log enable row level security;
alter table mechanics_frame_logs enable row level security;

-- programs: pitcher reads only their own row; only a coach writes (insert/update), for any
-- pitcher_id. No delete policy -- grep confirms no delete call on this table anywhere in app/.
create policy "programs own or coach select" on programs
  for select to authenticated
  using (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "programs coach insert" on programs
  for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "programs coach update" on programs
  for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

-- session_logs: pitcher reads/inserts only their own; coach reads any (roster dashboard). No
-- update/delete policy -- grep confirms neither is ever called on this table.
create policy "session_logs own or coach select" on session_logs
  for select to authenticated
  using (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "session_logs own insert" on session_logs
  for insert to authenticated
  with check (pitcher_id = auth.uid());

-- cmj_results: pitcher reads/inserts only their own; coach can read/insert/update/delete any
-- pitcher's row (the coach dashboard's CMJ entry/edit/delete flow).
create policy "cmj_results own or coach select" on cmj_results
  for select to authenticated
  using (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "cmj_results own or coach insert" on cmj_results
  for insert to authenticated
  with check (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "cmj_results coach update" on cmj_results
  for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "cmj_results coach delete" on cmj_results
  for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

-- arm_care_tests: pitcher reads only their own; coach reads any. Insert is coach-only, for any
-- pitcher_id -- there is no legitimate pitcher-writes-their-own-arm-care-test path in this
-- product (a pitcher has no equipment or method to administer this test on themselves), so the
-- pre-fix ability for a pitcher to self-insert one was a genuine gap, not an intentional
-- feature this migration removes. No update/delete policy -- neither is ever called.
create policy "arm_care_tests own or coach select" on arm_care_tests
  for select to authenticated
  using (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "arm_care_tests coach insert" on arm_care_tests
  for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

-- athletic_benchmarks: AthleticBenchmarks.tsx is the same component mounted both in
-- app/coach/page.tsx (pitcherId = any roster pitcher) and app/pitcher/page.tsx (pitcherId =
-- the signed-in pitcher's own id) -- both insert and update need to allow either caller shape.
create policy "athletic_benchmarks own or coach select" on athletic_benchmarks
  for select to authenticated
  using (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "athletic_benchmarks own or coach insert" on athletic_benchmarks
  for insert to authenticated
  with check (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "athletic_benchmarks own or coach update" on athletic_benchmarks
  for update to authenticated
  using (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

-- throw_log: select is now scoped (own-or-coach), replacing the old blanket `using (true)` from
-- sql/throw_log.sql, which is the confirmed live leak. Insert/update/delete stay coach-only, for
-- any pitcher_id, matching ThrowLogPanel.tsx (coach-only component, called with any roster
-- pitcher's id) -- unchanged in effect from the original file, just recreated here since the
-- do-block above drops and rebuilds every policy on this table.
create policy "throw_log own or coach select" on throw_log
  for select to authenticated
  using (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "throw_log coach insert" on throw_log
  for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "throw_log coach update" on throw_log
  for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "throw_log coach delete" on throw_log
  for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

-- mechanics_frame_logs: pitcher reads/inserts only their own; coach can read/insert any
-- pitcher's (PitchMechanics2D is now mounted on both /coach and /pitcher). No update/delete
-- policy -- grep confirms neither is ever called on this table.
create policy "mechanics_frame_logs own or coach select" on mechanics_frame_logs
  for select to authenticated
  using (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "mechanics_frame_logs own or coach insert" on mechanics_frame_logs
  for insert to authenticated
  with check (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

-- No anon policy is created for any of the 7 tables above, on purpose. Do not add one.
