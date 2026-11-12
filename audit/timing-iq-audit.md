# Timing IQ audit — 2026-11-10

Scope: the Timing IQ tool (`app/components/TimingIQTool.tsx`) and the pipeline behind it
(`scripts/lib/extractGamePitches.mjs`, `pull-recent-games.mjs`, `build-batter-swing-profiles.mjs`,
`train_stage1_model.py`, `train_stage2_model.py`, `score_all_pitches.py`, `upload_pitch_scores.mjs`).
Everything below was measured by re-running the pipeline on the data in `data/pitch-sequencing/`
(97 games, 28,699 pitches after the position-player filter). Branch: `timing-iq-audit`.

Plain-English glossary, used throughout:

- **AUC** ("area under the ROC curve"): how often the model ranks a random pitch where the event
  happened (a swing, or a whiff) above a random pitch where it didn't. 0.5 is a coin flip, 1.0 is
  perfect. It grades *ranking only* — it says nothing about whether a displayed "70%" is really 70%.
- **Holdout**: games the model never saw during training, used to measure how it does on new data.
- **Leakage**: a feature that secretly contains information from the future, or from the holdout
  games. It makes validation numbers look better than real use would.
- **Bootstrap confidence interval (CI)**: re-sample the holdout pitches with replacement 2,000 times,
  recompute the number each time, and report the middle 95% of the results. If the interval for an
  *improvement* includes 0, the improvement is not reliably above noise.
- **Paired bootstrap**: the same resampled pitches are scored by both models each time, so the
  interval describes the uncertainty of the *difference*, not of two separate numbers.
- **Calibration / ECE**: whether predicted probabilities match reality. ECE (expected calibration
  error) is the average gap between predicted and observed, in probability points, weighted by how
  many pitches landed in each bin. 0 is perfect; 0.05 means "off by about 5 points on average".
- **SHAP**: splits one prediction into a push up or down from each feature. The "Why" column shows
  the single biggest push.

Findings are ranked by how much they change what the tool tells a user.

---

## 1. The "Change" column carried a built-in +5 point bias that had nothing to do with sequencing (HIGH)

**What**: In `score_all_pitches.py`, the Stage 1 ("Pitch Alone") model was trained on **every**
pitch, including each plate appearance's first pitch, while the Stage 2 ("Pitch + Situation")
model was trained only on pitch 2 and later (sequence features don't exist before a PA's first
pitch). First pitches are swung at 33% of the time; later pitches 53%. So Stage 1's numbers for
pitch ≥ 2 rows were systematically too low, and "Change" (Stage 2 − Stage 1) was systematically
positive.

**Measured** on the live `scored_pitches.csv`: mean swing lift **+5.1 points**, even though the
mean Stage 2 swing probability (0.533) equals the actual swing rate (0.533) exactly. Stage 1's
mean on the same rows was 0.482. The "Avg sequence lift" tile on the page, which averages
|Change|, was inflated by this constant offset.

**Fix** (`score_all_pitches.py`): Stage 1 for pitch ≥ 2 rows is now fit on the same pitch ≥ 2
population; first pitches get their own Stage 1 model fit on first pitches. The validation script
already did this (it refit BASE on pitch ≥ 2), so the *published validation numbers were not
affected* — only the per-pitch numbers users see were.

## 2. The holdout was not "the most recent 15% of games" (HIGH for the claim, small for the numbers)

**What**: `make_holdout_split` sorted by `game_pk` (a schedule ID) and took the top 15%. The
docstring and the page both describe a time-ordered split. In this data the holdout games fell on
**all seven dates** (Aug 31–Sep 6); 14 of 15 holdout games were dated before the last training
game. Training-set pitcher baselines therefore included pitches thrown *after* some holdout pitches.

**Measured effect**: small. Reproducing the original method today gives swing BASE 0.691 → FULL
0.733, whiff BASE 0.671 → FULL 0.679 (page shows 0.693/0.735 and 0.656/0.679; the whiff BASE
difference is a library-version drift, see §8). With a true date split (train Aug 31–Sep 5, holdout
Sep 6, 15 games) and prior-pitch-only baselines: swing 0.697 → 0.757, whiff 0.651 → 0.670. The
swing improvement is *larger* under the honest split, not smaller. So this was a correctness and
honesty problem, not a hidden inflation.

**Fix** (`timing_iq_common.make_holdout_split`): split by date, adding whole days from the most
recent backwards until ≥ 15% of games are held out.

## 3. Data leakage in the two "situation" feature groups (MEDIUM — bounded and now quantified)

### 3a. Pitcher release-point / tunnel baselines
- **Validation** (`train_stage2_model.py`): baselines came from training pitches only, looked up
  for holdout rows. Leakage-free *for the holdout*, but each training row's baseline included the
  pitch itself and later training pitches, and (because of §2) pitches from later dates.
- **Deployed scoring** (`score_all_pitches.py`): baselines averaged the **entire dataset**, so a
  Monday pitch's "deviation from his norm" was measured against a norm that included Saturday.
  Not a validation inflation, but it contradicts what the page says the feature means.
- **Fix**: `add_expanding_pitcher_baselines` computes each pitch's norm from that pitcher's
  *earlier* pitches only (earlier games and earlier in the same game), for training, holdout, and
  deployed scoring alike. `MIN_BASELINE_N` raised from 3 to 10 (with 3 prior pitches, the standard
  error of the mean release point is about the size of the drift being measured).
- **Cost**: coverage. With prior-only baselines and n ≥ 10, a release-point deviation exists for
  **29%** of pitch ≥ 2 rows (min-tunnel: 40%). With n ≥ 3 it would be 70% / 78%. The AUC is the
  same either way (sensitivity run: FULL swing 0.754 at n=3 vs 0.757 at n=10; whiff 0.658 vs
  0.670), because — see §5 — this feature group contributes nothing measurable.

### 3b. Batter timing profile (Savant swing-path leaderboard)
- The eight CSVs in `data/swing-path/` were exported on **Sep 7, 2026**, i.e. season-to-date
  through the last day in the dataset. Every holdout game's swings are inside the profile. This is
  real leakage in form.
- **Upper bound on inflation**: the paired bootstrap for adding the batter features to
  BASE+SEQ+BASELINE is **+0.000 [−0.002, +0.002]** for swing and **+0.002 [−0.009, +0.014]** for
  whiff. The leakage cannot have inflated the headline numbers by more than that, and the feature
  does not measurably help.
- **Why so small**: the profile is a 5-month aggregate of a stable trait (where a hitter meets the
  ball by pitch category); one week of games is ~4% of it, and it only covers 58% of pitches
  (qualified hitters only).
- **Fix**: see §9 — whether a strictly-prior (as-of Aug 30) export could be rebuilt from Savant,
  and what was done.

## 4. Count confound — the swing claim survives it; the whiff claim does not (HIGH for how the claim is worded)

Count is not a model feature, but swing rate in this data runs from **6% at 3-0 to 68% at 3-2**,
and several sequence features grow with pitch number, so they could be proxying count. Nested
models on the corrected split (swing target, holdout n = 3,268):

| Model | AUC | 95% CI |
|---|---|---|
| Count only | 0.580 | [0.561, 0.600] |
| BASE (pitch shape) | 0.697 | [0.678, 0.715] |
| BASE + COUNT | 0.727 | [0.709, 0.745] |
| BASE + SEQ | 0.756 | [0.739, 0.773] |
| BASE + COUNT + SEQ | 0.778 | [0.762, 0.794] |
| FULL (SEQ + baselines + batter) | 0.757 | [0.739, 0.775] |
| FULL + COUNT | 0.778 | [0.762, 0.794] |

Paired improvements, swing:
- BASE → FULL (the headline as published): **+0.061 [+0.045, +0.076]**
- BASE+COUNT → FULL+COUNT (sequencing *beyond* count): **+0.051 [+0.037, +0.065]**
- BASE → BASE+COUNT (what count alone adds): +0.030 [+0.019, +0.043]

So about one-sixth of the sequence lift on swing/take is count showing through; five-sixths
survives when both sides know the count. **The swing claim holds.**

Whiff-given-swing (holdout n = 1,746):
- BASE 0.651 [0.618, 0.683] → FULL 0.670 [0.637, 0.700]: **+0.019 [−0.007, +0.046]** — includes 0.
- BASE+COUNT → FULL+COUNT: +0.029 [+0.003, +0.057] — barely excludes 0, *but* this version
  includes the leaky batter profile; without it (BASE+COUNT → BASE+COUNT+SEQ+BASELINE) it is
  +0.012 [−0.014, +0.038].
- Count alone adds +0.008 [−0.001, +0.017] to whiff.

**The whiff improvement is within noise with one week of data.** The page currently presents it as
evidence. It should be presented as "not yet established".

## 5. Two of the three "situation" ingredients contribute nothing measurable (MEDIUM)

The page says "Pitch + Situation adds three things". Measured increments (swing / whiff):
- Sequence-within-PA features: **+0.060 / +0.014** — this is the whole effect.
- Pitcher release-point baseline: +0.001 [−0.004, +0.006] / +0.003 [−0.010, +0.016] — noise.
- Batter timing profile: +0.000 [−0.002, +0.002] / +0.002 [−0.009, +0.014] — noise.

This doesn't mean release-point drift is meaningless in baseball; it means *one week of games*,
with a norm available for under a third of pitches, cannot show it. The page should say the
measured effect comes from what the hitter has already seen in the at-bat.

## 6. Metric identity and the "0–100 score" wording (MEDIUM)

- The numbers are **AUC** (`sklearn.metrics.roc_auc_score`), shown as `Math.round(auc * 100)`.
- The page's description ("how well the model separates what actually happened from what didn't,
  on a 0-100 scale: 50 means no better than a guess, 100 means perfect") is a fair plain-English
  description of AUC, but never names it, calls it a "Score", and the "Improvement … +4 pts" reads
  like percentage points of accuracy. The validation numbers were hard-coded in the component and
  silently out of date (see §8).
- Fix: the component now imports `lib/timing-iq-metrics.json`, written by the training script,
  names the metric, shows the CI, and labels each improvement as reliable or within noise.

## 7. Calibration is good (LOW — good news)

Holdout reliability, corrected split:
- Swing — BASE ECE 0.011; FULL ECE 0.018–0.023. In the 0.6–0.7 bin (n = 650), FULL predicts 0.653
  and 0.686 is observed; in 0.8–0.9 (n = 280) it predicts 0.837 and 0.839 is observed. The only
  visible miss is the 0.9+ bin with n = 6–11.
- Whiff — BASE ECE 0.015; FULL ECE 0.014–0.020. Slight under-prediction in the 0.0–0.3 bins (e.g.
  predicts 0.152, observes 0.161) and tiny bins above 0.6.
A displayed probability is, on average, within about 2 points of the observed rate. No systematic
over-confidence worth a correction.

## 8. Everything else found in the scripts, upload, and component

- **Hard-coded validation numbers don't match a re-run.** Page: whiff BASE 0.656. Re-running the
  committed script on the committed data: 0.671. The swing numbers reproduce to within 0.002.
  Most likely a dependency drift (XGBoost 3.4.1 / SHAP 0.52 today) since the number was typed in.
  Either way, numbers typed into a component go stale invisibly. Fixed by the JSON hand-off.
- **"Why" text described the wrong thing.** `insight_text` read "its velocity (less than typical for
  this matchup)". The direction came from the SHAP sign, which says whether the feature pushed the
  *probability* up or down, not whether the feature's *value* was high or low. Reworded to
  "Biggest factor: its velocity — it lowered the swing read the most."
- **The dataset is one week, not a season.** 97 games, Aug 31–Sep 6, 2026. The page says
  "thousands of pitches and hundreds of pitchers" (true: 28,699 / 442) but never says one week.
  184 of 442 pitchers appear in exactly one game. The page now states the window.
- **Regular-season filter.** Nothing in the pipeline checked `gameType`; all 97 games are type
  `R`, by luck of the date range. The extractor now records `game_type` and the loader refuses
  anything that isn't `R`.
- **Upload script emptied the table before inserting.** `delete().gte('id', 0)` then batched
  upserts: a failure mid-run left the live table partially empty. It was idempotent in the narrow
  sense (unique key + upsert) but not safe. Rewritten: upsert in place, delete only stale keys
  afterwards, refuse to run on any failed sanity check, verify the final count and anon
  readability.
- **No sanity checks anywhere** between the scorer and the live table. Added in both.
- **Pitch-1 handling.** First pitches got Stage 1 from the all-pitch model and no Stage 2 — fine —
  but the baseline lookups in the scorer were built from pitch ≥ 2 rows only, discarding first
  pitches as *history*. A pitcher's first pitch of a PA is perfectly good evidence of his release
  point. Prior-pitch baselines now use every earlier pitch.
- **Component: a Supabase error hangs on "Loading..." forever** (`fetchAllRows(...).then(...)`
  with no catch; already in `audit/findings.md` P1). Added an error state.
- **Component: mobile.** The card layout below 700px is fine; the validation table scrolls
  horizontally. Kept; the rebuilt panel uses stacked rows instead of a 4-column table.
- **Stage 1 script duplicated the loader and feature list** that Stage 2 and the scorer imported
  from it, with a separate copy of `BASE_FEATURES` in the scorer. Consolidated into
  `scripts/timing_iq_common.py`.
- **`release_extension` / `spin_axis`** (flagged in `audit/findings.md`): both are in the MLB live
  feed (`pitchData.extension`, `pitchData.breaks.spinDirection`) for 100% of pitches in the test
  game. See §10 for whether they earned a place in the model.

## 9. Batter profile — rebuilt leakage-free, but the original export could not be reproduced

**What was checked.** Savant's swing-path leaderboard accepts `dateStart`/`dateEnd` (the page's
own End Date input is `name="dateEnd"`), and the pitch-type group checkboxes on the page define
Fastball = FF/SI/FC, Breaking = CU/SL/ST/SV/KN, Offspeed = CH/FS/FO/SC. A May 1 cutoff cuts a
hitter's swing count by two-thirds, so the window is honored.

**What could not be established.** The six original CSVs were exported by hand on Sep 7 with
unrecorded filters. For Nick Kurtz (LHH) they show 108 fastball / 32 breaking / 12 offspeed
competitive swings; the full regular season by Savant's groups gives 378 / 170 / 120, and no
single pitch type (FF alone: 206) or sub-group matches either. The original was therefore some
narrower window or filter that nobody wrote down. (A first probe mis-read Kurtz as evidence that
the date parameter was ignored — Aug 30 and Sep 7 cutoffs gave identical numbers — but that is
because he did not play after mid-July; a July 1 cutoff did move the numbers.)

**What was done.** `scripts/fetch-swing-path-exports.mjs` now downloads the six files with an
explicit, recorded window — **2026-03-01 to 2026-08-30, regular season, qualified hitters,
Savant's groups** — and writes `data/swing-path/export_manifest.json`. Aug 30 is the day before
the first game in the dataset, so every swing in the profile happened before every pitch it is
used on. `train_stage2_model.py` reads the manifest and **drops the batter features
automatically** if the window does not end before the first game (or the manifest is missing),
and records the window in `lib/timing-iq-metrics.json`. The two batting-stance files were kept
as-is: they come from a different leaderboard, are not model features, and are not joined onto
pitches.

**Consequences.** 209 hitters profiled (was 203). The rebuilt profile has a league-average
fastball-vs-breaking intercept gap of about 11 inches (Savant's sign convention), larger than the
old export's; the ordering (fastball < breaking < offspeed) is the same in both, so the feature
means the same thing. Because the batter features contribute +0.000 / +0.002 AUC (§5), none of
this moves the validation numbers; it makes the deployed model honest about what it uses.

## 10. Release extension + spin axis — tested and left out

All 97 games were re-pulled with the extractor now recording `release_extension`,
`spin_rate`, `spin_axis_deg` and `game_type` (coverage 99.98%+). Side effect worth knowing: MLB
had re-classified **269 pitches (0.93%)** since the Sep 8 pull (mostly CU→KC, FC↔SL, SL↔ST,
FF↔SI) and corrected tracking values on 8; row counts were identical. The current labels are used.

Pre-registered rule: keep the two features only if their paired improvement over FULL clears
the 95% CI on at least one target without a negative point estimate on the other.

| Target | FULL → FULL+EXTRA | 95% CI |
|---|---|---|
| Swing | +0.001 | [−0.002, +0.003] |
| Whiff | +0.003 | [−0.015, +0.020] |

Both within noise → **dropped** from the deployed model. The columns stay in the CSVs and the
rule stays in `train_stage2_model.py`, so a larger dataset can re-test them with no code change.

## Final numbers (date split, prior-only baselines, leak-free profile, re-pulled data)

| | Pitch alone | Pitch + situation | Improvement | After count control |
|---|---|---|---|---|
| Swing vs. take | 0.696 [0.678, 0.714] | 0.756 [0.739, 0.773] | **+0.060 [+0.044, +0.076]** | **+0.050 [+0.037, +0.064]** |
| Whiff vs. contact | 0.655 [0.623, 0.687] | 0.669 [0.637, 0.700] | +0.013 [−0.013, +0.041] (noise) | +0.015 [−0.012, +0.043] (noise) |

Calibration ECE: swing 0.019, whiff 0.024. Mean per-pitch swing "Change" after the fix: 0.000.
