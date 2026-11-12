"""
PART D, data prep (Pitch Sequencing & Timing-Adjustment Model): the production scoring job.
Trains the BASE ("Pitch Alone") and FULL ("Pitch + Situation") models on ALL pitches pulled so
far (the held-out validation already happened in train_stage2_model.py), scores every pitch,
and writes one flat CSV that upload_pitch_scores.mjs then loads into Supabase for the UI.

Two things this script gets right that the previous version did not:

1. SAME POPULATION FOR BOTH NUMBERS. "Change" in the UI is Stage 2 minus Stage 1. Stage 2 can
   only be fit on pitch_num_in_pa >= 2 (no sequence exists before a PA's first pitch). The old
   Stage 1 was fit on every pitch, including first pitches, which get swung at far less often
   (~33% vs ~53%). That baked a constant ~+5 point offset into every swing "Change" that had
   nothing to do with sequencing. Now the BASE model shown next to Stage 2 is fit on the same
   pitch >= 2 population; first pitches get their own BASE model fit on first pitches.

2. PRIOR-PITCHES-ONLY BASELINES. A pitcher's release-point "norm" for a pitch is the mean of
   his EARLIER pitches of that type/side (earlier games and earlier in the same game), never the
   pitch itself or later ones -- the same definition the validation used. Previously the
   deployed norm averaged the whole dataset, so a Monday pitch was compared to a norm that
   included Saturday's pitches.

The deployed feature list is read from lib/timing-iq-metrics.json (written by
train_stage2_model.py) so training decides, scoring applies -- they cannot disagree.

Usage: ./.venv/bin/python scripts/score_all_pitches.py
"""
import json
import numpy as np
import pandas as pd
import shap

import timing_iq_common as T

METRICS_PATH = 'lib/timing-iq-metrics.json'
OUT_PATH = 'data/pitch-sequencing/scored_pitches.csv'

FEATURE_EXPLANATIONS = {
    'start_speed': "its velocity",
    'release_angle_vertical_deg': "its vertical release angle",
    'release_angle_horizontal_deg': "its horizontal release angle",
    'post_decision_break': "how much it kept moving after the swing-decision point",
    'decision_point_zone_mismatch': "whether it looked like a different call than it ended up being",
    'within_pa_expectation_deviation': "how different its location was from what he'd already seen this at-bat",
    'pitch_types_seen_this_pa': "how many different pitch shapes he'd already seen this at-bat",
    'pitch_type_is_new_this_pa': "whether this was a shape he hadn't seen yet this at-bat",
    'recency_same_shape': "how recently he'd seen this same shape",
    'tunnel_distance_from_prior_pitch': "how close its release point was to the previous pitch",
    'release_angle_tunnel_distance_deg': "how well it tunneled with the previous pitch at release",
    'release_deviation_from_own_baseline_ft': "whether the pitcher's release point matched his own usual spot for this pitch",
    'pitcher_min_tunnel_distance_deg': "how well this pitch type tunnels with the rest of his mix",
    'batter_intercept_point_range': "how much this hitter's timing shifts across pitch types",
    'batter_intercept_delta_fb_vs_breaking': "how much this hitter's timing shifts from fastballs to breaking balls",
    'batter_adjustability_percentile': "where this hitter ranks for timing adjustability",
    'release_extension': "how far out front the pitcher released it",
    'spin_axis_deg': "its spin axis",
}


def top_shap_matrix(explainer, X, feats):
    """SHAP values for every row in X at once -- returns (top_feature_per_row, top_value_per_row).
    SHAP ("SHapley Additive exPlanations") splits each prediction into a push up or down from
    each feature; the top one is the feature that moved this pitch's number the most."""
    values = explainer(X).values
    top_idx = np.argmax(np.abs(values), axis=1)
    return np.array(feats)[top_idx], values[np.arange(len(values)), top_idx]


def main():
    with open(METRICS_PATH) as f:
        metrics = json.load(f)
    full_features = metrics['deployed_features']
    print(f"Deployed FULL feature set from {METRICS_PATH} ({len(full_features)}): {full_features}")

    df = T.load_data()
    df = T.add_expanding_pitcher_baselines(df, min_n=T.MIN_BASELINE_N)
    print(f"Loaded {len(df)} pitches from {df['game_pk'].nunique()} games ({df.game_date.min()} to {df.game_date.max()})")

    first = df['pitch_num_in_pa'] == 1
    later = ~first
    base_feats = T.BASE_FEATURES

    # -- BASE ("Pitch Alone") models: one per population so Stage 1 and Stage 2 share a base rate
    base_first_swing = T.fit_binary(df[first], 'is_swing', base_feats)
    base_first_whiff = T.fit_binary(df[first & (df.is_swing == 1)], 'is_whiff', base_feats)
    base_later_swing = T.fit_binary(df[later], 'is_swing', base_feats)
    base_later_whiff = T.fit_binary(df[later & (df.is_swing == 1)], 'is_whiff', base_feats)

    df['stage1_swing_prob'] = np.nan
    df['stage1_whiff_prob'] = np.nan
    df.loc[first, 'stage1_swing_prob'] = base_first_swing.predict_proba(df.loc[first, base_feats])[:, 1]
    df.loc[first, 'stage1_whiff_prob'] = base_first_whiff.predict_proba(df.loc[first, base_feats])[:, 1]
    df.loc[later, 'stage1_swing_prob'] = base_later_swing.predict_proba(df.loc[later, base_feats])[:, 1]
    df.loc[later, 'stage1_whiff_prob'] = base_later_whiff.predict_proba(df.loc[later, base_feats])[:, 1]

    # -- FULL ("Pitch + Situation") models, pitch_num_in_pa >= 2 only
    full_swing = T.fit_binary(df[later], 'is_swing', full_features)
    full_whiff = T.fit_binary(df[later & (df.is_swing == 1)], 'is_whiff', full_features)
    df['stage2_swing_prob'] = np.nan
    df['stage2_whiff_prob'] = np.nan
    df.loc[later, 'stage2_swing_prob'] = full_swing.predict_proba(df.loc[later, full_features])[:, 1]
    df.loc[later, 'stage2_whiff_prob'] = full_whiff.predict_proba(df.loc[later, full_features])[:, 1]

    df['swing_lift'] = df['stage2_swing_prob'] - df['stage1_swing_prob']
    df['whiff_lift'] = df['stage2_whiff_prob'] - df['stage1_whiff_prob']
    print(f"Stage 2 scored: {int(later.sum())}/{len(df)} pitches (pitch_num_in_pa >= 2)")
    print(f"Mean swing lift (should now sit near 0, not +5 pts): {df.swing_lift.mean():+.4f}; mean whiff lift: {df.whiff_lift.mean():+.4f}")

    # -- per-pitch "Why": the feature that moved THIS pitch's number the most, from whichever
    # model matches what happened (swings explained by the whiff model, takes by the swing model),
    # and from Stage 2 where it exists, else Stage 1.
    top_feat = np.empty(len(df), dtype=object)
    top_val = np.zeros(len(df))
    for mask, model_swing, model_whiff, feats in [
        (first, base_first_swing, base_first_whiff, base_feats),
        (later, full_swing, full_whiff, full_features),
    ]:
        idx = np.flatnonzero(mask.values)
        X = df.loc[mask, feats]
        f_s, v_s = top_shap_matrix(shap.TreeExplainer(model_swing), X, feats)
        f_w, v_w = top_shap_matrix(shap.TreeExplainer(model_whiff), X, feats)
        swung = (df.loc[mask, 'is_swing'].values == 1)
        top_feat[idx] = np.where(swung, f_w, f_s)
        top_val[idx] = np.where(swung, v_w, v_s)

    df['top_shap_feature'] = top_feat
    # SHAP sign = direction the feature pushed the probability. The old wording ("more/less than
    # typical for this matchup") described the feature's VALUE, which SHAP does not tell us.
    directions = np.where(top_val > 0, 'raised', 'lowered')
    outcome = np.where(df['is_swing'] == 1, 'whiff', 'swing')
    df['insight_text'] = [
        f"Biggest factor: {FEATURE_EXPLANATIONS.get(f, f)} -- it {d} the {o} read the most."
        for f, d, o in zip(top_feat, directions, outcome)
    ]
    df['primary_metric'] = np.where(df['is_swing'] == 1, 'whiff', 'swing')

    out_cols = [
        'game_pk', 'game_date', 'away_team', 'home_team', 'inning', 'half_inning',
        'at_bat_index', 'pitch_num_in_pa',
        'pitcher_id', 'pitcher_name', 'batter_id', 'batter_name', 'batter_side',
        'pitch_type', 'pitch_type_desc', 'start_speed', 'balls_before', 'strikes_before',
        'call_description', 'is_swing', 'is_whiff',
        'stage1_swing_prob', 'stage1_whiff_prob', 'stage2_swing_prob', 'stage2_whiff_prob',
        'swing_lift', 'whiff_lift', 'primary_metric', 'top_shap_feature', 'insight_text',
        'post_decision_break', 'decision_point_zone_mismatch', 'within_pa_expectation_deviation',
        'release_deviation_from_own_baseline_ft', 'batter_intercept_point_range',
    ]
    out = df[out_cols]

    # Sanity checks before anything is written (the upload script repeats them independently).
    assert out['stage1_swing_prob'].notna().all() and out['stage1_whiff_prob'].notna().all(), 'null Stage 1 probability'
    assert out.loc[later, 'stage2_swing_prob'].notna().all(), 'null Stage 2 probability on a pitch >= 2'
    assert out.loc[first, 'stage2_swing_prob'].isna().all(), 'Stage 2 probability on a first pitch'
    for c in ['stage1_swing_prob', 'stage1_whiff_prob', 'stage2_swing_prob', 'stage2_whiff_prob']:
        assert out[c].dropna().between(0, 1).all(), f'{c} outside [0, 1]'
    assert not out.duplicated(['game_pk', 'at_bat_index', 'pitch_num_in_pa']).any(), 'duplicate pitch key'

    out.to_csv(OUT_PATH, index=False)
    print(f"Wrote {OUT_PATH} ({len(out)} rows)")

    print("\nSample (5 largest |swing_lift| -- where context most changed the read vs. the pitch alone):")
    sample = out.dropna(subset=['swing_lift']).reindex(out['swing_lift'].abs().sort_values(ascending=False).index).head(5)
    for _, r in sample.iterrows():
        print(f"  {r['pitcher_name']} -> {r['batter_name']}: {r['pitch_type']} {r['start_speed']}mph, "
              f"stage1={r['stage1_swing_prob']:.2f} stage2={r['stage2_swing_prob']:.2f} "
              f"(actual: {r['call_description']}) -- {r['insight_text']}")


if __name__ == '__main__':
    main()
