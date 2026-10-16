-- New table for the Plyometric Push-Up module (Phase 6 of the iPhone assessment spec).
-- Same shape and ownership model as cmj_results/hop_test_results: pitcher reads/inserts their
-- own; coach can read/insert/update/delete any pitcher's row.
--
-- Raw per-rep timestamps are kept separately from the derived summary columns, same reasoning
-- as the other two assessment tables -- metrics can be recomputed later if the formula changes.
--
-- Not executed automatically -- run manually in the Supabase SQL Editor after reviewing.

create table if not exists plyo_pushup_assessments (
  id uuid primary key default gen_random_uuid(),
  pitcher_id uuid not null references profiles(id),
  test_date date not null,
  fps integer not null,
  -- Raw per-rep input: [{contact_frame, bottom_frame, leave_frame}, ...], in chronological order.
  reps jsonb not null,
  final_contact_frame integer not null,
  stabilization_frame integer,
  rep_count integer not null,
  avg_ground_contact_sec double precision not null,
  best_ground_contact_sec double precision not null,
  avg_flight_sec double precision not null,
  best_flight_sec double precision not null,
  flight_consistency_pct double precision,
  stabilization_sec double precision,
  notes text,
  created_at timestamptz not null default now()
);

alter table plyo_pushup_assessments enable row level security;

drop policy if exists "plyo_pushup_assessments own or coach select" on plyo_pushup_assessments;
drop policy if exists "plyo_pushup_assessments own or coach insert" on plyo_pushup_assessments;
drop policy if exists "plyo_pushup_assessments coach update" on plyo_pushup_assessments;
drop policy if exists "plyo_pushup_assessments coach delete" on plyo_pushup_assessments;

create policy "plyo_pushup_assessments own or coach select" on plyo_pushup_assessments
  for select to authenticated
  using (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "plyo_pushup_assessments own or coach insert" on plyo_pushup_assessments
  for insert to authenticated
  with check (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "plyo_pushup_assessments coach update" on plyo_pushup_assessments
  for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "plyo_pushup_assessments coach delete" on plyo_pushup_assessments
  for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));
