"""
PART C, STAGE 2 (Pitch Sequencing & Timing-Adjustment Model): "Sequencing value."

Design note -- a deliberate deviation from the literal spec wording: rather than feeding
Stage 1's raw predicted probabilities in as Stage 2 features (which would be almost
tautological for re-predicting the SAME target and wouldn't cleanly show what sequencing
itself is contributing), this trains three nested models per target and compares them
head-to-head on the identical train/holdout split:
  1) BASE       -- Part B2 physics features only (this IS "Stage 1 alone")
  2) BASE + SEQ -- adds Part B3 sequence-within-PA features
  3) FULL       -- adds Part B4 pitcher-baseline deviation + Part A/B5 batter profile
The accuracy/AUC gap from (1)->(3) is the sequencing/context contribution the original
design was after -- isolated cleanly instead of blended through a redundant feature.

Restricted to pitch_num_in_pa >= 2: a PA's first pitch has no prior-pitch sequence
context by definition (recency/tunnel/within-PA-deviation are all undefined), so comparing
BASE vs FULL over a population that includes pitches where SEQ features are structurally
absent would understate sequencing's contribution. BASE is refit on this same restricted
population for a fair comparison -- it is NOT the same numbers as the original Stage 1
script (which used every pitch, including PA-openers).

Missing values (recency_same_shape when a type is new to the PA; batter profile columns
for batters outside Part A's qualified-hitter list) are left as NaN and handed to XGBoost's
native missing-value routing rather than dropped or imputed -- preserves sample size and is
the standard way tree models handle "this feature doesn't apply here."

Usage: ./.venv/bin/python scripts/train_stage2_model.py
"""
import numpy as np
import pandas as pd
import xgboost as xgb
import shap
from sklearn.metrics import accuracy_score, confusion_matrix, roc_auc_score

from train_stage1_model import load_data, make_holdout_split, FEATURES as BASE_FEATURES

SEQ_FEATURES = [
    'pitch_types_seen_this_pa',
    'pitch_type_is_new_this_pa',
    'recency_same_shape',
    'tunnel_distance_from_prior_pitch',
    'release_angle_tunnel_distance_deg',
    'within_pa_expectation_deviation',
]
BASELINE_FEATURES = [
    'release_deviation_from_own_baseline_ft',   # B4: this pitch's release vs. this pitcher's
                                                 # OWN release-point norm for this type/side
    'pitcher_min_tunnel_distance_deg',          # B4: how well this pitch type tunnels with
                                                 # the closest OTHER pitch in this pitcher's mix
]
BATTER_FEATURES = [
    'batter_intercept_point_range',             # A/B5
    'batter_intercept_delta_fb_vs_breaking',    # A/B5
    'batter_adjustability_percentile',          # A/B5
]
FULL_FEATURES = BASE_FEATURES + SEQ_FEATURES + BASELINE_FEATURES + BATTER_FEATURES

MIN_BASELINE_N = 3  # a pitcher/type/side combo needs at least this many train pitches to
                     # count as a real release-point norm, not one noisy data point


def add_pitcher_baseline_features(df, train):
    """B4, applied leakage-safely: baselines are computed from TRAIN pitches only, then
    looked up for every row (train and holdout alike)."""
    release_key = train.groupby(['pitcher_id', 'pitch_type', 'batter_side']).agg(
        x0_mean=('x0', 'mean'), z0_mean=('z0', 'mean'), n=('x0', 'size'),
    )
    release_key = release_key[release_key['n'] >= MIN_BASELINE_N]

    angle_key = train.groupby(['pitcher_id', 'pitch_type']).agg(
        v_mean=('release_angle_vertical_deg', 'mean'),
        h_mean=('release_angle_horizontal_deg', 'mean'),
        n=('release_angle_vertical_deg', 'size'),
    )
    angle_key = angle_key[angle_key['n'] >= MIN_BASELINE_N]

    # per-pitcher min tunnel distance from each of their pitch types to their closest other type
    min_tunnel = {}
    for pitcher_id, sub in angle_key.groupby(level=0):
        types = sub.index.get_level_values(1)
        if len(types) < 2:
            continue
        for t in types:
            v0, h0 = sub.loc[(pitcher_id, t), ['v_mean', 'h_mean']]
            dists = []
            for t2 in types:
                if t2 == t:
                    continue
                v1, h1 = sub.loc[(pitcher_id, t2), ['v_mean', 'h_mean']]
                dists.append(np.hypot(v0 - v1, h0 - h1))
            min_tunnel[(pitcher_id, t)] = min(dists)

    def lookup_release_dev(row):
        key = (row['pitcher_id'], row['pitch_type'], row['batter_side'])
        if key not in release_key.index:
            return np.nan
        x0m, z0m = release_key.loc[key, ['x0_mean', 'z0_mean']]
        return float(np.hypot(row['x0'] - x0m, row['z0'] - z0m))

    def lookup_min_tunnel(row):
        return min_tunnel.get((row['pitcher_id'], row['pitch_type']), np.nan)

    df = df.copy()
    df['release_deviation_from_own_baseline_ft'] = df.apply(lookup_release_dev, axis=1)
    df['pitcher_min_tunnel_distance_deg'] = df.apply(lookup_min_tunnel, axis=1)
    return df


def train_and_eval(train, holdout, label_col, feature_set, name, filter_fn=None):
    tr = train if filter_fn is None else filter_fn(train)
    ho = holdout if filter_fn is None else filter_fn(holdout)
    tr = tr.dropna(subset=[label_col])
    ho = ho.dropna(subset=[label_col])

    X_tr, y_tr = tr[feature_set], tr[label_col]
    X_ho, y_ho = ho[feature_set], ho[label_col]

    model = xgb.XGBClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.05,
        eval_metric='logloss', random_state=42,
    )
    model.fit(X_tr, y_tr)
    pred = model.predict(X_ho)
    proba = model.predict_proba(X_ho)[:, 1]
    acc = accuracy_score(y_ho, pred)
    auc = roc_auc_score(y_ho, proba)
    print(f"  {name:26s} acc={acc:.3f}  AUC={auc:.3f}  (n_train={len(tr)}, n_holdout={len(ho)})")
    return model, X_ho, y_ho, auc


def run_target(train, holdout, label_col, name, filter_fn=None):
    print(f"\n=== {name} ===")
    base_model, *_ = train_and_eval(train, holdout, label_col, BASE_FEATURES, 'BASE (Stage 1 alone)', filter_fn)
    seq_model, *_ = train_and_eval(train, holdout, label_col, BASE_FEATURES + SEQ_FEATURES, 'BASE + SEQ (B3)', filter_fn)
    full_model, X_ho, y_ho, full_auc = train_and_eval(train, holdout, label_col, FULL_FEATURES, 'FULL (B3+B4+B5)', filter_fn)

    explainer = shap.TreeExplainer(full_model)
    shap_values = explainer(X_ho.fillna(np.nan))
    mean_abs_shap = np.abs(shap_values.values).mean(axis=0)
    importance = sorted(zip(FULL_FEATURES, mean_abs_shap), key=lambda x: -x[1])
    print("  SHAP mean |impact| by feature (FULL model):")
    for feat, val in importance:
        tag = ''
        if feat in SEQ_FEATURES: tag = ' [B3 sequence]'
        elif feat in BASELINE_FEATURES: tag = ' [B4 pitcher baseline]'
        elif feat in BATTER_FEATURES: tag = ' [A/B5 batter profile]'
        print(f"    {feat:38s} {val:.4f}{tag}")


def main():
    df = load_data()
    df = df[df['pitch_num_in_pa'] >= 2].copy()
    print(f"Restricted to pitch_num_in_pa >= 2: {len(df)} pitches (dropped every PA's opening pitch -- no sequence context exists there by definition)")

    train, holdout, n_train_games, n_holdout_games = make_holdout_split(df)
    print(f"Split: {n_train_games} train games, {n_holdout_games} holdout games ({len(train)} / {len(holdout)} pitches)")

    train = add_pitcher_baseline_features(train, train)
    holdout = add_pitcher_baseline_features(holdout, train)  # baselines from TRAIN only -- no leakage

    run_target(train, holdout, 'is_swing', 'A) swing_vs_take')
    run_target(train, holdout, 'is_whiff', 'B) whiff_vs_contact (given a swing)', filter_fn=lambda d: d[d['is_swing'] == 1])


if __name__ == '__main__':
    main()
