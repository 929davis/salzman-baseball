"""
PART C, STAGE 2 (Pitch Sequencing & Timing-Adjustment Model): "Sequencing value."

Trains nested models per target on the SAME date-based train/holdout split and compares them
head-to-head, so the gap between them isolates what each group of features contributes:
  BASE                 -- pitch-shape physics only ("Pitch Alone" in the UI)
  BASE+COUNT           -- control: adds the ball-strike count (NOT part of the tool's story,
                          but count predicts swinging strongly and sequence features correlate
                          with pitch number, so this is the honest comparison point)
  BASE+SEQ             -- adds sequence-within-PA features
  BASE+SEQ+BASELINE    -- adds pitcher release-point / tunnel baselines (prior pitches only)
  FULL                 -- adds the batter timing profile ("Pitch + Situation" in the UI)
  FULL+COUNT           -- everything, with count, for the count-controlled improvement
  FULL+EXTRA           -- candidate upgrade: release extension + spin axis

Restricted to pitch_num_in_pa >= 2: a PA's first pitch has no prior-pitch sequence context by
definition. BASE is refit on this same restricted population so the comparison is fair.

Every number the UI's Model Validation panel shows is written to lib/timing-iq-metrics.json by
this script -- the component imports that file, so the panel cannot go stale after a retrain.

Stats terms, in plain English (see timing_iq_common.py for the full glossary):
  AUC -- how often the model ranks a real swing (or whiff) above a real non-swing; 0.5 = coin
         flip, 1.0 = perfect. It's a ranking score, not a probability.
  Bootstrap CI -- re-sample the holdout pitches 2,000 times and recompute; the middle 95% of
         those results is the interval. If an improvement's interval includes 0, it is not
         reliably above noise.
  Calibration / ECE -- whether "70%" pitches really swing ~70% of the time; ECE is the average
         gap between predicted and observed, in probability points.

Usage: ./.venv/bin/python scripts/train_stage2_model.py
"""
import json
import datetime as dt
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import roc_auc_score

import timing_iq_common as T

METRICS_PATH = 'lib/timing-iq-metrics.json'
N_BOOT = 2000

# The batter profile (Savant swing-path leaderboard) is a season-level aggregate. It is only
# leakage-free if the export was taken BEFORE the first game in the dataset. See
# scripts/build-batter-swing-profiles.mjs and audit/timing-iq-audit.md for how the current
# file was produced; flip this to False to drop the batter features from the deployed model.
INCLUDE_BATTER_FEATURES = True

# Pre-registered rule for the candidate EXTRA features (release_extension, spin_axis_deg):
# keep them only if the paired bootstrap CI of their improvement over FULL excludes 0 on at
# least one target AND the point estimate is not negative on the other. Written down before
# the numbers were seen; not tuned afterwards.
def extra_features_keep_rule(deltas):
    lower_bounds_positive = [d['ci_low'] > 0 for d in deltas.values()]
    point_nonneg = [d['delta'] >= 0 for d in deltas.values()]
    return any(lower_bounds_positive) and all(point_nonneg)


def feature_sets():
    full = T.BASE_FEATURES + T.SEQ_FEATURES + T.BASELINE_FEATURES + (T.BATTER_FEATURES if INCLUDE_BATTER_FEATURES else [])
    return {
        'BASE': T.BASE_FEATURES,
        'BASE+COUNT': T.BASE_FEATURES + T.COUNT_FEATURES,
        'BASE+SEQ': T.BASE_FEATURES + T.SEQ_FEATURES,
        'BASE+SEQ+BASELINE': T.BASE_FEATURES + T.SEQ_FEATURES + T.BASELINE_FEATURES,
        'FULL': full,
        'FULL+COUNT': full + T.COUNT_FEATURES,
        'FULL+EXTRA': full + T.EXTRA_FEATURES,
        'FULL+COUNT+EXTRA': full + T.COUNT_FEATURES + T.EXTRA_FEATURES,
    }


COMPARISONS = [
    # (from, to, key, label shown in the UI / report)
    ('BASE', 'FULL', 'headline', 'Pitch alone -> pitch + situation'),
    ('BASE+COUNT', 'FULL+COUNT', 'count_controlled', 'Same, after both sides also know the count'),
    ('BASE', 'BASE+COUNT', 'count_alone', 'What the count alone adds to pitch shape'),
    ('BASE', 'BASE+SEQ', 'sequence_only', 'Sequence features alone'),
    ('BASE+SEQ', 'BASE+SEQ+BASELINE', 'pitcher_baseline', 'Pitcher release-point baseline increment'),
    ('BASE+SEQ+BASELINE', 'FULL', 'batter_profile', 'Batter timing profile increment'),
    ('FULL', 'FULL+EXTRA', 'extra_features', 'Release extension + spin axis increment'),
]


def run_target(train, holdout, label_col, filter_fn=None):
    tr = train if filter_fn is None else filter_fn(train)
    ho = holdout if filter_fn is None else filter_fn(holdout)
    sets = feature_sets()
    preds, models = {}, {}
    print(f'  n_train={len(tr)}  n_holdout={len(ho)}  holdout event rate={ho[label_col].mean():.3f}')
    for name, feats in sets.items():
        m = T.fit_binary(tr, label_col, feats)
        p = m.predict_proba(ho[feats])[:, 1]
        preds[name], models[name] = p, m
    y = ho[label_col].values

    out_models = {}
    for name, p in preds.items():
        auc = roc_auc_score(y, p)
        lo, hi = T.bootstrap_auc_ci(y, p, n_boot=N_BOOT)
        out_models[name] = {'auc': round(float(auc), 4), 'ci_low': round(lo, 4), 'ci_high': round(hi, 4), 'features': sets[name]}
        print(f'  {name:18s} AUC={auc:.3f}  95% CI [{lo:.3f}, {hi:.3f}]')

    out_comparisons = {}
    for a, b, key, label in COMPARISONS:
        d = roc_auc_score(y, preds[b]) - roc_auc_score(y, preds[a])
        lo, hi, p_le0 = T.bootstrap_auc_delta_ci(y, preds[a], preds[b], n_boot=N_BOOT)
        reliable = lo > 0
        out_comparisons[key] = {'from': a, 'to': b, 'label': label, 'delta': round(float(d), 4),
                                'ci_low': round(lo, 4), 'ci_high': round(hi, 4), 'p_le_zero': round(p_le0, 4),
                                'reliable': bool(reliable)}
        print(f'  {a:>18s} -> {b:18s} dAUC={d:+.3f} [{lo:+.3f}, {hi:+.3f}]  {"reliable" if reliable else "WITHIN NOISE"}')

    calib = {}
    for name in ('BASE', 'FULL'):
        bins, ece = T.calibration_table(y, preds[name])
        calib[name] = {'ece': round(ece, 4), 'bins': [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in b.items()} for b in bins]}
        print(f'  calibration {name}: ECE={ece:.3f}')

    explainer = shap.TreeExplainer(models['FULL'])
    shap_values = explainer(ho[sets['FULL']])
    mean_abs = np.abs(shap_values.values).mean(axis=0)
    importance = sorted(zip(sets['FULL'], mean_abs), key=lambda x: -x[1])
    print('  SHAP mean |impact| by feature (FULL model) -- how much each feature moved the prediction on average:')
    for feat, val in importance:
        print(f'    {feat:38s} {val:.4f}')

    return {
        'n_train': int(len(tr)), 'n_holdout': int(len(ho)),
        'holdout_event_rate': round(float(y.mean()), 4),
        'models': out_models, 'comparisons': out_comparisons, 'calibration': calib,
        'shap_mean_abs_full': [{'feature': f, 'value': round(float(v), 4)} for f, v in importance],
    }


def main():
    df_all = T.load_data()
    df_all = T.add_expanding_pitcher_baselines(df_all, min_n=T.MIN_BASELINE_N)
    extra_available = bool(df_all[T.EXTRA_FEATURES].notna().all(axis=1).mean() > 0.5)
    df = df_all[df_all['pitch_num_in_pa'] >= 2].copy()
    print(f'Loaded {len(df_all)} pitches from {df_all.game_pk.nunique()} games ({df_all.game_date.min()} to {df_all.game_date.max()}); '
          f'{len(df)} with pitch_num_in_pa >= 2')
    print(f'Baseline coverage (pitch>=2, prior pitches only, min_n={T.MIN_BASELINE_N}): '
          f'release deviation {df.release_deviation_from_own_baseline_ft.notna().mean():.1%}, '
          f'min tunnel {df.pitcher_min_tunnel_distance_deg.notna().mean():.1%}')
    print(f'Extra features (release_extension, spin_axis_deg) available: {extra_available}')

    train, holdout, n_train_games, n_holdout_games = T.make_holdout_split(df)
    holdout_dates = sorted(holdout.game_date.unique().tolist())
    print(f'Split by date: {n_train_games} train games ({train.game_date.min()}..{train.game_date.max()}), '
          f'{n_holdout_games} holdout games ({", ".join(holdout_dates)})')

    print('\n=== A) swing_vs_take ===')
    swing = run_target(train, holdout, 'is_swing')
    print('\n=== B) whiff_vs_contact (given a swing) ===')
    whiff = run_target(train, holdout, 'is_whiff', filter_fn=lambda d: d[d['is_swing'] == 1])

    extra_deltas = {'swing': swing['comparisons']['extra_features'], 'whiff': whiff['comparisons']['extra_features']}
    if not extra_available:
        extra_decision, extra_reason = 'not_available', 'release_extension / spin_axis_deg are missing from the game CSVs (re-pull games with scripts/repull-games.mjs).'
    elif extra_features_keep_rule(extra_deltas):
        extra_decision, extra_reason = 'keep', 'Improvement over FULL cleared the 95% CI on at least one target without hurting the other.'
    else:
        extra_decision, extra_reason = 'drop', 'Improvement over FULL did not clear the 95% CI (within noise), so they are left out of the deployed model.'
    deployed = feature_sets()['FULL'] + (T.EXTRA_FEATURES if extra_decision == 'keep' else [])
    print(f'\nEXTRA features decision: {extra_decision} -- {extra_reason}')
    print(f'Deployed feature set ({len(deployed)}): {deployed}')

    metrics = {
        'generated_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
        'metric': 'AUC',
        'metric_plain_english': 'How often the model ranks a pitch where the event happened above one where it did not. 0.5 is a coin flip, 1.0 is perfect.',
        'data': {
            'n_games': int(df_all.game_pk.nunique()), 'n_pitches': int(len(df_all)), 'n_pitches_modeled': int(len(df)),
            'date_start': str(df_all.game_date.min()), 'date_end': str(df_all.game_date.max()),
            'n_pitchers': int(df_all.pitcher_id.nunique()), 'n_batters': int(df_all.batter_id.nunique()),
            'n_train_games': int(n_train_games), 'n_holdout_games': int(n_holdout_games), 'holdout_dates': holdout_dates,
            'batter_profile_coverage': round(float(df.batter_intercept_point_range.notna().mean()), 4),
            'release_baseline_coverage': round(float(df.release_deviation_from_own_baseline_ft.notna().mean()), 4),
        },
        'method': {
            'split': 'by date; holdout = most recent dates until >= 15% of games', 'min_baseline_n': T.MIN_BASELINE_N,
            'baselines': 'prior pitches only (earlier games and earlier in the same game), never the pitch itself or anything after it',
            'n_bootstrap': N_BOOT, 'xgb_params': T.XGB_PARAMS, 'include_batter_features': INCLUDE_BATTER_FEATURES,
        },
        'deployed_features': deployed,
        'extra_features': {'candidates': T.EXTRA_FEATURES, 'available': extra_available, 'decision': extra_decision, 'reason': extra_reason, 'deltas': extra_deltas},
        'targets': {'swing': swing, 'whiff': whiff},
    }
    with open(METRICS_PATH, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f'\nWrote {METRICS_PATH}')


if __name__ == '__main__':
    main()
