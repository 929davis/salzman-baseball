"""
PART D, data prep (Pitch Sequencing & Timing-Adjustment Model): the production scoring
job. Trains the BASE ("Stage 1 alone") and FULL ("Stage 2") models on ALL pitches pulled
so far (no held-out split -- that validation already happened in train_stage1_model.py /
train_stage2_model.py), scores every pitch, and writes one flat CSV that
upload_pitch_scores.mjs then upserts into Supabase for the UI to read.

Re-run this after pulling new games (pull-recent-games.mjs), then re-run
upload_pitch_scores.mjs -- matches the existing aggregate-base-scenario.mjs pattern
(compute locally, upsert via the Node/Supabase side, since there's no Python runtime in
the deployed app).

Usage: ./.venv/bin/python scripts/score_all_pitches.py
"""
import glob
import numpy as np
import pandas as pd
import xgboost as xgb
import shap

from train_stage1_model import SWING_CALLS, WHIFF_CALLS, POSITION_PLAYER_MEDIAN_SPEED_FLOOR
from train_stage2_model import (
    SEQ_FEATURES, BASELINE_FEATURES, BATTER_FEATURES, MIN_BASELINE_N,
)

BASE_FEATURES = [
    'start_speed', 'release_angle_vertical_deg', 'release_angle_horizontal_deg',
    'post_decision_break', 'decision_point_zone_mismatch',
]
FULL_FEATURES = BASE_FEATURES + SEQ_FEATURES + BASELINE_FEATURES + BATTER_FEATURES

FEATURE_EXPLANATIONS = {
    'start_speed': "its velocity",
    'release_angle_vertical_deg': "where it crossed the zone vertically",
    'release_angle_horizontal_deg': "where it crossed the zone horizontally",
    'post_decision_break': "how much it kept moving after the swing-decision point",
    'decision_point_zone_mismatch': "whether it looked like a different call than it ended up being",
    'within_pa_expectation_deviation': "how different its location was from what he'd already seen this at-bat",
    'pitch_types_seen_this_pa': "how many different pitch shapes he'd already seen this at-bat",
    'pitch_type_is_new_this_pa': "whether this was a shape he hadn't seen yet this at-bat",
    'recency_same_shape': "how recently he'd seen this same shape",
    'tunnel_distance_from_prior_pitch': "how close its release point was to the previous pitch",
    'release_angle_tunnel_distance_deg': "how well it tunneled with the previous pitch at release",
    'release_deviation_from_own_baseline_ft': "whether the pitcher's release point matched his own normal spot for this pitch",
    'pitcher_min_tunnel_distance_deg': "how well this pitch type tunnels with the rest of his mix",
    'batter_intercept_point_range': "how much this hitter's timing shifts across pitch types",
    'batter_intercept_delta_fb_vs_breaking': "how much this hitter's timing shifts from fastballs to breaking balls",
}


def load_all_pitches():
    files = sorted(glob.glob('data/pitch-sequencing/game_*_pitches.csv'))
    df = pd.concat([pd.read_csv(f) for f in files], ignore_index=True)
    df['decision_point_zone_mismatch'] = df['decision_point_zone_mismatch'].astype(bool).astype(int)
    df['pitch_type_is_new_this_pa'] = df['pitch_type_is_new_this_pa'].astype(bool).astype(int)
    df['is_swing'] = df['call_description'].isin(SWING_CALLS).astype(int)
    df['is_whiff'] = df['call_description'].isin(WHIFF_CALLS).astype(int)

    # Position players occasionally pitch in blowouts -- see train_stage1_model.py for why
    # these get excluded (real outliers found via this exact tool's own "most sequence-driven"
    # sort surfacing them as noise, not signal).
    median_speed = df.groupby('pitcher_id')['start_speed'].median()
    position_players = median_speed[median_speed < POSITION_PLAYER_MEDIAN_SPEED_FLOOR].index
    if len(position_players) > 0:
        dropped = df[df['pitcher_id'].isin(position_players)]
        print(f"Dropping {len(position_players)} apparent position-player-pitching outing(s), {len(dropped)} pitches: "
              f"{sorted(dropped['pitcher_name'].unique())}")
        df = df[~df['pitcher_id'].isin(position_players)]
    return df


def fit_binary(df, label_col, features, filter_fn=None):
    d = df if filter_fn is None else filter_fn(df)
    d = d.dropna(subset=[label_col])
    X, y = d[features], d[label_col]
    model = xgb.XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.05, eval_metric='logloss', random_state=42)
    model.fit(X, y)
    return model


def build_pitcher_baseline_lookups(df):
    """Same B4 logic as train_stage2_model.py, but here `df` IS all available history --
    this is a deployed baseline, not a leakage-safe validation split."""
    release_key = df.groupby(['pitcher_id', 'pitch_type', 'batter_side']).agg(
        x0_mean=('x0', 'mean'), z0_mean=('z0', 'mean'), n=('x0', 'size'),
    )
    release_key = release_key[release_key['n'] >= MIN_BASELINE_N]

    angle_key = df.groupby(['pitcher_id', 'pitch_type']).agg(
        v_mean=('release_angle_vertical_deg', 'mean'),
        h_mean=('release_angle_horizontal_deg', 'mean'),
        n=('release_angle_vertical_deg', 'size'),
    )
    angle_key = angle_key[angle_key['n'] >= MIN_BASELINE_N]

    min_tunnel = {}
    for pitcher_id, sub in angle_key.groupby(level=0):
        types = sub.index.get_level_values(1)
        if len(types) < 2:
            continue
        for t in types:
            v0, h0 = sub.loc[(pitcher_id, t), ['v_mean', 'h_mean']]
            dists = [np.hypot(v0 - sub.loc[(pitcher_id, t2), 'v_mean'], h0 - sub.loc[(pitcher_id, t2), 'h_mean'])
                     for t2 in types if t2 != t]
            min_tunnel[(pitcher_id, t)] = min(dists)

    def release_dev(row):
        key = (row['pitcher_id'], row['pitch_type'], row['batter_side'])
        if key not in release_key.index:
            return np.nan
        x0m, z0m = release_key.loc[key, ['x0_mean', 'z0_mean']]
        return float(np.hypot(row['x0'] - x0m, row['z0'] - z0m))

    def min_tunnel_lookup(row):
        return min_tunnel.get((row['pitcher_id'], row['pitch_type']), np.nan)

    return release_dev, min_tunnel_lookup


def top_shap_matrix(explainer, X, feats):
    """SHAP values for every row in X at once (fast) -- returns (top_feature_per_row,
    top_value_per_row), avoiding a per-row explainer() call (which is orders of magnitude
    slower over ~30k rows)."""
    values = explainer(X).values
    top_idx = np.argmax(np.abs(values), axis=1)
    top_feat = np.array(feats)[top_idx]
    top_val = values[np.arange(len(values)), top_idx]
    return top_feat, top_val


def main():
    df = load_all_pitches()
    print(f"Loaded {len(df)} pitches from {df['game_pk'].nunique()} games")

    # -- BASE ("Stage 1 alone") models, trained on every pitch --
    base_swing_model = fit_binary(df, 'is_swing', BASE_FEATURES)
    base_whiff_model = fit_binary(df, 'is_whiff', BASE_FEATURES, filter_fn=lambda d: d[d['is_swing'] == 1])
    base_swing_explainer = shap.TreeExplainer(base_swing_model)
    base_whiff_explainer = shap.TreeExplainer(base_whiff_model)

    df['stage1_swing_prob'] = base_swing_model.predict_proba(df[BASE_FEATURES])[:, 1]
    df['stage1_whiff_prob'] = base_whiff_model.predict_proba(df[BASE_FEATURES])[:, 1]

    # -- FULL ("Stage 2") models, trained on pitch_num_in_pa >= 2 only (sequence features
    # are structurally undefined for a PA's first pitch) --
    full_df = df[df['pitch_num_in_pa'] >= 2].copy()
    release_dev, min_tunnel_lookup = build_pitcher_baseline_lookups(full_df)
    full_df['release_deviation_from_own_baseline_ft'] = full_df.apply(release_dev, axis=1)
    full_df['pitcher_min_tunnel_distance_deg'] = full_df.apply(min_tunnel_lookup, axis=1)

    full_swing_model = fit_binary(full_df, 'is_swing', FULL_FEATURES)
    full_whiff_model = fit_binary(full_df, 'is_whiff', FULL_FEATURES, filter_fn=lambda d: d[d['is_swing'] == 1])
    full_swing_explainer = shap.TreeExplainer(full_swing_model)
    full_whiff_explainer = shap.TreeExplainer(full_whiff_model)

    full_df['stage2_swing_prob'] = full_swing_model.predict_proba(full_df[FULL_FEATURES])[:, 1]
    full_df['stage2_whiff_prob'] = full_whiff_model.predict_proba(full_df[FULL_FEATURES])[:, 1]

    # Only bring back columns that don't already exist on df -- SEQ_FEATURES/BATTER_FEATURES
    # were already present for every row from the original per-pitch extraction (B3/B5 were
    # computed at pull time); only the B4 baseline lookups and the Stage 2 probabilities are
    # new here.
    df = df.merge(
        full_df[['game_pk', 'game_date', 'at_bat_index', 'pitch_num_in_pa',
                  'release_deviation_from_own_baseline_ft', 'pitcher_min_tunnel_distance_deg',
                  'stage2_swing_prob', 'stage2_whiff_prob']],
        on=['game_pk', 'game_date', 'at_bat_index', 'pitch_num_in_pa'], how='left',
    )

    df['swing_lift'] = df['stage2_swing_prob'] - df['stage1_swing_prob']
    df['whiff_lift'] = df['stage2_whiff_prob'] - df['stage1_whiff_prob']

    print(f"Stage 2 scored: {df['stage2_swing_prob'].notna().sum()}/{len(df)} pitches (pitch_num_in_pa >= 2)")

    # -- per-pitch insight text: explain whichever model matches what actually happened --
    # (swings get explained by the whiff model, takes by the swing model), computed as 4
    # vectorized SHAP passes rather than one explainer() call per row.
    has_full = df['stage2_swing_prob'].notna()

    base_swing_feat, base_swing_val = top_shap_matrix(base_swing_explainer, df[BASE_FEATURES], BASE_FEATURES)
    base_whiff_feat, base_whiff_val = top_shap_matrix(base_whiff_explainer, df[BASE_FEATURES], BASE_FEATURES)
    full_swing_feat, full_swing_val = top_shap_matrix(full_swing_explainer, df.loc[has_full, FULL_FEATURES], FULL_FEATURES)
    full_whiff_feat, full_whiff_val = top_shap_matrix(full_whiff_explainer, df.loc[has_full, FULL_FEATURES], FULL_FEATURES)

    top_feat = np.where(df['is_swing'] == 1, base_whiff_feat, base_swing_feat).astype(object)
    top_val = np.where(df['is_swing'] == 1, base_whiff_val, base_swing_val)
    full_idx = np.flatnonzero(has_full.values)
    is_swing_full = df.loc[has_full, 'is_swing'].values
    top_feat[full_idx] = np.where(is_swing_full == 1, full_whiff_feat, full_swing_feat)
    top_val[full_idx] = np.where(is_swing_full == 1, full_whiff_val, full_swing_val)

    df['top_shap_feature'] = top_feat
    directions = np.where(top_val > 0, 'more', 'less')
    df['insight_text'] = [
        f"Most influential factor: {FEATURE_EXPLANATIONS.get(f, f)} ({d} than typical for this matchup)."
        for f, d in zip(top_feat, directions)
    ]
    # Which probability Stage 1/Stage 2 actually represent on this row -- takes get graded on
    # swing likelihood, swings get graded on whiff likelihood (see module docstring). Surfaced
    # explicitly so the UI can label it instead of leaving it ambiguous which number is shown.
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
    out_path = 'data/pitch-sequencing/scored_pitches.csv'
    out.to_csv(out_path, index=False)
    print(f"Wrote {out_path} ({len(out)} rows)")

    print("\nSample (5 highest swing_lift -- sequence context most changed the read vs. raw physics alone):")
    sample = out.dropna(subset=['swing_lift']).reindex(out['swing_lift'].abs().sort_values(ascending=False).index).head(5)
    for _, r in sample.iterrows():
        print(f"  {r['pitcher_name']} -> {r['batter_name']}: {r['pitch_type']} {r['start_speed']}mph, "
              f"stage1={r['stage1_swing_prob']:.2f} stage2={r['stage2_swing_prob']:.2f} "
              f"(actual: {r['call_description']}) -- {r['insight_text']}")


if __name__ == '__main__':
    main()
