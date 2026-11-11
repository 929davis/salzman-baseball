# Timing IQ audit, fixes and upgrade — report

*Branch `timing-iq-audit`, 2026-11-10. Nothing was merged or pushed to `main`.*

The short version: the **swing/take claim is real and now better supported** — sequencing
improves the model's ranking of swings by **+6.0 points of AUC (95% range +4.4 to +7.6)**, and
still by **+5.0 (+3.7 to +6.4)** after both models are also told the count. The **whiff/contact
claim does not hold at this sample size**: +1.3 points with a range of −1.3 to +4.1, i.e. within
noise. Two of the three "situation" ingredients the page advertised (pitcher release-point drift,
hitter timing profile) contribute nothing measurable in this one week of games; the whole gain is
"what the hitter has already seen in this at-bat". Per-pitch numbers on the live page carried a
+5-point bias that had nothing to do with sequencing; that is fixed and re-uploaded.

Terms used below, in plain English: **AUC** — how often the model ranks a pitch where the event
happened above one where it didn't; 0.5 is a coin flip, 1.0 perfect; it's a ranking score, not a
probability. **Holdout** — games the model never trained on. **Leakage** — a feature that secretly
contains the future or the holdout. **95% CI (bootstrap)** — re-sample the holdout pitches 2,000
times and keep the middle 95% of results; if an improvement's range includes 0 it is "within
noise". **Paired** — both models scored on the same resamples, so the range is for the difference.
**Calibration / ECE** — whether a displayed 70% really swings ~70% of the time; ECE is the average
gap in points. **SHAP** — splits one prediction into pushes from each feature.

---

## 1. Before / after validation numbers

All AUC, with 95% bootstrap CI in brackets. "Before" is the committed script re-run today on the
committed data (the page's hard-coded numbers were 0.693/0.735 and 0.656/0.679; the whiff-alone
number did not reproduce — see §4).

| | Before (game_pk split, train-wide baselines) | After (date split, prior-only baselines, leak-free profile) |
|---|---|---|
| **Swing — pitch alone** | 0.691 | 0.696 [0.678, 0.714] |
| **Swing — pitch + situation** | 0.733 | 0.756 [0.739, 0.773] |
| **Swing — improvement** | +0.042 (no CI) | **+0.060 [+0.044, +0.076]** — reliable |
| **Swing — improvement after count control** | not measured | **+0.050 [+0.037, +0.064]** — reliable |
| **Whiff — pitch alone** | 0.671 | 0.655 [0.623, 0.687] |
| **Whiff — pitch + situation** | 0.679 | 0.669 [0.637, 0.700] |
| **Whiff — improvement** | +0.008 (no CI) | +0.013 [−0.013, +0.041] — **within noise** |
| **Whiff — after count control** | not measured | +0.015 [−0.012, +0.043] — **within noise** |

Where the swing improvement comes from (paired increments): sequence-within-at-bat **+0.061
[+0.046, +0.076]**; pitcher release-point baseline −0.001 [−0.006, +0.005]; hitter timing profile
−0.001 [−0.003, +0.002]; release extension + spin axis +0.001 [−0.002, +0.003]. Count alone adds
+0.030 [+0.018, +0.043] to pitch shape — so roughly a sixth of the raw lift was count showing
through, and five-sixths survives.

Calibration (holdout, final model): swing ECE 0.019, whiff ECE 0.024 — displayed probabilities are
within about 2 points of reality on average; no systematic over-confidence beyond bins with fewer
than a dozen pitches.

Data: 97 regular-season games, Aug 31–Sep 6 2026, 28,699 pitches (21,301 with pitch ≥ 2), 442
pitchers, 418 hitters. Train: 82 games (Aug 31–Sep 5). Holdout: the 15 games of Sep 6.

## 2. Every change, by file

**New**
- `scripts/timing_iq_common.py` — single loader, feature lists, date-based split, prior-pitch-only
  baselines, bootstrap/calibration helpers. Refuses non-regular-season rows.
- `scripts/backup_pitch_scores.mjs` — pages the live table, writes a gzipped CSV, verifies read-back.
- `backups/pitch_sequence_scores_2026-11-11T03-12-15.csv.gz` — the pre-change live table
  (28,699 rows, 37 columns).
- `scripts/repull-games.mjs` — re-extracts every game on disk, reports per-game row-count changes.
- `scripts/fetch-swing-path-exports.mjs` — downloads the Savant swing-path exports with a
  recorded date window and Savant's own pitch groups; writes `data/swing-path/export_manifest.json`.
- `lib/timing-iq-metrics.json` — written by training, read by the UI.
- `audit/timing-iq-audit.md` — findings, ranked, with all numbers.
- `docs/release-point-from-video.md` — the Step 3 design note.
- `docs/timing-iq-report.md` — this file.

**Changed**
- `scripts/lib/extractGamePitches.mjs` — records `game_type`, `release_extension`, `spin_rate`,
  `spin_axis_deg` from the MLB live feed.
- `scripts/train_stage1_model.py` — uses the shared module; date split; prints a CI.
- `scripts/train_stage2_model.py` — nested models including count-controlled ones, paired CIs on
  every improvement, calibration, pre-registered keep/drop rule for the extra features, batter
  profile included only if its manifest proves the window ends before the first game; writes the
  metrics JSON.
- `scripts/score_all_pitches.py` — Stage 1 fit on the same population as Stage 2 (first pitches get
  their own Stage 1); prior-only baselines; deployed features read from the JSON; "Why" wording
  fixed; asserts before writing.
- `scripts/upload_pitch_scores.mjs` — upsert in place, delete only stale keys, refuse on failed
  checks, verify final count and anon readability.
- `app/components/TimingIQTool.tsx` — validation panel built from the JSON (metric named, CIs,
  Reliable/Within-noise badges, count-controlled row, source of the gain, calibration, data
  window); explainer text corrected; error state instead of infinite "Loading"; 42 lint errors → 0.

**Live data**
- `pitch_sequence_scores` re-uploaded: 28,699 rows, 0 stale, all sanity checks passed, anon key
  sees all rows. Independent re-read with the anon key: mean swing Change −0.0000 (was +0.051),
  no first pitch carries a Stage 2 number.

**Local data (gitignored)**
- `data/pitch-sequencing/*.csv` re-pulled twice (new columns, then new profile). Old files kept at
  `data/pitch-sequencing-backup-20261110-191204/`.
- `data/swing-path/` six category CSVs replaced; old files at `data/swing-path-backup-20261110-193026/`.

## 3. Commits (oldest first)

1. `a8fa8c0` Back up the live pitch_sequence_scores table before the Timing IQ audit
2. `b5ad959` Timing IQ: shared module, date-based holdout, prior-pitch-only baselines, extra feed columns
3. `62d58fd` Timing IQ UI reads validation metrics from JSON; leak-free batter profile fetcher
4. `833920e` Timing IQ: population-matched scoring, safe idempotent upload, final metrics, audit, design note
5. (final commit) Add the Timing IQ audit report — this file

## 4. Judgment calls, and why

- **The holdout is the whole last day (Sep 6), not "15% by game_pk".** The old split's docstring
  claimed a time split it didn't do. A day-based split is the only one where nothing in training
  is after anything in the holdout. It happens to be exactly 15 games again.
- **Pitcher baselines use only pitches thrown before each pitch, and need 10 of them (was 3).**
  Chosen on statistical grounds before seeing results (3 pitches give a mean as noisy as the drift
  being measured). Cost: a drift number exists for 29% of pitch ≥ 2 rows instead of 70%. The n=3
  sensitivity run is in the audit; the AUC is the same either way because the feature adds
  nothing measurable.
- **Stage 1 is now fit per population.** "Change" must compare two models with the same base
  rate or it measures the base rate. First pitches therefore have their own Stage 1 model.
- **The batter profile was rebuilt rather than dropped.** The original Sep 7 exports could not be
  reproduced from any Savant pitch type or group (unrecorded filters), and they contained
  holdout-week swings. Rebuilt with Savant's groups and a hard window ending Aug 30, recorded in a
  manifest that training checks. Because the feature contributes ~0, this choice changes nothing
  numerically; it makes the model honest.
- **MLB's current pitch labels were used.** The re-pull found 269 pitches (0.9%) re-classified
  since September. Using corrected data is the conservative choice; the before/after comparison
  in §1 is therefore not on byte-identical inputs (the "before" row is the old data).
- **Extension + spin axis were kept out of the model** by a rule written before the numbers were
  seen (CI must clear zero on one target, not hurt the other). Both landed within noise. The
  columns remain in the data for a larger re-test.
- **Count is reported as a control, not added to the deployed model.** The tool's story is about
  sequence; adding count to production would change what "Pitch + Situation" means to users. The
  count-controlled improvement is shown on the page instead.
- **The whiff claim is re-worded, not removed.** The page now says the whiff improvement is within
  noise and explains what that means; the per-pitch whiff numbers still display (they are
  calibrated), just without the claim that sequencing improves them.
- **Backup is gzipped** (2.1 MB instead of ~11 MB) to keep the repo small; `gunzip` restores it.
- **Not tuned:** no hyperparameters, feature sets, thresholds or split fractions were changed after
  seeing holdout results, other than following the pre-registered extra-feature rule.

## 5. Not done, or failed

- **Batting-stance exports were not refreshed** (the stance leaderboard CSV URL returned 404). They
  are not model features and are not joined onto pitches, so this has no effect on the model.
- **The original Sep 7 Savant filter settings remain unknown.** Documented in audit §9.
- **Calibration was measured, not corrected.** ECE of ~0.02 did not justify adding a calibration
  layer.
- **Repo-wide lint still reports 409 errors**, all in files this branch does not touch
  (`app/coach/page.tsx` 91, `EffectiveVelocityTool.tsx` 71, …, and 15 from eslint crawling
  `.venv`). The one file touched here went 42 → 0. Pre-existing warning about `supabase` in a
  `useEffect` dependency array left as-is (it is the pattern used across the app).
- **Dataset size is the real limitation.** One week of games cannot show whether release-point
  drift or hitter profiles matter; it can only say they didn't show up here. That is reported as
  such, not as "they don't work".

## 6. Verification run on the branch

- `npx tsc --noEmit`: passes.
- `npm test`: 80/80 pass.
- `npx eslint app/components/TimingIQTool.tsx`: 0 errors, 1 pre-existing-pattern warning.
- `npm run build`: passes (exit 0).
- Upload sanity checks: row count match, no null Stage 1, probabilities in [0, 1], Stage 2 present
  on every pitch ≥ 2 and absent on every first pitch, unique keys, final count = CSV, anon-readable.

## 7. What this means for the public claim (for athletes and parents)

> Timing IQ looks at thousands of big-league pitches and asks a simple question: once you know
> what the hitter has already seen earlier in the at-bat, do you predict his swing better than
> from the pitch's own speed and movement alone? The answer, measured on games the model never
> trained on, is yes — reliably, and still yes when you also account for the count. That is real
> evidence that sequencing changes how a pitch is read. What we can't yet claim is that sequencing
> makes hitters *miss* more often; with the data we have so far that difference is too small to
> separate from chance, so we don't say it. And the effect we do see comes from what the hitter has
> already seen in the at-bat — not, so far, from a pitcher's release-point drift or from a hitter's
> individual timing profile. We'll keep measuring as more games come in, and the page shows the
> numbers and their uncertainty rather than a verdict.

## 8. How to review and merge

1. `git fetch && git checkout timing-iq-audit`
2. Read `audit/timing-iq-audit.md` (findings) and skim `git log --oneline main..timing-iq-audit`.
3. `npm run dev`, open the Pitching IQ tab → Timing IQ. Check the Model Validation panel reads
   from the JSON (numbers match §1), the whiff row says "Within noise", and the "Why" column reads
   "raised/lowered the … read".
4. Optional re-run from scratch (about 5 minutes): `./.venv/bin/python scripts/train_stage2_model.py`
   then `./.venv/bin/python scripts/score_all_pitches.py` then
   `node --env-file=.env.local scripts/upload_pitch_scores.mjs --dry-run`.
5. When satisfied: `git checkout main && git merge --no-ff timing-iq-audit && git push origin main`
   (the push deploys). The live table is already updated, so the deploy only changes the UI.
6. To roll the data back if ever needed: `gunzip -k backups/pitch_sequence_scores_2026-11-11T03-12-15.csv.gz`
   and load it with the upload script's row shape.

**One housekeeping note:** before this task started there was an uncommitted edit on `main`
(the mechanics-tab upload box `minHeight` fix from earlier today). It is saved as a git stash:
`git stash list` shows it as "mechanics upload box minHeight fix …". On `main`, `git stash pop`
restores it.
