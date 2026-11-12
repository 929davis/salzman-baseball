"""
PART C, STAGE 1 (Pitch Sequencing & Timing-Adjustment Model): "Recognition difficulty."

Diagnostic run of the pitch-shape-only model on EVERY pitch (including each PA's first pitch),
deliberately excluding pitch_type, batter/pitcher identity, count state, and anything about the
sequence. The point is to isolate raw pitch deceptiveness. The head-to-head comparison that
quantifies what sequencing adds lives in train_stage2_model.py (which refits this same BASE
model on the pitch_num_in_pa >= 2 population so the comparison is apples to apples).

Data loading, the date-based holdout split, and the feature lists are shared with Stage 2 and
the scorer via timing_iq_common.py so they cannot drift apart. AUC is explained there.

Usage: ./.venv/bin/python scripts/train_stage1_model.py
"""
import numpy as np
import shap
from sklearn.metrics import accuracy_score, confusion_matrix, roc_auc_score

import timing_iq_common as T

# Re-exported for older imports.
FEATURES = T.BASE_FEATURES
SWING_CALLS = T.SWING_CALLS
WHIFF_CALLS = T.WHIFF_CALLS
POSITION_PLAYER_MEDIAN_SPEED_FLOOR = T.POSITION_PLAYER_MEDIAN_SPEED_FLOOR
load_data = T.load_data
make_holdout_split = T.make_holdout_split


def train_binary_model(train, holdout, label_col, filter_fn=None, name=''):
    tr = train if filter_fn is None else filter_fn(train)
    ho = holdout if filter_fn is None else filter_fn(holdout)
    tr = tr.dropna(subset=FEATURES + [label_col])
    ho = ho.dropna(subset=FEATURES + [label_col])

    model = T.fit_binary(tr, label_col, FEATURES)
    X_ho, y_ho = ho[FEATURES], ho[label_col]
    pred = model.predict(X_ho)
    proba = model.predict_proba(X_ho)[:, 1]
    acc = accuracy_score(y_ho, pred)
    auc = roc_auc_score(y_ho, proba)
    lo, hi = T.bootstrap_auc_ci(y_ho, proba)
    baseline = max(y_ho.mean(), 1 - y_ho.mean())  # accuracy of always predicting the majority class
    cm = confusion_matrix(y_ho, pred)

    print(f"\n=== {name} ===")
    print(f"train n={len(tr)}  holdout n={len(ho)}  positive rate (holdout)={y_ho.mean():.3f}")
    print(f"holdout accuracy={acc:.3f}  (majority-class baseline={baseline:.3f})  AUC={auc:.3f}  95% CI [{lo:.3f}, {hi:.3f}]")
    print(f"confusion matrix [[TN,FP],[FN,TP]]:\n{cm}")

    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X_ho)
    mean_abs_shap = np.abs(shap_values.values).mean(axis=0)
    importance = sorted(zip(FEATURES, mean_abs_shap), key=lambda x: -x[1])
    print("SHAP mean |impact| by feature (average size of each feature's push on the prediction):")
    for feat, val in importance:
        print(f"  {feat:32s} {val:.4f}")
    return model, explainer, X_ho, y_ho, importance


def main():
    df = T.load_data()
    print(f"Loaded {len(df)} pitches from {df.game_pk.nunique()} games ({df.game_date.min()} to {df.game_date.max()})")
    train, holdout, n_train_games, n_holdout_games = T.make_holdout_split(df)
    print(f"Split by date: {n_train_games} train games, {n_holdout_games} holdout games "
          f"({len(train)} / {len(holdout)} pitches); holdout dates: {sorted(holdout.game_date.unique())}")

    train_binary_model(train, holdout, 'is_swing', name='A) swing_vs_take')
    train_binary_model(train, holdout, 'is_whiff', filter_fn=lambda d: d[d['is_swing'] == 1],
                       name='B) whiff_vs_contact (given a swing)')


if __name__ == '__main__':
    main()
