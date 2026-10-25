# UX Audit Handoff — Salzman Baseball

**Purpose of this document:** a complete, accurate inventory of every page, tab, and tool
currently live on the site, prepared so a fresh Claude Code session (with no prior context on
this project) can start a user-experience audit immediately instead of spending its first hour
re-discovering what already exists. Everything below was verified directly against the current
code — not reconstructed from memory — as of 2026-10-21.

**What a UX audit of this app should actually look at:**
- Navigation friction: how many clicks/taps to reach each tool, whether related things are
  grouped sensibly, whether tab labels are self-explanatory to a coach or athlete who's never
  used the app before.
- Redundant or confusing duplicate paths (e.g. the same data entered or viewed two different
  ways in two different places).
- Tools that are built and live but may be undiscoverable, underused, or unclear in purpose.
- Mobile usability — most athletes will use this on a phone, not a laptop.
- Visual/interaction consistency across tools (some were built at different times by different
  passes and may not match each other's conventions).
- Dead weight: components or tables that are no longer reachable from any UI but still exist.

Don't assume anything below needs to change — it's a map, not a list of complaints. Some
asymmetry (e.g. coach-only admin tables) is expected and correct, not a bug.

---

## 1. Top-level navigation

- Two main dashboards, role-gated via `profiles.role` in Supabase: `app/coach/page.tsx` (coach)
  and `app/pitcher/page.tsx` (athlete). Visiting the wrong one redirects you to your own.
- **Coach dashboard header nav**: `ROSTER / ADHERENCE / LIBRARY / PRINCIPLES` view switcher,
  plus `ANATOMY` (→ `/anatomy`), `SOCIAL` (→ `/social`), `PUBLIC SITE` (→ `/articles`, opens in
  a new tab), and Sign Out.
- **Social area** (coach-only): `/social` (post composer) links out to `/social/playbook`,
  `/social/radar` (Question Radar), and `/ideas`. All three bounce non-coaches back to
  `/pitcher`.
- **Pitcher dashboard**: its own tab bar, no sidebar. One tab, "Anatomy," is actually
  `router.push('/anatomy')` — a full navigation away from the dashboard disguised as a tab,
  worth a UX look (does the athlete realize they've left the dashboard?).
- `/articles` and `/articles/[slug]` are the public, unauthenticated marketing/blog site — a
  separate layout entirely, outside the dashboard's auth flow.

---

## 2. Coach dashboard (`app/coach/page.tsx`, ~2300 lines)

**Top-level views:** Roster, Adherence, Library, Principles.

**Roster → selecting a pitcher** drills into a pitcher-detail screen with its own tab bar:
**Overview, Weekly, Logs, Program, IQ, Benchmarks, Hop, Pushup, Mechanics.**

| Tab | What it shows | Data |
|---|---|---|
| Overview | Weekly pitch/high-effort-throw counts, CMJ trend sparklines, CMJ history manager, Neuro Classification card, today's Fuel Score, recent session logs | `cmj_results`, `daily_fuel_scores`, `food_logs`, `session_logs` |
| Weekly | Workload-flag summary (rest-owed via `lib/pitchSmart`, CMJ classification flags) | derived from `session_logs` + `cmj_results` |
| Logs | Session log review | `session_logs` |
| Program | Weekly program grid (Category × Day), exercise picker, AI-prompt "Claude" button built from `principles`/`principles_sections`, Import/Copy Week/Clear Week | writes `programs.structured_days` |
| IQ | `<PitchingIQTab/>` | — |
| Benchmarks | `<AthleticBenchmarks/>` | benchmark tables |
| Hop | `<HopTestPanel/>` | `hop_test_results` |
| Pushup | `<PlyoPushupPanel/>` | `plyo_pushup_assessments` |
| Mechanics | `<PitchMechanics2D/>` | mechanics frame logs |

**Adherence view**: roster sorted by days-since-last-log, color-flagged (red ≥5d, gold 2–4d,
teal 0–1d).

**Library view**: Exercise Library CRUD — ~90 built-in exercises hardcoded in-file
(`EXERCISE_DB`) plus `custom_exercises`/`exercise_overrides` tables, search/filter, bulk import,
a "Backfill Descriptions" tool, edit/delete, video links (`exercise_videos`).

**Principles view**: `<PrinciplesSectionsEditor/>` (writes `principles_sections`) plus a legacy
"Detected Prescriptions" view parsed from the older `principles` text table — **both exist
side by side right now**, explicitly flagged in-code as an incomplete migration (see §6).

---

## 3. Pitcher dashboard (`app/pitcher/page.tsx`, ~880 lines)

**Tabs:** Overview, Why, Program, Food, Assess, Log, Pitching IQ, Anatomy (external nav).

| Tab | What it shows | Data |
|---|---|---|
| Overview | `<ProgressOverview mode="athlete"/>`, workload trend sparklines | `session_logs` |
| Why | `<ThrowingPrinciples/>` — read-only principles display | — |
| Program | Read-only view of the coach-built weekly program, CMJ-classification banner, exercise videos | `programs.structured_days` |
| Food | Meal logger (type, macros, GI, pro-metabolic tags), live calorie preview, 0–100 Fuel Score, water log, 7-day trend | writes `food_logs`, `daily_fuel_scores` |
| Assess | Sub-tabs: **CMJ, Hop Test, Plyo Push-Up, Benchmarks, Mechanics** (confirmed at lines 699, 797, 801) | `cmj_results`, `hop_test_results`, `plyo_pushup_assessments` |
| Log | Session log form: velocity, weight lifted, sprint time, pitch count, high-effort throws, feeling, soreness, readiness | `session_logs` |
| Pitching IQ | `<PitchingIQTab/>` | — |
| Anatomy | External navigation to `/anatomy`, not an in-page tab | — |

---

## 4. Full tools inventory (`app/components/*.tsx`)

| Component | Mounted in | Purpose |
|---|---|---|
| PitchingIQTab | Coach (IQ), Pitcher (Pitching IQ) | Container for IQ sub-tools |
| PitchingIQ | via PitchingIQTab | Core pitching-IQ content |
| SituationsView | via PitchingIQTab | Mounts BaseScenarioTool, CountLeverageTable, PitchSequenceTool |
| BaseScenarioTool, CountLeverageTable, PitchSequenceTool | via SituationsView | Situational pitch-calling tools |
| EffectiveVelocityTool | via PitchingIQTab | Effective-velocity calculator |
| TimingIQTool | via PitchingIQTab | Pitch-timing tool |
| HowToReadPanel | Shared (3 mount points) | Explanatory helper panel |
| AthleticBenchmarks | Coach (Benchmarks), Pitcher (Assess) | Benchmark test results, mounts MiniSparkline/TestVideoLink/TestDetailModal |
| TestDetailModal | via AthleticBenchmarks | Per-test detail modal |
| HopTestPanel | Coach + Pitcher | Hop Test logger (repeated-hop RSI) |
| PlyoPushupPanel | Coach + Pitcher | Plyo Push-Up logger |
| PitchMechanics2D | Coach (Mechanics) + Pitcher | 2D pitch-mechanics visualizer |
| ProgressOverview | Coach (`mode="coach"`) + Pitcher (`mode="athlete"`) | Shared progress summary, mode-switched (good dedup example) |
| MiniSparkline | Shared widely | Generic trend chart |
| TestVideoLink | Coach + Pitcher + AthleticBenchmarks + TestDetailModal | Video-link widget for exercises/tests |
| PrinciplesSectionsEditor | Coach (Principles) only | Training-principles editor |
| ThrowingPrinciples | Pitcher (Why) only | Read-only principles display |
| BodyTypeGuide | `/anatomy` only | Interactive anatomy/body-type reference |

---

## 5. Other pages (outside the two main dashboards)

- **`/social`** (633 lines) — Instagram post composer/scheduler, coach-only. Links to Playbook,
  Question Radar, Ideas.
- **`/social/playbook`** (99 lines) — content-playbook reference page.
- **`/social/radar`** ("Question Radar," 259 lines) — surfaces/tracks audience questions as
  content ideas, coach-only, writes to the unified `ideas` table (replaced an older
  `radar_ideas` table per an in-code comment).
- **`/ideas`** (254 lines) — content-ideas board, coach-only.
- **`/anatomy`** (122 lines) — interactive body-silhouette tool, mounts `BodyTypeGuide`.
  Reachable from both dashboards but **does not appear to be role-gated** like the social pages
  are — worth confirming whether that's intentional.
- **`/articles`** + **`/articles/[slug]`** — public marketing/blog content, fully separate from
  the authenticated app.

---

## 6. Known issues already flagged in-code (not guesses — these are real, existing TODOs)

1. **`principles` vs `principles_sections`**: the legacy single-text `principles` table still
   powers exercise auto-suggest in the Program tab; `principles_sections` is the newer
   structured editor. Both are live simultaneously — migration incomplete.
2. **Dead/orphaned components still on disk, not imported anywhere:**
   - `ArmCareSummary.tsx` — fully orphaned (leftover from the Arm Care Test removal).
   - `ThrowLogPanel.tsx` — fully orphaned (removed from the coach dashboard; see §7).
   - `AthleteStatePanel.tsx` — orphaned as a mounted component, but the `athlete_state` table it
     used to read is still queried directly elsewhere in the coach page.
3. **`rtt_phase` column on `profiles`** is explicitly noted in-code as removed from the UI
   pending a rework, but the column/data still exists in the database.
4. **Fuel-scoring logic** (`scoreMeal`, `scoreFuelDay`, `scoreColor`, `MEAL_TYPE_COLORS`,
   `GI_OPTIONS`, `PRO_METABOLIC_FOODS`) is duplicated near-verbatim between the coach page
   (read-only display) and the pitcher page (actual entry) — not extracted to a shared lib.
   Candidate for cleanup, not a user-facing issue by itself.
5. **CMJ calculation logic is shared** (`lib/cmj.ts`: `parseTime`, `calcCMJFn`, `classifyCMJ`,
   `validateCMJTimestamps`) but **each page still has its own separate form state, save
   handlers, and UI** — coach uses a modal flow, pitcher uses an inline flow. Hop Test and Plyo
   Push-Up, by contrast, are fully shared components with zero page-local duplication — a
   useful before/after comparison if consolidating the CMJ UI is ever considered.
6. Several small literal constants are duplicated in both page files rather than shared
   (`READINESS_OPTIONS`/`READINESS_COLORS`, the `DAYS` array, various color/tier maps) — trivial
   individually, but worth noting as a pattern.

---

## 7. Recently changed (this is NOT yet reflected in anyone's mental model of the app)

In the last several days, the following shipped and should be treated as the current baseline,
not a "new" addition to flag as unusual:
- CMJ module expanded from 3 to 6 phase timestamps (added bottom-of-loading-phase, landing
  stabilization, return-to-upright) with new timing-only derived metrics, plus a new
  "Concentric Impulse (full phase)" metric (explicitly distinct from true force-plate CI-100).
- The CMJ velocity-prediction formula was rebuilt twice: first refit on real Driveline data,
  then rebuilt again as a 95th-percentile "ceiling" model (not a mean prediction) after review
  surfaced that an average-fit model is the wrong shape for "rarely exceeded" framing.
- Hop Test and Plyo Push-Up modules were added from scratch (new tables, new shared components,
  new tabs on both dashboards).
- The Arm Care Test feature was removed entirely (coach + pitcher), including its
  Speed/Power ground-contact guardrail.
- On the coach dashboard: the Workload card, Workload Trend chart, Athlete State panel, Throw
  Log panel, and "This Week's Program" card were all removed from the Overview/Weekly views per
  explicit product decisions (not bugs — ask before re-adding).

---

## 8. Supabase tables referenced (for cross-checking RLS/data model during the audit)

**Coach page touches:** `athlete_state`, `cmj_results`, `custom_exercises`, `daily_fuel_scores`,
`exercise_overrides`, `exercise_videos`, `food_logs`, `principles`, `principles_sections`,
`profiles`, `programs`, `recommendation_rules`, `session_logs`, `throw_volume_entries`,
`hop_test_results`, `plyo_pushup_assessments`.

**Pitcher page touches:** `cmj_results`, `daily_fuel_scores`, `exercise_videos`, `food_logs`,
`profiles`, `programs`, `session_logs`, `hop_test_results`, `plyo_pushup_assessments`.

The coach-only tables above (`athlete_state`, `custom_exercises`, `exercise_overrides`,
`principles`/`principles_sections`, `recommendation_rules`, `throw_volume_entries`) are
coach-configuration/admin data — expected asymmetry, not a sign of a missing pitcher feature.
