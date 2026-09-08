"""
PART C, STAGE 1 (Pitch Sequencing & Timing-Adjustment Model): "Recognition difficulty."

Trained ONLY on Part B2's pre-decision-point physics features (release angles,
post_decision_break, decision_point_zone_mismatch, release velocity) -- deliberately
excludes pitch_type, batter/pitcher identity, count state, and anything from Part B3/B5.
The point of Stage 1 is to isolate raw pitch deceptiveness, independent of sequencing --
Stage 2 (next) adds the sequence/pitcher-baseline/batter-profile features back in and the
gap between the two stages is what quantifies sequencing's actual contribution.

Two binary models (cleaner to validate/SHAP than one multiclass target):
  A) swing_vs_take   -- did the batter swing at all?
  B) whiff_vs_contact -- GIVEN a swing, was it a whiff (no contact) or contact (foul/in play)?

Train/holdout split is by DATE, not random rows -- holdout is the most recent ~15% of
pulled dates. Random row splitting would leak: pitches from the same PA/game share a lot of
context, so a random split lets the model "see" near-duplicates of holdout pitches during
training and overstates accuracy.

Usage: ./.venv/bin/python scripts/train_stage1_model.py
"""
import glob
import numpy as np
import pandas as pd
import xgboost as xgb
import shap
from sklearn.metrics import accuracy_score, confusion_matrix, roc_auc_score

FEATURES = [
    'start_speed',                  # release velocity
    'release_angle_vertical_deg',
    'release_angle_horizontal_deg',
    'post_decision_break',
    'decision_point_zone_mismatch',  # bool -> int
]

SWING_CALLS = {
    'Foul', 'Foul Tip', 'Foul Bunt', 'Missed Bunt',
    'Swinging Strike', 'Swinging Strike (Blocked)',
    'In play, out(s)', 'In play, no out', 'In play, run(s)',
}
WHIFF_CALLS = {'Swinging Strike', 'Swinging Strike (Blocked)', 'Missed Bunt'}



# Position players occasionally pitch in blowouts (Statcast still tracks them) -- their
# "pitches" are 30-60mph lobs with generic/joke pitch-type tags (FA, EP, KN at speeds no
# real pitcher throws), a handful of times a season each. Found via a real anomaly: two of
# these (Zach McKinstry, Andrew Vaughn) surfaced at the very top of the deployed tool's
# "most sequence-driven" sort, since their pitches are so far outside the model's normal
# input distribution that predictions swing wildly -- noise, not a real sequencing finding.
# A real pitcher's SLOWEST tracked pitch (show-me curveball, eephus as a change of pace) still
# sits well above this; using each pitcher's MEDIAN (not min, so one genuine slow pitch mixed
# into a normal outing doesn't trip it) keeps this a position-player filter, not a soft-pitch filter.
POSITION_PLAYER_MEDIAN_SPEED_FLOOR = 60


def load_data():
    files = sorted(glob.glob('data/pitch-sequencing/game_*_pitches.csv'))
    df = pd.concat([pd.read_csv(f) for f in files], ignore_index=True)
    df['decision_point_zone_mismatch'] = df['decision_point_zone_mismatch'].astype(bool).astype(int)
    df['is_swing'] = df['call_description'].isin(SWING_CALLS).astype(int)
    df['is_whiff'] = df['call_description'].isin(WHIFF_CALLS).astype(int)

    median_speed = df.groupby('pitcher_id')['start_speed'].median()
    position_players = median_speed[median_speed < POSITION_PLAYER_MEDIAN_SPEED_FLOOR].index
    if len(position_players) > 0:
        dropped = df[df['pitcher_id'].isin(position_players)]
        print(f"Dropping {len(position_players)} apparent position-player-pitching outing(s), {len(dropped)} pitches: "
              f"{sorted(dropped['pitcher_name'].unique())}")
        df = df[~df['pitcher_id'].isin(position_players)]
    return df


def make_holdout_split(df):
    game_pks = sorted(df['game_pk'].unique())
    cutoff_idx = int(len(game_pks) * 0.85)
    train_games = set(game_pks[:cutoff_idx])
    holdout_games = set(game_pks[cutoff_idx:])
    train = df[df['game_pk'].isin(train_games)]
    holdout = df[df['game_pk'].isin(holdout_games)]
    return train, holdout, len(train_games), len(holdout_games)


def train_binary_model(train, holdout, label_col, filter_fn=None, name=''):
    tr = train if filter_fn is None else filter_fn(train)
    ho = holdout if filter_fn is None else filter_fn(holdout)
    tr = tr.dropna(subset=FEATURES + [label_col])
    ho = ho.dropna(subset=FEATURES + [label_col])

    X_tr, y_tr = tr[FEATURES], tr[label_col]
    X_ho, y_ho = ho[FEATURES], ho[label_col]

    model = xgb.XGBClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.05,
        eval_metric='logloss', random_state=42,
    )
    model.fit(X_tr, y_tr)

    pred = model.predict(X_ho)
    proba = model.predict_proba(X_ho)[:, 1]
    acc = accuracy_score(y_ho, pred)
    auc = roc_auc_score(y_ho, proba)
    baseline = max(y_ho.mean(), 1 - y_ho.mean())  # accuracy of always predicting the majority class
    cm = confusion_matrix(y_ho, pred)

    print(f"\n=== {name} ===")
    print(f"train n={len(tr)}  holdout n={len(ho)}  positive rate (holdout)={y_ho.mean():.3f}")
    print(f"holdout accuracy={acc:.3f}  (majority-class baseline={baseline:.3f})  AUC={auc:.3f}")
    print(f"confusion matrix [[TN,FP],[FN,TP]]:\n{cm}")

    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X_ho)
    mean_abs_shap = np.abs(shap_values.values).mean(axis=0)
    importance = sorted(zip(FEATURES, mean_abs_shap), key=lambda x: -x[1])
    print("SHAP mean |impact| by feature:")
    for feat, val in importance:
        print(f"  {feat:32s} {val:.4f}")

    return model, explainer, X_ho, y_ho, importance


def main():
    df = load_data()
    print(f"Loaded {len(df)} pitches total")
    train, holdout, n_train_games, n_holdout_games = make_holdout_split(df)
    print(f"Split: {n_train_games} train games, {n_holdout_games} holdout games "
          f"({len(train)} / {len(holdout)} pitches)")

    train_binary_model(train, holdout, 'is_swing', name='A) swing_vs_take')

    train_binary_model(
        train, holdout, 'is_whiff',
        filter_fn=lambda d: d[d['is_swing'] == 1],
        name='B) whiff_vs_contact (given a swing)',
    )


if __name__ == '__main__':
    main()
