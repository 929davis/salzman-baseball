-- session_logs.pitch_count only covers outings (bullpens/games logged through the pitcher's
-- daily Log tab). This table is a real per-throwing-event ledger -- drills, long toss, flat
-- ground, pulldowns, weighted-ball work -- so a 28-day weighted throw history can be built
-- from actual logged events instead of one scalar per outing day.
--
-- Not wired into any UI yet -- this migration only creates the table. See the report on
-- backfilling throw_volume_entries into it before that table is retired.
create table if not exists throw_log (
  id uuid primary key default gen_random_uuid(),
  pitcher_id uuid not null references profiles(id),
  throw_date date not null,
  throw_type text not null,   -- 'drill' | 'long_toss' | 'flat_ground' | 'bullpen' | 'outing' | 'pulldown' | 'weighted'
  count integer not null,
  implement text not null default '5oz', -- '5oz' | '4oz' | '6oz' | 'crosstrain'
  intent_level text,          -- 'I1'..'I5', nullable
  notes text
);

-- The only query shape this table will actually be read with: one pitcher's rows in a date
-- window (28-day weighted history, per-session detail, etc).
create index if not exists throw_log_pitcher_date_idx on throw_log (pitcher_id, throw_date);

alter table throw_log enable row level security;

-- Same pattern as principles_sections / athlete_state: any authenticated user can read, only a
-- caller whose own profiles row has role = 'coach' can write. No anon policy -- do not add one.
create policy "throw_log authenticated select" on throw_log
  for select to authenticated using (true);

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
