-- The team_lift feature (has_team_lift / team_lift_heavy_day on athlete_state) was removed
-- from the principles doc, the coach UI (AthleteStatePanel.tsx), and the engine
-- (athleteConstraints.ts) during the 2026-09-25 principles review -- replaced by a general
-- "athlete lifting under an outside program" template (principles doc §9.6) that doesn't need
-- a tracked field. Run this manually in the Supabase SQL editor to drop the now-dead columns
-- from the live table. Irreversible -- confirm no data you need is still stored in either
-- column before running.
alter table athlete_state
  drop column if exists has_team_lift,
  drop column if exists team_lift_heavy_day;
