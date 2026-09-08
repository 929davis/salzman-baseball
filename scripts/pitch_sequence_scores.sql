create table if not exists pitch_sequence_scores (
  id bigserial primary key,
  game_pk bigint not null,
  game_date date,
  away_team text,
  home_team text,
  inning int,
  half_inning text,
  at_bat_index int not null,
  pitch_num_in_pa int not null,
  pitcher_id bigint,
  pitcher_name text,
  batter_id bigint,
  batter_name text,
  batter_side text,
  pitch_type text,
  pitch_type_desc text,
  start_speed numeric,
  balls_before int,
  strikes_before int,
  call_description text,
  is_swing boolean,
  is_whiff boolean,
  stage1_swing_prob numeric,
  stage1_whiff_prob numeric,
  stage2_swing_prob numeric,
  stage2_whiff_prob numeric,
  swing_lift numeric,
  whiff_lift numeric,
  primary_metric text,
  top_shap_feature text,
  insight_text text,
  post_decision_break numeric,
  decision_point_zone_mismatch boolean,
  within_pa_expectation_deviation numeric,
  release_deviation_from_own_baseline_ft numeric,
  batter_intercept_point_range numeric,
  created_at timestamptz not null default now(),
  unique (game_pk, at_bat_index, pitch_num_in_pa)
);

create index if not exists idx_pitch_sequence_scores_pitcher on pitch_sequence_scores (pitcher_id);
create index if not exists idx_pitch_sequence_scores_batter on pitch_sequence_scores (batter_id);
create index if not exists idx_pitch_sequence_scores_game on pitch_sequence_scores (game_pk);

alter table pitch_sequence_scores enable row level security;
create policy "public read" on pitch_sequence_scores for select using (true);

-- Migration for an already-existing table (adds game/inning context + which probability
-- Stage 1/2 represent on each row, for the "By Game" drill-down view and clearer labeling).
alter table pitch_sequence_scores add column if not exists away_team text;
alter table pitch_sequence_scores add column if not exists home_team text;
alter table pitch_sequence_scores add column if not exists inning int;
alter table pitch_sequence_scores add column if not exists half_inning text;
alter table pitch_sequence_scores add column if not exists primary_metric text;
