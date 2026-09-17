-- One row per pitcher holding the athlete-model fields the coaching-logic rebuild needs to
-- filter/gate on (training status, equipment access, season phase, gates passed, an in-flight
-- mechanical change). Real typed columns, not jsonb -- these get queried/filtered on directly
-- (e.g. "everyone in specific_prep with G2 passed"), which a jsonb blob makes awkward and
-- unindexable.
--
-- Deliberately NOT reusing profiles.arm_level / profiles.arm_scores / profiles.one_rms -- all
-- three are dead columns today (zero readers/writers anywhere in the app, confirmed via grep)
-- and their shape (arm_level: unknown, presumably a single label; arm_scores/one_rms: jsonb
-- blobs) doesn't fit what this table needs to do. Left dead for now, to be dropped later.
create table if not exists athlete_state (
  pitcher_id uuid primary key references profiles(id),
  training_status text,      -- 'beginner' | 'intermediate' | 'advanced'
  equipment_tier text,       -- 'E1' | 'E2' | 'E3'
  throwing_status text,      -- 'building' | 'developing' | 'competing' | 'restricted'
  season_phase text,         -- 'transition' | 'general_prep' | 'specific_prep' | 'first_transition' | 'competitive'
  season_role text,          -- 'starter' | 'reliever'
  has_team_lift boolean not null default false,
  team_lift_heavy_day text,  -- day name, nullable
  gates_passed text[] not null default '{}', -- 'G1'..'G4', 'T1'..'T4'
  active_change text,        -- the one in-flight mechanical change, nullable
  active_change_stage int,   -- 1-4, nullable
  updated_at timestamptz default now()
);

alter table athlete_state enable row level security;

-- Same pattern as principles_sections: any authenticated user can read, only a caller whose
-- own profiles row has role = 'coach' can write. No anon policy -- do not add one.
create policy "athlete_state authenticated select" on athlete_state
  for select to authenticated using (true);

create policy "athlete_state coach insert" on athlete_state
  for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "athlete_state coach update" on athlete_state
  for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "athlete_state coach delete" on athlete_state
  for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));
