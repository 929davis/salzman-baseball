"""
Shared data/feature/evaluation helpers for the Timing IQ (Pitch Sequencing & Timing-Adjustment)
model. Used by train_stage1_model.py, train_stage2_model.py, and score_all_pitches.py so the
three scripts can't drift apart on how the data is loaded, split, or featurized.

Plain-English glossary for the stats terms used in this file (each is explained the first time
it appears in code comments, and again in docs/timing-iq-report.md):

  AUC ("area under the ROC curve"): how often the model ranks a randomly chosen pitch where the
      event happened (e.g. a swing) above a randomly chosen pitch where it didn't. 0.5 is a coin
      flip, 1.0 is perfect. It measures ranking only -- it says nothing about whether a displayed
      "70%" is really 70%.
  Holdout: games the model never saw during training, used to measure how it does on new data.
  Leakage: when a feature secretly contains information from the future (or from the holdout
      games), which makes validation numbers look better than they would be in real use.
  Bootstrap confidence interval (CI): re-sample the holdout pitches with replacement many times,
      recompute the number each time, and report the middle 95% of those results. If the
      interval for an improvement includes 0, the improvement is not reliably above noise.
  Calibration: whether predicted probabilities match reality -- among pitches the model called
      "70% swing", did ~70% actually get swung at?
"""
import glob
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import roc_auc_score

DATA_GLOB = 'data/pitch-sequencing/game_*_pitches.csv'

BASE_FEATURES = [
    'start_speed',                  # release velocity
    'release_angle_vertical_deg',
    'release_angle_horizontal_deg',
    'post_decision_break',
    'decision_point_zone_mismatch',  # bool -> int
]
# Ball-strike count BEFORE the pitch. Deliberately NOT part of the "situation" story the tool
# tells -- it's included in the validation runs as a control, because count alone predicts
# swinging very strongly (3-0: ~6% swings, 3-2: ~68% in this data) and several sequence
# features (how many pitch types seen so far, etc.) grow with pitch number and therefore
# correlate with count. The honest question is whether sequencing adds anything BEYOND count.
COUNT_FEATURES = ['balls_before', 'strikes_before']
SEQ_FEATURES = [
    'pitch_types_seen_this_pa',
    'pitch_type_is_new_this_pa',
    'recency_same_shape',
    'tunnel_distance_from_prior_pitch',
    'release_angle_tunnel_distance_deg',
    'within_pa_expectation_deviation',
]
BASELINE_FEATURES = [
    'release_deviation_from_own_baseline_ft',   # this pitch's release vs. this pitcher's OWN
                                                 # release-point norm for this type/side
    'pitcher_min_tunnel_distance_deg',          # how well this pitch type tunnels with the
                                                 # closest OTHER pitch type in this pitcher's mix
]
BATTER_FEATURES = [
    'batter_intercept_point_range',
    'batter_intercept_delta_fb_vs_breaking',
    'batter_adjustability_percentile',
]
# Candidate upgrade features (flagged in audit/findings.md). Present in the CSVs only after
# re-pulling games with the updated extractor; kept in the model only if they clear the
# bootstrap CI on the holdout -- see train_stage2_model.py.
EXTRA_FEATURES = ['release_extension', 'spin_axis_deg']

SWING_CALLS = {
    'Foul', 'Foul Tip', 'Foul Bunt', 'Missed Bunt',
    'Swinging Strike', 'Swinging Strike (Blocked)',
    'In play, out(s)', 'In play, no out', 'In play, run(s)',
}
WHIFF_CALLS = {'Swinging Strike', 'Swinging Strike (Blocked)', 'Missed Bunt'}

# Position players occasionally pitch in blowouts (Statcast still tracks them) -- their
# "pitches" are 30-60mph lobs with generic/joke pitch-type tags, a handful of times a season
# each. Using each pitcher's MEDIAN speed (not min) keeps this a position-player filter, not a
# soft-pitch filter.
POSITION_PLAYER_MEDIAN_SPEED_FLOOR = 60

# A pitcher/type/side combo needs at least this many PRIOR pitches before we trust its mean
# release point as a "norm". Raised from 3: with 3 pitches the standard error of the mean
# release point (~0.1 ft) is about the size of the drift being measured, so a "deviation" is
# mostly noise. With 10 it's roughly 0.05 ft. The sensitivity of the results to this choice is
# reported in audit/timing-iq-audit.md rather than tuned on the holdout.
MIN_BASELINE_N = 10

HOLDOUT_FRACTION = 0.15

XGB_PARAMS = dict(n_estimators=200, max_depth=4, learning_rate=0.05, eval_metric='logloss', random_state=42)


def load_data(verbose=True):
    files = sorted(glob.glob(DATA_GLOB))
    if not files:
        raise FileNotFoundError(f'No files match {DATA_GLOB} -- run from the repo root after pulling games')
    df = pd.concat([pd.read_csv(f) for f in files], ignore_index=True)
    df['decision_point_zone_mismatch'] = df['decision_point_zone_mismatch'].astype(bool).astype(int)
    df['pitch_type_is_new_this_pa'] = df['pitch_type_is_new_this_pa'].astype(bool).astype(int)
    df['is_swing'] = df['call_description'].isin(SWING_CALLS).astype(int)
    df['is_whiff'] = df['call_description'].isin(WHIFF_CALLS).astype(int)
    for col in EXTRA_FEATURES:
        if col not in df.columns:
            df[col] = np.nan

    if 'game_type' in df.columns:
        non_regular = df[df['game_type'].notna() & (df['game_type'] != 'R')]
        if len(non_regular):
            raise ValueError(f'{len(non_regular)} pitches are not regular-season (game_type != R): '
                             f'{sorted(non_regular["game_type"].unique())}. Timing IQ is regular-season only.')

    median_speed = df.groupby('pitcher_id')['start_speed'].median()
    position_players = median_speed[median_speed < POSITION_PLAYER_MEDIAN_SPEED_FLOOR].index
    if len(position_players) > 0:
        dropped = df[df['pitcher_id'].isin(position_players)]
        if verbose:
            print(f"Dropping {len(position_players)} apparent position-player-pitching outing(s), {len(dropped)} pitches: "
                  f"{sorted(dropped['pitcher_name'].unique())}")
        df = df[~df['pitcher_id'].isin(position_players)]

    # Chronological order within the dataset: date, then game, then at-bat, then pitch. Every
    # "prior pitches only" computation below relies on this ordering.
    df = df.sort_values(['game_date', 'game_pk', 'at_bat_index', 'pitch_num_in_pa']).reset_index(drop=True)
    return df


def make_holdout_split(df, fraction=HOLDOUT_FRACTION):
    """Split by DATE: the holdout is the most recent dates, adding whole days until at least
    `fraction` of games are held out. Every holdout game is on or after every training game's
    date, so nothing computed from training games can contain the future.

    (The previous version sorted by game_pk and took the top 15%. game_pk is a schedule ID,
    not a timestamp -- in this data that put holdout games on every one of the 7 dates, so the
    docstring's "most recent 15% of dates" was not what actually happened.)"""
    games = df[['game_pk', 'game_date']].drop_duplicates().sort_values(['game_date', 'game_pk'])
    n_games = len(games)
    dates_desc = sorted(games['game_date'].unique(), reverse=True)
    holdout_dates, n_holdout = [], 0
    for d in dates_desc:
        holdout_dates.append(d)
        n_holdout += (games['game_date'] == d).sum()
        if n_holdout >= n_games * fraction:
            break
    holdout_mask = df['game_date'].isin(holdout_dates)
    train, holdout = df[~holdout_mask], df[holdout_mask]
    return train, holdout, n_games - n_holdout, n_holdout


def add_expanding_pitcher_baselines(df, min_n=MIN_BASELINE_N):
    """Pitcher release-point and tunnel baselines computed from PRIOR PITCHES ONLY.

    For each pitch, the baseline is the mean of this pitcher's earlier pitches of the same
    type (and batter side, for release point) -- earlier games AND earlier in the same game,
    never the pitch itself and never anything after it. This is the information a coach in the
    dugout would actually have had at that moment, and it makes the feature leakage-free by
    construction, for training rows and holdout rows alike.

    Returns a copy with `release_deviation_from_own_baseline_ft` and
    `pitcher_min_tunnel_distance_deg` filled (NaN where fewer than `min_n` prior pitches exist).
    `df` must already be in chronological order (load_data() does this)."""
    df = df.copy()
    if not df.index.is_monotonic_increasing:
        df = df.sort_values(['game_date', 'game_pk', 'at_bat_index', 'pitch_num_in_pa']).reset_index(drop=True)

    # --- release-point deviation: expanding mean of (x0, z0) over prior same-type/same-side pitches
    key = ['pitcher_id', 'pitch_type', 'batter_side']
    g = df.groupby(key, sort=False, dropna=False)
    prior_n = g.cumcount()
    prior_x_mean = (g['x0'].cumsum() - df['x0']) / prior_n.replace(0, np.nan)
    prior_z_mean = (g['z0'].cumsum() - df['z0']) / prior_n.replace(0, np.nan)
    dev = np.hypot(df['x0'] - prior_x_mean, df['z0'] - prior_z_mean)
    dev[prior_n < min_n] = np.nan
    df['release_deviation_from_own_baseline_ft'] = dev

    # --- min tunnel distance: for each pitch, the distance between this pitch type's prior
    # mean release angles and the closest OTHER pitch type's prior mean release angles, both
    # computed from this pitcher's earlier pitches only.
    df['pitcher_min_tunnel_distance_deg'] = np.nan
    v_col, h_col = 'release_angle_vertical_deg', 'release_angle_horizontal_deg'
    out = np.full(len(df), np.nan)
    for _, idx in df.groupby('pitcher_id', sort=False).indices.items():
        sums = {}  # pitch_type -> [n, sum_v, sum_h]
        for i in idx:
            t = df.at[i, 'pitch_type']
            if not isinstance(t, str):
                continue
            own = sums.get(t)
            if own is not None and own[0] >= min_n:
                v0, h0 = own[1] / own[0], own[2] / own[0]
                best = np.inf
                for t2, (n2, sv, sh) in sums.items():
                    if t2 == t or n2 < min_n:
                        continue
                    d = np.hypot(v0 - sv / n2, h0 - sh / n2)
                    if d < best:
                        best = d
                if np.isfinite(best):
                    out[i] = best
            v, h = df.at[i, v_col], df.at[i, h_col]
            if np.isfinite(v) and np.isfinite(h):
                if own is None:
                    sums[t] = [1, v, h]
                else:
                    own[0] += 1; own[1] += v; own[2] += h
    df['pitcher_min_tunnel_distance_deg'] = out
    return df


def fit_binary(train_df, label_col, features):
    d = train_df.dropna(subset=[label_col])
    model = xgb.XGBClassifier(**XGB_PARAMS)
    model.fit(d[features], d[label_col])
    return model


def bootstrap_auc_ci(y, p, n_boot=2000, seed=42):
    """95% bootstrap CI for AUC: resample the holdout rows with replacement n_boot times."""
    rng = np.random.default_rng(seed)
    y = np.asarray(y); p = np.asarray(p)
    aucs = []
    n = len(y)
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        yy = y[idx]
        if yy.min() == yy.max():
            continue
        aucs.append(roc_auc_score(yy, p[idx]))
    return float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))


def bootstrap_auc_delta_ci(y, p_a, p_b, n_boot=2000, seed=42):
    """95% PAIRED bootstrap CI for AUC(b) - AUC(a): the same resampled rows are scored by both
    models each time, so the interval reflects the uncertainty of the *difference*, not of two
    independent numbers. If it includes 0, model b is not reliably better than model a."""
    rng = np.random.default_rng(seed)
    y = np.asarray(y); p_a = np.asarray(p_a); p_b = np.asarray(p_b)
    deltas = []
    n = len(y)
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        yy = y[idx]
        if yy.min() == yy.max():
            continue
        deltas.append(roc_auc_score(yy, p_b[idx]) - roc_auc_score(yy, p_a[idx]))
    deltas = np.asarray(deltas)
    return float(np.percentile(deltas, 2.5)), float(np.percentile(deltas, 97.5)), float((deltas <= 0).mean())


def calibration_table(y, p, n_bins=10):
    """Reliability table: bucket predictions into equal-width probability bins and compare the
    mean prediction to the observed event rate in each bin. Also returns the Expected
    Calibration Error (ECE): the average absolute gap between predicted and observed, weighted
    by how many pitches landed in each bin. 0 is perfect; 0.05 means the displayed
    probabilities are off by about 5 points on average."""
    y = np.asarray(y); p = np.asarray(p)
    edges = np.linspace(0, 1, n_bins + 1)
    rows, ece = [], 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (p >= lo) & (p < hi) if hi < 1 else (p >= lo) & (p <= hi)
        if m.sum() == 0:
            continue
        pred, obs, n = float(p[m].mean()), float(y[m].mean()), int(m.sum())
        rows.append({'bin_lo': float(lo), 'bin_hi': float(hi), 'n': n, 'mean_predicted': pred, 'observed_rate': obs})
        ece += abs(pred - obs) * n / len(p)
    return rows, float(ece)
