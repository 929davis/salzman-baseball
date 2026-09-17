-- Security fix, independent of the rest of the coaching-logic rebuild.
--
-- These 4 tables had no RLS enabled at all, which under Supabase's default grants means the
-- PUBLIC anon key (the one shipped in client-side JS, embedded in every page load) could read
-- every row -- confirmed empirically by comparing anon-key vs service-role-key row counts
-- during the audit. profiles is the worst of these: anyone holding the public anon key could
-- read every coach's and pitcher's email, full name, and role with zero login required.
--
-- Not executed automatically -- run manually after reviewing.

alter table profiles enable row level security;
alter table food_logs enable row level security;
alter table daily_fuel_scores enable row level security;
alter table mechanics_frame_logs enable row level security;

-- profiles: read-only from the app's perspective. Confirmed via grep -- there is no INSERT or
-- UPDATE path to `profiles` anywhere in app/ today (new rows are created by the standard
-- Supabase auth trigger off auth.users, which runs as a security-definer function and bypasses
-- RLS entirely; existing rows like avg_velocity/weekly_pitches appear to be maintained directly
-- in the Supabase dashboard). No write policy is added here on purpose -- if a write path gets
-- added later, add its policy then, scoped to what that feature actually needs.
create policy "profiles authenticated select" on profiles
  for select to authenticated using (true);

-- food_logs / daily_fuel_scores / mechanics_frame_logs: both read and write stay blanket
-- "any authenticated user" here, matching this schema's existing convention on tables like
-- social_posts.sql (`for insert to authenticated with check (true)`) rather than introducing
-- new pitcher-owns-their-own-row scoping that wasn't asked for in this pass. That said: today
-- ANY authenticated pitcher can also write ANY OTHER pitcher's food_logs/daily_fuel_scores row
-- (there's no ownership check at all, RLS-enabled or not) -- worth a deliberate follow-up
-- decision, not something this migration silently changes.
create policy "food_logs authenticated select" on food_logs
  for select to authenticated using (true);
create policy "food_logs authenticated insert" on food_logs
  for insert to authenticated with check (true);
create policy "food_logs authenticated update" on food_logs
  for update to authenticated using (true) with check (true);

create policy "daily_fuel_scores authenticated select" on daily_fuel_scores
  for select to authenticated using (true);
create policy "daily_fuel_scores authenticated insert" on daily_fuel_scores
  for insert to authenticated with check (true);
create policy "daily_fuel_scores authenticated update" on daily_fuel_scores
  for update to authenticated using (true) with check (true);

create policy "mechanics_frame_logs authenticated select" on mechanics_frame_logs
  for select to authenticated using (true);
create policy "mechanics_frame_logs authenticated insert" on mechanics_frame_logs
  for insert to authenticated with check (true);
create policy "mechanics_frame_logs authenticated update" on mechanics_frame_logs
  for update to authenticated using (true) with check (true);

-- No anon policy is created for any of the 4 tables above, on purpose. Do not add one.
