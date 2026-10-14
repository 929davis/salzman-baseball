-- New table for the Repeated Hop Test module (Phase 4 of the iPhone assessment spec).
-- Mirrors cmj_results' shape and ownership model: pitcher reads/inserts their own; coach can
-- read/insert/update/delete any pitcher's row (roster-wide entry/correction in the coach
-- dashboard), same as sql/rls_pitcher_isolation.sql already does for cmj_results.
--
-- Raw per-hop timestamps are kept (as frames, same convention as cmj_results' start_frame/
-- takeoff_frame/landing_frame) separately from the derived summary columns, so metrics can be
-- recomputed later if the formula changes -- same reasoning as "preserve raw observations
-- separately from derived outputs" in the spec.
--
-- Not executed automatically -- run manually in the Supabase SQL Editor after reviewing.

create table if not exists hop_test_results (
  id uuid primary key default gen_random_uuid(),
  pitcher_id uuid not null references profiles(id),
  test_date date not null,
  fps integer not null,
  -- Names the protocol explicitly, per the spec's "do not assume every hop test uses the same
  -- RSI definition -- make the protocol and formula explicit." This app currently only
  -- implements one: classic RSI (flight time / ground contact time) over a repeated-hop series.
  protocol text not null default 'repeated_hop_rsi_v1',
  -- One of 'left' | 'right' | 'both' -- the limb tested, if this was a single-leg protocol.
  limb text,
  -- Raw per-hop input: [{landing_frame, takeoff_frame, limb}, ...], in chronological order.
  hops jsonb not null,
  valid_hop_count integer not null,
  avg_ground_contact_sec double precision not null,
  best_ground_contact_sec double precision not null,
  avg_rsi double precision,
  best_rsi double precision,
  rsi_consistency_pct double precision,
  left_avg_rsi double precision,
  right_avg_rsi double precision,
  notes text,
  created_at timestamptz not null default now()
);

alter table hop_test_results enable row level security;

drop policy if exists "hop_test_results own or coach select" on hop_test_results;
drop policy if exists "hop_test_results own or coach insert" on hop_test_results;
drop policy if exists "hop_test_results coach update" on hop_test_results;
drop policy if exists "hop_test_results coach delete" on hop_test_results;

create policy "hop_test_results own or coach select" on hop_test_results
  for select to authenticated
  using (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "hop_test_results own or coach insert" on hop_test_results
  for insert to authenticated
  with check (pitcher_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "hop_test_results coach update" on hop_test_results
  for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "hop_test_results coach delete" on hop_test_results
  for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));
