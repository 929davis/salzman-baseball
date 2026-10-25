# Principles Sections Audit

Read-only. No file, table, or policy was modified, created, deleted, or migrated. One
temporary read-only query script was run from outside this repo (in a scratchpad directory)
to pull `principles_sections` via the service key — `select` only, nothing written.

**Date:** 2026-10-11. **Live table state captured at query time** — if anyone edits
`principles_sections` after this audit runs, the numbers below will no longer match.

---

## 0. A methodological problem that affects Section 2 — read this first

The task names two spec files: `salzman_strength_conditioning_principles.md` and
`salzman_throwing_principles.md`. **Neither exists anywhere in this repository**, and
`/mnt/user-data/outputs` does not exist in this environment (confirmed: `ls` fails). The
closest candidate is `docs/salzman-baseball-principles.md` (1,407 lines, covers both
`[strength]` and `[throwing]` sections) — but that file was **added in the same commit**
(`d5b7da0`, 2026-09-27, "Send the full principles document every prompt, fix real bugs a live
test run surfaced") that *also* changed `principles_sections`' content (that commit's own
message describes fixing §14.3's phase-routing default and `GATE_LABELS` text — changes to
the table, in the same commit that added this "spec" file). There is no generating script
referencing this filename anywhere in the repo (`grep` found zero hits).

This means `docs/salzman-baseball-principles.md` reads much more like **a snapshot export of
the table taken at that commit**, not an independently authored document that predates and
governs the table. Comparing the live table against it is comparing the table against a
recent picture of itself, not against an original specification.

**Section 2 below is run anyway and reports a real result (zero material differences across
all 80 sections)** — but that result should be read as "the table hasn't drifted from its own
September 27 snapshot," not "the table matches the original governing spec." If a true
original spec exists outside this repo, it needs to be supplied for the comparison the task
actually asked for.

What I *can* and did verify independently of this provenance problem: the specific named
superseded-content patterns (3 oz/7 oz, Olympic lifts, broad-jump-as-predictor, plyo balls,
%1RM-as-primary) checked directly against the live table text itself, regardless of what
`docs/salzman-baseball-principles.md` says. Those results are in Section 2b and are solid.

---

## 1. Live table state

**Total rows: 80.** Per doc: `strength` 40, `throwing` 40.

**Every row** (doc | section_number | title | engine | always | tags | sort | body length):

```
strength | 1.1    | Movement analysis of pitching                                          | engine=false | always=false | tags=[background]                        | sort=10   | len=1176
strength | 1.2    | The two functional columns                                             | engine=true  | always=false | tags=[background]                        | sort=20   | len=2542
strength | 1.3    | Physiological analysis — ranked for pitching                           | engine=true  | always=false | tags=[background]                        | sort=30   | len=1309
strength | 1.4    | Energy system analysis                                                 | engine=false | always=false | tags=[conditioning]                      | sort=40   | len=2102
strength | 2.2    | Benchmarks                                                             | engine=false | always=true  | tags=[testing]                           | sort=80   | len=2770
strength | 2.3    | Countermovement jump — the full model                                  | engine=true  | always=false | tags=[testing]                           | sort=90   | len=5240
strength | 3.1    | Training status                                                        | engine=false | always=true  | tags=[athlete_setup]                     | sort=140  | len=536
strength | 3.2    | Equipment tier                                                         | engine=true  | always=true  | tags=[athlete_setup]                     | sort=150  | len=733
strength | 3.3    | Readiness gates                                                        | engine=true  | always=true  | tags=[athlete_setup]                     | sort=160  | len=1531
strength | 4.1    | Prescription language: RPE first                                      | engine=false | always=false | tags=[lifting]                           | sort=170  | len=335
strength | 4.2    | The load table                                                         | engine=true  | always=true  | tags=[lifting]                           | sort=180  | len=928
strength | 4.3    | Load by exercise class                                                | engine=true  | always=true  | tags=[lifting]                           | sort=190  | len=589
strength | 4.4    | Olympic lifts — removed                                                | engine=false | always=false | tags=[lifting]                           | sort=200  | len=677
strength | 4.5    | Exercise selection and order                                           | engine=true  | always=true  | tags=[lifting]                           | sort=210  | len=1214
strength | 4.6    | Frequency — the CNS budget                                            | engine=true  | always=true  | tags=[lifting]                           | sort=220  | len=977
strength | 4.7    | One primary quality per phase                                          | engine=true  | always=true  | tags=[lifting]                           | sort=230  | len=405
strength | 4.8    | Progression, deload, and regression                                   | engine=true  | always=true  | tags=[deload]                            | sort=240  | len=1824
strength | 5.2    | The governing theory                                                   | engine=true  | always=true  | tags=[background]                        | sort=260  | len=1384
strength | 5.3    | The college baseball annual plan                                       | engine=true  | always=false | tags=[calendar,off_season]               | sort=270  | len=1301
strength | 5.4    | Phase prescriptions                                                    | engine=true  | always=false | tags=[off_season]                        | sort=280  | len=644
strength | 5.5    | Non-linear structure for advanced athletes                            | engine=true  | always=false | tags=[off_season]                        | sort=290  | len=479
strength | 6.1    | Eccentric training                                                    | engine=true  | always=true  | tags=[lifting]                           | sort=310  | len=1217
strength | 6.2    | Isometric training                                                    | engine=true  | always=true  | tags=[lifting]                           | sort=320  | len=1036
strength | 6.3    | Ballistic training                                                    | engine=true  | always=true  | tags=[lifting]                           | sort=330  | len=460
strength | 6.4    | Plyometric training                                                   | engine=true  | always=true  | tags=[lifting]                           | sort=340  | len=1369
strength | 6.5    | KEAT and shock training                                               | engine=true  | always=false | tags=[lifting,off_season]                | sort=350  | len=2054
strength | 6.6    | Weighted implement throwing                                           | engine=true  | always=true  | tags=[off_season,throwing,velocity_block]| sort=360  | len=1715
strength | 6.7    | Rotational work                                                        | engine=true  | always=true  | tags=[lifting]                           | sort=370  | len=839
strength | 7.1    | Prescription by energy system                                         | engine=true  | always=true  | tags=[conditioning]                      | sort=380  | len=1413
strength | 7.2    | Seasonal conditioning                                                 | engine=false | always=true  | tags=[conditioning]                      | sort=390  | len=282
strength | 8.1    | The governing principle                                               | engine=false | always=true  | tags=[recovery]                          | sort=400  | len=307
strength | 8.3    | Recovery modalities                                                   | engine=false | always=true  | tags=[recovery]                          | sort=420  | len=157
strength | 9.1    | Template structure                                                    | engine=true  | always=true  | tags=[templates]                         | sort=440  | len=1300
strength | 9.2    | Movement category library                                            | engine=false | always=true  | tags=[lifting,templates]                 | sort=450  | len=1987
strength | 9.3    | Off-season week — general preparatory                                | engine=false | always=false | tags=[off_season,templates]              | sort=460  | len=596
strength | 9.4    | Off-season week — specific preparatory                               | engine=false | always=false | tags=[off_season,templates]              | sort=470  | len=543
strength | 9.5    | Off-season week — first transition (power / KEAT block)              | engine=false | always=false | tags=[off_season,templates]              | sort=480  | len=790
strength | 9.6    | In-season week — athlete with a team lift (starter)                  | engine=false | always=false | tags=[in_season,templates]               | sort=490  | len=1100
strength | 9.7    | In-season week — athlete with no team lift (starter)                 | engine=false | always=false | tags=[in_season,templates]               | sort=500  | len=544
strength | 9.8    | Deload week                                                           | engine=false | always=false | tags=[deload,templates]                  | sort=510  | len=451
throwing | 10.1   | Delivery phases                                                       | engine=false | always=true  | tags=[background]                        | sort=520  | len=1803
throwing | 10.2   | What is trainable and what is individual                             | engine=true  | always=false | tags=[movement_change]                   | sort=530  | len=1304
throwing | 12.1   | Intent scale                                                          | engine=true  | always=true  | tags=[athlete_setup,throwing]             | sort=580  | len=844
throwing | 12.1a  | What reduced effort actually delivers — and why it changes volume math| engine=false | always=true  | tags=[athlete_setup]                     | sort=590  | len=1729
throwing | 12.2   | Throwing status                                                       | engine=false | always=true  | tags=[athlete_setup,throwing]             | sort=600  | len=274
throwing | 12.3   | Gates — what has to be true before a guy is allowed to do something   | engine=true  | always=true  | tags=[athlete_setup,throwing]             | sort=610  | len=1150
throwing | 13.5   | The four stages of a change                                           | engine=true  | always=false | tags=[movement_change]                   | sort=660  | len=2241
throwing | 13.8   | Intent and movement change                                           | engine=true  | always=false | tags=[movement_change]                   | sort=690  | len=636
throwing | 14.1   | Direction and structure                                              | engine=false | always=false | tags=[throwing]                          | sort=720  | len=485
throwing | 14.2   | The phases are layers, not a ladder                                  | engine=true  | always=true  | tags=[movement_change,throwing]          | sort=730  | len=6360
throwing | 14.3   | Problem-based routing                                                | engine=true  | always=true  | tags=[throwing]                          | sort=740  | len=995
throwing | 14.4   | Session flow                                                         | engine=false | always=true  | tags=[throwing]                          | sort=750  | len=300
throwing | 14.5   | Long toss                                                            | engine=true  | always=true  | tags=[throwing]                          | sort=760  | len=883
throwing | 14.6   | Velocity development — what actually drives it                      | engine=true  | always=true  | tags=[off_season,throwing,velocity_block]| sort=770  | len=1292
throwing | 14.7   | Constrained positions do not reduce arm stress                      | engine=true  | always=true  | tags=[throwing]                          | sort=780  | len=1509
throwing | 14.8   | Dry reps                                                             | engine=true  | always=true  | tags=[throwing]                          | sort=790  | len=917
throwing | 14.9   | Med ball work in the throwing program                               | engine=true  | always=true  | tags=[throwing]                          | sort=800  | len=751
throwing | 14.10  | Prescribing velocity work intelligently                             | engine=true  | always=true  | tags=[off_season,throwing,velocity_block]| sort=810  | len=1894
throwing | 15.1   | The variables                                                        | engine=false | always=true  | tags=[throwing]                          | sort=820  | len=301
throwing | 15.2   | Arm load accounting                                                  | engine=true  | always=true  | tags=[throwing]                          | sort=830  | len=670
throwing | 15.2a  | Where the weekly budget comes from — and why it isn't a number      | engine=false | always=true  | tags=[throwing]                          | sort=840  | len=2338
throwing | 15.3   | Intent distribution                                                  | engine=false | always=true  | tags=[throwing]                          | sort=850  | len=255
throwing | 15.4   | Distance                                                             | engine=false | always=true  | tags=[throwing]                          | sort=860  | len=289
throwing | 15.5   | Frequency and recovery interval                                      | engine=false | always=true  | tags=[throwing]                          | sort=870  | len=575
throwing | 15.5a  | Where high-intent long toss goes                                    | engine=true  | always=true  | tags=[throwing]                          | sort=880  | len=1181
throwing | 16.1   | Annual structure                                                     | engine=true  | always=true  | tags=[calendar,off_season]               | sort=890  | len=1478
throwing | 16.2   | The shutdown is not optional                                        | engine=false | always=true  | tags=[calendar]                          | sort=900  | len=287
throwing | 17.2   | Red flags — stop throwing                                           | engine=true  | always=true  | tags=[arm_care,diagnostics]              | sort=940  | len=586
throwing | 17.3   | The soreness distinction                                            | engine=false | always=true  | tags=[arm_care,diagnostics]              | sort=950  | len=616
throwing | 18.1   | The graded exposure model                                           | engine=false | always=false | tags=[return_to_throw]                   | sort=960  | len=876
throwing | 18.2   | The four phases                                                     | engine=false | always=false | tags=[return_to_throw]                   | sort=970  | len=899
throwing | 18.3   | Why effort percentages cannot control the dose                     | engine=true  | always=false | tags=[return_to_throw]                   | sort=980  | len=1281
throwing | 18.4   | Parasympathetic pairing — methods                                  | engine=false | always=false | tags=[return_to_throw]                   | sort=990  | len=1473
throwing | 18.5   | Reintegration with the rest of the system                          | engine=false | always=false | tags=[return_to_throw]                   | sort=1000 | len=474
throwing | 19.1   | Structure                                                           | engine=true  | always=true  | tags=[templates]                         | sort=1010 | len=957
throwing | 19.2   | Movement block session — off-season                                | engine=false | always=true  | tags=[off_season,templates]              | sort=1020 | len=535
throwing | 19.3   | Mixed practice session — off-season                                | engine=false | always=true  | tags=[off_season,templates]              | sort=1030 | len=500
throwing | 19.4   | Velocity session — first transition only                           | engine=false | always=true  | tags=[off_season,templates,velocity_block]| sort=1040 | len=588
throwing | 19.5   | In-season week — starter                                            | engine=false | always=true  | tags=[in_season,templates]               | sort=1050 | len=530
throwing | 19.6   | Restricted session — §18 Retraining phase                           | engine=false | always=true  | tags=[return_to_throw,templates]         | sort=1060 | len=681
```

**Character totals:**
- Sum of `length(body)`, all 80 rows: **89,593**
- Sum of `length(body)`, `always_include=true` rows only: **58,041** (54 of 80 rows)

**Rows with empty `tags` AND `always_include=false`:** none. Every row has at least one tag
or is already `always_include=true`.

**Duplicate `section_number` within a doc:** none.

**Section numbers in the spec file but missing from the table:** none.
**Section numbers in the table but missing from the spec file:** none.
(Both lists are identical — see Section 0's caveat about why this zero-diff result doesn't
mean what it would normally mean.)

**One number worth flagging here even though it's a clean match between table and spec:**
section **13.7 does not exist in either source.** The task's own seed list of
`always_include` sections (Section 3 below) includes `13.7`. The table has `13.5` and `13.8`
but nothing at `13.6` or `13.7` — either this section was deleted/renumbered at some point
after that seed list was written, or the seed list itself contains a stale reference. Either
way, `13.7` is not a row that can currently be marked anything, because it doesn't exist.

---

## 2. Spec vs. table: content drift

### 2a. Section-by-section body comparison

**Zero of 80 sections show a material (non-whitespace) difference** between the table's
`body` column and `docs/salzman-baseball-principles.md`'s corresponding section text. Every
section's content is byte-identical (after normalizing whitespace).

**Read this together with Section 0.** This is not evidence the table matches an original,
independently-maintained specification — it's evidence the table matches a snapshot taken of
itself on 2026-09-27. If the real governing spec documents exist somewhere outside this repo,
this comparison needs to be re-run against those, not against this file.

### 2b. Specific superseded-content patterns (checked directly against the live table's text, independent of the provenance problem above)

- **§8.4 foot-pounds arm-care formula:** not found anywhere. No row, and no part of
  `docs/salzman-baseball-principles.md`, contains "foot-pound," "ft-lb," or "ft.lb." There is
  no `§8.4` at all — the table jumps from `8.3` straight to `9.1`. **Clean** — this appears to
  already be correctly and completely retired, not just reworded.
- **3 oz / 7 oz weighted-ball protocol:** the live text (§6.6, "Weighted implement throwing")
  explicitly supersedes this: *"This replaces the 3 oz / 7 oz protocol carried in the Hacking
  the Kinetic Chain working notes... Any template referencing 3 oz or 7 oz implements is out
  of date and should be rebuilt against this section."* The current protocol throughout is
  consistently 4/5/6 oz (±20% of a regulation 5 oz baseball), referenced consistently across
  §6.6, §9.5/9.6 week templates, §14.6, §14.10, and §16.1's annual-plan table. **Clean** —
  already correctly updated, with an explicit supersession notice.
- **Olympic lifts:** §4.4 is titled *"Olympic lifts — removed"* and states plainly: *"Traditional
  Olympic lifts (snatch, clean, jerk and derivatives) are out of this system, replaced by
  weighted jump variants."* §6.5 ("KEAT and shock training") separately explains *why* they
  were removed (loses the catch-phase force-absorption training; KEAT trains that more
  directly). No other section prescribes an Olympic lift as active programming. **Clean.**
- **Broad jump as a velocity predictor:** "Broad jump" appears exactly twice outside §2.2's
  benchmark table — both as one listed exercise option among several in a "Horizontal power"
  training-category table (§4.5, §6.1), never singled out as predicting pitch velocity. The
  section that actually discusses predicting velocity from jump data (§2.3, "On predicting
  velocity from jump data") explicitly instructs: *"Do not display a predicted velocity
  number"* and lists its own candidate multi-predictor inputs (CMJ height, RSImod, rotational
  med ball throw distance, body mass, standing height, F0, V0) — broad jump is not among them,
  and no claim that broad jump alone predicts velocity exists anywhere in the live text.
  **Clean.**
- **"Plyo balls" as an implement:** §6.6 states directly: *"Implements — 5 oz standard, no plyo
  balls."* The only other mention of "plyo balls" (§3.2, Equipment tier) is in a list of
  available training equipment types for the lowest equipment tier (E3) — a different meaning
  (equipment on hand), not a weighted-ball-implement recommendation. **Clean.**
- **%1RM as primary load language instead of RPE:** §4.1 is titled *"Prescription language: RPE
  first."* The one place a %1RM figure appears in a prescription table (§4.2, "The load
  table") is explicitly labeled a **"(reference)"** column next to the primary RPE/RIR/reps/sets
  columns — not the primary instruction. No section anywhere instructs prescribing by %1RM as
  the main load language. **Clean.**

**Net result for Section 2b: all five named superseded-content patterns are already correctly
retired/updated in the live text, with no stale remnants found.** This is true regardless of
the Section 0 provenance caveat, since it's a direct text search against the live table, not
a diff against the suspect "spec" file.

---

## 3. Flag consistency

### `is_engine_rule` vs. ⚙-marked content

**35 of 80 rows (44%) are inconsistent** between `is_engine_rule` and whether the row's body
actually contains a `⚙` marker:

- **33 rows** have `is_engine_rule=true` but **no `⚙` anywhere in the body.**
- **2 rows** have `is_engine_rule=false` but the body **does** contain a `⚙`: `strength::2.2`
  ("Benchmarks" — contains the "Back-calculation ⚙" sub-rule) and `throwing::12.1a` ("What
  reduced effort actually delivers").

The 33-row direction dominates heavily: `is_engine_rule` has been set far more broadly than
the literal ⚙-marking scheme in the spec text would justify. Full list of mismatched rows:

```
strength::1.3   is_engine_rule=true,  no ⚙         strength::3.2   is_engine_rule=true,  no ⚙
strength::3.3   is_engine_rule=true,  no ⚙         strength::4.2   is_engine_rule=true,  no ⚙
strength::4.3   is_engine_rule=true,  no ⚙         strength::4.5   is_engine_rule=true,  no ⚙
strength::4.6   is_engine_rule=true,  no ⚙         strength::4.7   is_engine_rule=true,  no ⚙
strength::5.2   is_engine_rule=true,  no ⚙         strength::5.3   is_engine_rule=true,  no ⚙
strength::5.4   is_engine_rule=true,  no ⚙         strength::6.1   is_engine_rule=true,  no ⚙
strength::6.2   is_engine_rule=true,  no ⚙         strength::6.3   is_engine_rule=true,  no ⚙
strength::6.4   is_engine_rule=true,  no ⚙         strength::6.6   is_engine_rule=true,  no ⚙
strength::6.7   is_engine_rule=true,  no ⚙         strength::7.1   is_engine_rule=true,  no ⚙
strength::2.2   is_engine_rule=false, HAS ⚙        throwing::10.2  is_engine_rule=true,  no ⚙
throwing::12.1  is_engine_rule=true,  no ⚙         throwing::12.1a is_engine_rule=false, HAS ⚙
throwing::12.3  is_engine_rule=true,  no ⚙         throwing::13.5  is_engine_rule=true,  no ⚙
throwing::13.8  is_engine_rule=true,  no ⚙         throwing::14.3  is_engine_rule=true,  no ⚙
throwing::14.5  is_engine_rule=true,  no ⚙         throwing::14.6  is_engine_rule=true,  no ⚙
throwing::14.8  is_engine_rule=true,  no ⚙         throwing::14.9  is_engine_rule=true,  no ⚙
throwing::15.2  is_engine_rule=true,  no ⚙         throwing::15.5a is_engine_rule=true,  no ⚙
throwing::16.1  is_engine_rule=true,  no ⚙         throwing::17.2  is_engine_rule=true,  no ⚙
throwing::18.3  is_engine_rule=true,  no ⚙
```

A likely, non-malicious explanation: `⚙` marks a specific *sub-section rule* within a section's
body text (e.g. "Back-calculation ⚙:" is one paragraph inside §2.2, which otherwise discusses
many non-engine-rule things). `is_engine_rule` is a whole-section boolean. The two granularities
can't be made to agree in general — a section can clearly contain a real, important rule the
coach wants flagged without every sentence in it being that rule. This audit doesn't take a
position on which rows are "wrong"; it only reports that the literal rule stated in the task
("`is_engine_rule` should be true only for ⚙-marked spec sections") does not hold for 35 rows.

### `always_include` vs. the 15-section seed list

The task's seed list: `4.2, 4.3, 4.6, 4.8, 3.1, 3.2, 3.3, 12.1, 12.1a, 12.2, 12.3, 13.7, 15.2,
15.2a, 14.7` (15 sections).

**Live table: 54 rows have `always_include=true`** — 3.6× the seed list's size.

- **In the seed list but NOT `always_include=true` in the live table:** `13.7` — because, per
  Section 1 above, this section does not exist in the table at all. Every other seed-list
  entry (14 of 15) is correctly `always_include=true`.
- **`always_include=true` in the table but NOT in the seed list** (40 rows):
  `2.2, 4.5, 4.7, 5.2, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 7.1, 7.2, 8.1, 8.3, 9.1, 9.2, 10.1, 14.2,
  14.3, 14.4, 14.5, 14.6, 14.8, 14.9, 14.10, 15.1, 15.3, 15.4, 15.5, 15.5a, 16.1, 16.2, 17.2,
  17.3, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6`

This is a precise, quantified confirmation of exactly the drift `lib/principlesSections.ts`'s
own header comment already describes in prose: the `always_include` subset grew from the
original 15-section design to 54 rows ("56,466 chars... after a later review"), which is the
documented reason the character-budget selection mechanism kept silently dropping all
situational content. The number 56,466 mentioned in that comment is close to but not identical
to this audit's measured 58,041 — consistent with at least one more row being flipped to
`always_include=true` since that comment was written, not a contradiction.

### Is `is_engine_rule` used as a prompt-inclusion signal anywhere in code?

**No.** `grep -rn "is_engine_rule" lib/ app/` returns exactly two kinds of hits:
1. `lib/principlesSections.ts` — only as a type field (`is_engine_rule: boolean`) and inside a
   comment describing *historical* behavior (the now-removed selection logic).
2. `app/components/PrinciplesSectionsEditor.tsx` — only as UI display/edit (a checkbox, and a
   badge rendered when true).

**There is no selection or filtering logic anywhere that reads `is_engine_rule` (or
`always_include`) to decide what goes into a prompt** — confirmed directly against
`buildPrompt` (Section 4 below), which calls `bundleAllPrinciples(sections)` on the *entire*
unfiltered row set. This is the literal, current truth: the rule the task asks to verify
("no row should set `is_engine_rule` as a prompt-inclusion signal") **holds.**

**However, one real inconsistency exists in the UI, not the selection logic:**
`PrinciplesSectionsEditor.tsx:177` renders the "Engine Rule" badge with the tooltip text
`title="Always included in the program-writing prompt"`. That description is now **false** —
every section is always included regardless of `is_engine_rule`, since the selective-inclusion
mechanism this tooltip describes was removed in commit `d5b7da0`. This is stale UI copy left
over from before that change, not a functional bug, but it actively misinforms anyone editing
sections in that tab about what the flag actually does today.

---

## 4. Prompt path

### `selectPrinciplesSections` — does not exist

**This function was removed.** `grep -rn "selectPrinciplesSections" lib/ app/` returns zero
hits anywhere in the current codebase. It existed historically (referenced only in a comment
in `lib/principlesSections.ts` describing what it used to do) and was deleted in commit
`d5b7da0`.

### What replaced it — shown in full

`lib/principlesSections.ts` (current, full file):

```ts
export type PrinciplesSection = {
  id: string
  doc: string
  section_number: string
  title: string
  body: string
  is_engine_rule: boolean
  always_include: boolean
  tags: string[]
  sort_order: number
  updated_at: string | null
}

export const PRINCIPLES_SANITY_CEILING = 150000

export type PrinciplesBundle = {
  sections: PrinciplesSection[]
  totalChars: number
}

export function bundleAllPrinciples(sections: PrinciplesSection[]): PrinciplesBundle {
  const sorted = [...sections].sort((a, b) => a.sort_order - b.sort_order)
  const totalChars = sorted.reduce((sum, s) => sum + s.body.length, 0)
  if (totalChars > PRINCIPLES_SANITY_CEILING) {
    console.warn(`[principlesSections] full document is ${totalChars.toLocaleString()} chars, above the ${PRINCIPLES_SANITY_CEILING.toLocaleString()}-char sanity ceiling -- consider trimming.`)
  }
  return { sections: sorted, totalChars }
}

export function formatPrinciplesForPrompt(bundle: PrinciplesBundle): string {
  return bundle.sections
    .map(s => `### [${s.doc}] ${s.section_number} — ${s.title}\n${s.body}`)
    .join('\n\n')
}

export function summarizePrinciples(bundle: PrinciplesBundle): string {
  return `${bundle.sections.length} section(s) sent (full document), ~${bundle.totalChars.toLocaleString()} chars`
}
```

`bundleAllPrinciples` takes every row, unconditionally, sorted by `sort_order`. It has **no
athlete-state parameter, no tag filter, and no budget that drops anything** —
`PRINCIPLES_SANITY_CEILING` only triggers a `console.warn`, never removes a section.

### `contextTags` — does not exist

**This computation was also removed.** `grep -rn "contextTags" lib/ app/` returns zero hits.
There is no tag-based context computation anywhere in the current code. The closest
surviving mechanism is `computeAthleteConstraints` (`lib/engine/athleteConstraints.ts`),
which is architecturally unrelated — it builds a separate `COMPUTED CONSTRAINTS` text block
from `athlete_state`/`throw_log`/`cmj_results`/the exercise library, and that block is spliced
into the prompt *alongside* the full, unfiltered principles document — it does not filter or
select which principles sections appear.

### `buildPrompt`'s relevant excerpt, shown in full (the part that touches principles selection)

From `app/coach/page.tsx`, inside `buildPrompt` (lines 1068–1116, reproduced verbatim):

```ts
    // Full principles document, every section, every time -- no tag-based selection or char
    // budget. The doc is ~88,000 chars, comfortably within any modern model's context window,
    // and selective inclusion produced the same silent-drop bug twice (most recently 56,466
    // always-included chars against a 40,000 budget, meaning zero situational sections could
    // ever fit). The computed constraints block above already tells the AI which parts of the
    // document apply to this athlete right now -- it doesn't need sections pre-filtered on its
    // behalf. Fetched fresh at click-time (not from page-level state) so an edit made moments
    // ago in the Principles tab is guaranteed to be reflected here.
    const {data:sectionRows}=await supabase.from('principles_sections').select('*')
    const sections=(sectionRows||[]) as PrinciplesSection[]
    const bundle=bundleAllPrinciples(sections)
    const principlesBlock=formatPrinciplesForPrompt(bundle)

    console.log('[buildPrompt] principles sections sent:',bundle.sections.length,'~',bundle.totalChars,'chars')
    console.log('[buildPrompt] computed constraints:',constraints)
    setPromptSectionSummary(summarizePrinciples(bundle))

    ...

TRAINING PRINCIPLES (${bundle.sections.length} section(s), ~${bundle.totalChars.toLocaleString()} chars):
${principlesBlock||'No principles sections yet.'}
```

### athlete_state field → tag mapping

**No such mapping exists in code.** `grep -rn "contextTags\|tagsFor\|computeTags\|relevantTags"
lib/ app/` returns zero hits. Nothing in the current codebase derives a tag from any
`athlete_state` field (`training_status`, `equipment_tier`, `throwing_status`, `season_phase`,
`season_role`, `gates_passed`, `active_change`, `active_change_stage`, or any other field).

**The 17 distinct tags that do exist on `principles_sections` rows today** (purely as
metadata — confirmed unused by any selection logic):
`arm_care, athlete_setup, background, calendar, conditioning, deload, diagnostics, in_season,
lifting, movement_change, off_season, recovery, return_to_throw, templates, testing, throwing,
velocity_block`

Since no code path produces any of these as a computed "context tag," the question "which tag
can no code path produce" is moot in the way the task frames it — **no tag is currently
produced by any code path**, because nothing computes context tags anymore. They remain
useful only as organizational/search metadata in the Principles tab UI (per
`lib/principlesSections.ts`'s own comment), not as an inclusion signal.

---

## 5. Coverage check

**This section cannot be answered the way the task frames it, and that itself is the finding.**
`bundleAllPrinciples` takes zero athlete-state input. There is no `PRINCIPLES_PROMPT_CHAR_BUDGET`
constant anywhere in the code (confirmed: zero hits). The only character ceiling that exists
(`PRINCIPLES_SANITY_CEILING = 150000`) is non-enforcing — it only logs a warning, never drops
a section — and the live total (89,593 chars) doesn't cross it anyway.

I ran the **real function** (not a re-implementation) against the live table data, via a
direct Node import of `lib/principlesSections.ts`:

```
bundleAllPrinciples(liveRows) → { sections: 80, totalChars: 89593 }
summarizePrinciples(bundle)   → "80 section(s) sent (full document), ~89,593 chars"
```

Because the function has no athlete-state parameter, **all four requested scenarios produce
the identical result** — every section, every time, regardless of athlete state:

| Scenario | Sections selected | Character total | Anything dropped? |
|---|---|---|---|
| Off-season (general_prep), beginner E3, no gates | All 80 | 89,593 | No |
| In-season competing starter with a team lift | All 80 | 89,593 | No |
| Restricted throwing status | All 80 | 89,593 | No |
| Active movement_change at stage 2 | All 80 | 89,593 | No |

Nothing is dropped in any scenario, by any budget, because there is no longer a budget or a
selection step to drop anything. The real per-athlete differentiation in today's prompt comes
entirely from the separate `COMPUTED CONSTRAINTS` block (`computeAthleteConstraints`), not from
which principles sections are included — all four scenarios get the same 89,593-character
principles document and a different constraints block layered on top of it.

---

## 6. Summary — top problems, ranked by how much they'd change a program

1. **The `always_include`/`is_engine_rule` flags no longer do anything, but the editor UI still
   claims one of them does.** This doesn't change any program today (nothing is filtered), but
   it's the one place a human could be actively misled while editing: the "Engine Rule" badge's
   tooltip says "Always included in the program-writing prompt," which has been false since
   `d5b7da0`. Low risk of silently breaking a program; real risk of someone making an editing
   decision based on a false premise.
2. **35 of 80 rows' `is_engine_rule` flag doesn't match the ⚙-marking the task describes as the
   rule for setting it** — predominantly rows marked `true` far more broadly than ⚙-marked
   content would justify. Doesn't affect any program today (flag is unused for selection), but
   means the flag can't currently be trusted as a map back to "which specific rules are
   ⚙-marked" if it's ever needed for that again.
3. **`always_include` has grown 3.6× past its original 15-section design (54 vs. 15 rows),
   confirming — with exact numbers — the drift that caused two separate historical
   silent-content-dropping bugs** (documented in `lib/principlesSections.ts`'s own comment).
   This is now moot for *today's* prompt (nothing is dropped anymore, full document always
   sent), but it's the fossil record of the actual, already-occurred bug that *did* change
   real programs before the `d5b7da0` fix — worth understanding even though it's resolved.
4. **Section 13.7, named in the original `always_include` seed list, does not exist anywhere in
   the current content** (table or spec file). Not a drift bug — more likely a stale reference
   in whatever design note the seed list came from, or a section deleted/renumbered since. No
   program impact either way, since there's nothing at that number to include or exclude.
5. **The true spec-vs-table drift check could not be performed as asked, because no independent
   original spec document exists in this repo** (Section 0). The zero-material-difference
   result in Section 2a should not be read as "no drift" — it's "no drift from a same-day
   snapshot of the table." This is the one finding that could, in principle, hide a real
   problem the task was specifically trying to catch, if an independent original spec exists
   elsewhere and actually differs from what's live today.
6. **All five specific superseded-content patterns the task named (3 oz/7 oz, Olympic lifts,
   broad-jump-as-predictor, plyo balls, %1RM-as-primary) are confirmed clean in the live text**
   — this is a genuine, direct-text-search result, not dependent on the Section 0 problem, and
   it's good news: none of those specific regressions are currently live.

No fixes are proposed above, per the task's instruction. This is a report for review.
