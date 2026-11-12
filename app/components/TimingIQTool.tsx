'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/baseScenario'
import { buildSavantLink } from '@/lib/savantLink'
import HowToReadPanel from '@/app/components/HowToReadPanel'
// Written by scripts/train_stage2_model.py on every retrain. Nothing in the Model Validation
// panel below is typed by hand, so it cannot go stale.
import metricsJson from '@/lib/timing-iq-metrics.json'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

type ScoreRow = {
  game_pk: number, game_date: string, away_team: string, home_team: string,
  inning: number, half_inning: 'top' | 'bottom',
  at_bat_index: number, pitch_num_in_pa: number,
  pitcher_id: number, pitcher_name: string, batter_id: number, batter_name: string, batter_side: string,
  pitch_type: string, pitch_type_desc: string, start_speed: number, balls_before: number, strikes_before: number,
  call_description: string, is_swing: boolean, is_whiff: boolean,
  stage1_swing_prob: number, stage1_whiff_prob: number, stage2_swing_prob: number | null, stage2_whiff_prob: number | null,
  swing_lift: number | null, whiff_lift: number | null, primary_metric: 'swing' | 'whiff',
  top_shap_feature: string, insight_text: string,
  post_decision_break: number, decision_point_zone_mismatch: boolean, within_pa_expectation_deviation: number | null,
  release_deviation_from_own_baseline_ft: number | null, batter_intercept_point_range: number | null,
}

// ---- Shape of lib/timing-iq-metrics.json (kept loose on purpose: the training script owns it) ----
type Comparison = { from: string, to: string, label: string, delta: number, ci_low: number, ci_high: number, p_le_zero: number, reliable: boolean }
type ModelScore = { auc: number, ci_low: number, ci_high: number, features: string[] }
type CalibrationBin = { bin_lo: number, bin_hi: number, n: number, mean_predicted: number, observed_rate: number }
type TargetMetrics = {
  n_train: number, n_holdout: number, holdout_event_rate: number,
  models: Record<string, ModelScore>,
  comparisons: Record<string, Comparison>,
  calibration: Record<string, { ece: number, bins: CalibrationBin[] }>,
}
type Metrics = {
  generated_at: string, metric: string, metric_plain_english: string,
  data: { n_games: number, n_pitches: number, n_pitches_modeled: number, date_start: string, date_end: string, n_pitchers: number, n_batters: number, n_train_games: number, n_holdout_games: number, holdout_dates: string[], batter_profile_coverage: number, release_baseline_coverage: number },
  method: { split: string, min_baseline_n: number, baselines: string, n_bootstrap: number, include_batter_features: boolean },
  deployed_features: string[],
  extra_features: { candidates: string[], available: boolean, decision: string, reason: string },
  targets: { swing: TargetMetrics, whiff: TargetMetrics },
}
const METRICS = metricsJson as unknown as Metrics

const TARGET_COPY: Record<'swing' | 'whiff', { title: string, why: string }> = {
  swing: {
    title: 'Swing vs. take',
    why: "Predicts whether the hitter swings at all — flags which pitches actually get a hitter to chase or take a strike, not just which pitches look nasty on paper.",
  },
  whiff: {
    title: 'Whiff vs. contact (given a swing)',
    why: "Given he swings, predicts whether he misses entirely — isolates which pitches actually miss bats, separate from whether they get swung at in the first place.",
  },
}

function pct(p: number | null) { return p == null ? '—' : `${(p * 100).toFixed(0)}%` }
function liftFor(r: ScoreRow) { return r.primary_metric === 'whiff' ? r.whiff_lift : r.swing_lift }
function stage1For(r: ScoreRow) { return r.primary_metric === 'whiff' ? r.stage1_whiff_prob : r.stage1_swing_prob }
function stage2For(r: ScoreRow) { return r.primary_metric === 'whiff' ? r.stage2_whiff_prob : r.stage2_swing_prob }
function liftLabel(v: number | null) {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(0)} pts`
}
function liftColor(v: number | null) {
  if (v == null) return C.textDim
  return Math.abs(v) >= 0.15 ? C.gold : C.textMuted
}
const ORDINALS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' }
function ordinal(n: number) { return ORDINALS[n] || `${n}th` }
function halfInningLabel(r: ScoreRow) { return `${r.half_inning === 'top' ? 'Top' : 'Bottom'} ${ordinal(r.inning)}` }

// AUC shown on the page's 0-100 scale (50 = coin flip). Improvements shown in those same points.
const score = (auc: number) => Math.round(auc * 100)
const scoreWithCi = (m: ModelScore) => `${score(m.auc)} (${score(m.ci_low)}–${score(m.ci_high)})`
const deltaPts = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`
const deltaWithCi = (c: Comparison) => `${deltaPts(c.delta)} pts (${deltaPts(c.ci_low)} to ${deltaPts(c.ci_high)})`
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: 'left' as const, padding: '8px 10px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.5px', whiteSpace: 'nowrap' as const }}>{children}</th>
}

// One pitch's row -- shared between the flat "All Pitchers" table and the "By Game" grouped view.
function PitchRow({ r, showDate }: { r: ScoreRow, showDate: boolean }) {
  const s1 = stage1For(r), s2 = stage2For(r), l = liftFor(r)
  const link = buildSavantLink({
    dateGt: r.game_date, dateLt: r.game_date,
    batterStands: r.batter_side as 'R' | 'L',
    countBucket: `${r.balls_before}-${r.strikes_before}`,
    pitchType: r.pitch_type,
  })
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      {showDate && <td style={{ padding: '8px 10px', fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' as const }}>{r.game_date}</td>}
      <td style={{ padding: '8px 10px', fontSize: 11, color: C.text }}>{r.pitcher_name} → {r.batter_name}</td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: C.text, whiteSpace: 'nowrap' as const }}>{r.pitch_type} {r.start_speed?.toFixed(1)}mph</td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: C.textMuted }}>{r.balls_before}-{r.strikes_before}</td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: C.textMuted }}>{r.call_description}</td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: r.primary_metric === 'whiff' ? C.purple : C.blue, border: `1px solid ${r.primary_metric === 'whiff' ? C.purple : C.blue}`, borderRadius: 5, padding: '2px 6px' }}>
          {r.primary_metric === 'whiff' ? 'Whiff %' : 'Swing %'}
        </span>
      </td>
      <td style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', color: C.textMuted }}>{pct(s1)}</td>
      <td style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{pct(s2)}</td>
      <td style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', color: liftColor(l) }}>{liftLabel(l)}</td>
      <td style={{ padding: '8px 10px', fontSize: 10, color: C.textDim, maxWidth: 260 }}>{r.insight_text}</td>
      <td style={{ padding: '8px 10px' }}>
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: C.blue, whiteSpace: 'nowrap' as const }}>Savant ↗</a>
      </td>
    </tr>
  )
}

const ROW_HEADERS = ['Matchup', 'Pitch', 'Count', 'Result', 'Reading', 'Pitch Alone', 'Pitch + Situation', 'Change', 'Why', '']

// The wide table (10 columns) works fine on the coach's desktop screen but this same
// component also renders inside the pitcher dashboard's ~480px-wide mobile shell, where a
// fixed-width table just runs columns off the right edge with no obvious way to know
// Reading/Stage 1/Stage 2/Lift/Why/Savant are even there. Below this breakpoint, render the
// same data as stacked cards instead of a table -- same information, no silent cutoff.
const NARROW_BREAKPOINT = 700

function useIsNarrow(breakpoint = NARROW_BREAKPOINT) {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return narrow
}

// Same fields as PitchRow, stacked instead of column-by-column.
function MobilePitchCard({ r, showDate }: { r: ScoreRow, showDate: boolean }) {
  const s1 = stage1For(r), s2 = stage2For(r), l = liftFor(r)
  const link = buildSavantLink({
    dateGt: r.game_date, dateLt: r.game_date,
    batterStands: r.batter_side as 'R' | 'L',
    countBucket: `${r.balls_before}-${r.strikes_before}`,
    pitchType: r.pitch_type,
  })
  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{r.pitcher_name} → {r.batter_name}</div>
        {showDate && <div style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap' as const }}>{r.game_date}</div>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 8, fontSize: 11, color: C.textMuted }}>
        <span>{r.pitch_type} {r.start_speed?.toFixed(1)}mph</span>
        <span>{r.balls_before}-{r.strikes_before}</span>
        <span>{r.call_description}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' as const }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: r.primary_metric === 'whiff' ? C.purple : C.blue, border: `1px solid ${r.primary_metric === 'whiff' ? C.purple : C.blue}`, borderRadius: 5, padding: '2px 6px' }}>
          {r.primary_metric === 'whiff' ? 'Whiff %' : 'Swing %'}
        </span>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.textMuted }}>{pct(s1)}</span>
        <span style={{ color: C.textDim, fontSize: 11 }}>→</span>
        <span style={{ fontSize: 13, fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{pct(s2)}</span>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: liftColor(l), marginLeft: 'auto' }}>{liftLabel(l)}</span>
      </div>
      <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.5, marginBottom: 8 }}>{r.insight_text}</div>
      <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: C.blue }}>Savant ↗</a>
    </div>
  )
}

// Shared by both the flat "All Pitchers" list and the "By Game" per-PA blocks -- picks
// table vs. cards once, in one place, instead of duplicating the check at each call site.
function PitchList({ rows, showDate }: { rows: ScoreRow[], showDate: boolean }) {
  const narrow = useIsNarrow()
  if (narrow) {
    return <div>{rows.map(r => <MobilePitchCard key={`${r.game_pk}-${r.at_bat_index}-${r.pitch_num_in_pa}`} r={r} showDate={showDate} />)}</div>
  }
  return (
    <div style={{ overflowX: 'auto' as const }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: showDate ? 950 : 900 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {showDate && <Th>Date</Th>}
            {ROW_HEADERS.map(h => <Th key={h}>{h}</Th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => <PitchRow key={`${r.game_pk}-${r.at_bat_index}-${r.pitch_num_in_pa}`} r={r} showDate={showDate} />)}
        </tbody>
      </table>
    </div>
  )
}

function HowToRead() {
  return (
    <HowToReadPanel title="How to Read Timing IQ">
      <div>
        <b style={{ color: C.blue }}>Pitch Alone</b> is what the pitch’s own shape says, by itself — its velocity, its release angles, and how much it kept moving after the point research says a hitter has already committed to swinging or not (roughly the midpoint of ball flight). It has no idea what count it is, what’s been thrown earlier in the at-bat, or who’s hitting.
      </div>
      <div>
        <b style={{ color: C.gold }}>Pitch + Situation</b> adds three things the pitch alone can’t see: what the hitter has already been shown earlier in this at-bat, whether this pitcher’s release point matches his own usual spot for this pitch type up to that moment (or looks off — a tip, fatigue, mechanics drifting), and this specific hitter’s own measured tendency to time fastballs differently than breaking balls. In the data we have so far, the measurable gain comes almost entirely from the first of those — see Model Validation below for exactly how much each piece added.
      </div>
      <div>
        Both numbers are a percent chance of <i>one</i> outcome — but which outcome depends on what actually happened, and that’s what the <b>Reading</b> badge on each row tells you:
        <div style={{ display: 'flex', gap: 16, marginTop: 6, marginLeft: 4, flexWrap: 'wrap' as const }}>
          <div><span style={{ fontSize: 9, fontWeight: 700, color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 5, padding: '2px 6px' }}>Swing %</span> — he took the pitch; this is his estimated chance of swinging at it.</div>
          <div><span style={{ fontSize: 9, fontWeight: 700, color: C.purple, border: `1px solid ${C.purple}`, borderRadius: 5, padding: '2px 6px' }}>Whiff %</span> — he swung; this is his estimated chance of missing entirely.</div>
        </div>
      </div>
      <div>
        <b>Change</b> is just “Pitch + Situation” minus “Pitch Alone,” in points — e.g. +20 pts means the probability read 20 points higher (like 30%→50%), not “20% higher.” Both numbers come from models fit on the same pitches (pitch 2 and later of each at-bat), so a Change near zero really does mean the pitch’s shape already told the story, and a big Change (either direction) means context moved the number.
      </div>
      <div>
        <b>Why</b> is the single biggest factor behind that specific pitch’s number, in plain language, and whether it pushed the read up or down — not everything the model weighed, just the top one.
      </div>
      <div>
        <b>Blank “Pitch + Situation”</b> means this was the first pitch of the at-bat — there’s nothing earlier in the PA yet for it to use, so only the pitch’s own shape applies.
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <b>Model Validation</b> (below) is a different kind of number from the per-pitch table. It isn’t about any one pitch; it asks whether adding situation beats the pitch alone across thousands of pitches from games the model never trained on. The score is <b>AUC</b>: how often the model ranks a pitch where the event happened above one where it didn’t, shown on a 0–100 scale where 50 is a coin flip and 100 is perfect. Each number comes with a range (a 95% confidence interval from re-sampling the held-out pitches 2,000 times). An <b>Improvement</b> only counts as real evidence if its whole range sits above zero — otherwise it’s marked “within noise,” which means we can’t yet tell it apart from luck at this sample size.
      </div>
      <div style={{ color: C.textDim, fontSize: 11 }}>
        <b>What this isn’t:</b> a certainty about any one pitch. It’s a pattern learned across thousands of pitches and hundreds of pitchers and hitters — good for flagging which specific pitches are worth a second look on video, not a guarantee about what should have happened on that pitch.
      </div>
    </HowToReadPanel>
  )
}

function ReliabilityBadge({ reliable }: { reliable: boolean }) {
  const color = reliable ? C.teal : C.textMuted
  return (
    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color, border: `1px solid ${color}`, borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap' as const }}>
      {reliable ? 'Reliable' : 'Within noise'}
    </span>
  )
}

function ValidationTargetCard({ id, t }: { id: 'swing' | 'whiff', t: TargetMetrics }) {
  const base = t.models['BASE'], full = t.models['FULL']
  const headline = t.comparisons['headline'], counted = t.comparisons['count_controlled']
  const seq = t.comparisons['sequence_only'], pitcher = t.comparisons['pitcher_baseline'], batter = t.comparisons['batter_profile']
  const ece = t.calibration['FULL']?.ece
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' as const }
  const label = { fontSize: 11, color: C.textMuted, flex: 1, minWidth: 160 }
  const mono = { fontSize: 12, fontFamily: 'monospace', color: C.text }
  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, flex: 1, minWidth: 280 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{TARGET_COPY[id].title}</div>
      <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, marginBottom: 10, lineHeight: 1.5 }}>{TARGET_COPY[id].why}</div>
      <div style={rowStyle}><span style={label}>Pitch alone</span><span style={{ ...mono, color: C.textMuted }}>{scoreWithCi(base)}</span></div>
      <div style={rowStyle}><span style={label}>Pitch + situation</span><span style={{ ...mono, color: C.gold, fontWeight: 700 }}>{scoreWithCi(full)}</span></div>
      <div style={rowStyle}>
        <span style={label}>Improvement</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ ...mono, color: headline.reliable ? C.teal : C.textMuted }}>{deltaWithCi(headline)}</span><ReliabilityBadge reliable={headline.reliable} /></span>
      </div>
      <div style={rowStyle}>
        <span style={label}>Improvement after both sides also know the count</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ ...mono, color: counted.reliable ? C.teal : C.textMuted }}>{deltaWithCi(counted)}</span><ReliabilityBadge reliable={counted.reliable} /></span>
      </div>
      <div style={{ fontSize: 10, color: C.textDim, marginTop: 8, lineHeight: 1.6 }}>
        Where it comes from — what he’s already seen this at-bat: <span style={{ color: seq.reliable ? C.teal : C.textMuted }}>{deltaPts(seq.delta)}</span>;
        pitcher’s own release-point norm: <span style={{ color: pitcher.reliable ? C.teal : C.textMuted }}>{deltaPts(pitcher.delta)}</span>;
        hitter’s timing profile: <span style={{ color: batter.reliable ? C.teal : C.textMuted }}>{deltaPts(batter.delta)}</span>
        {' '}(points; colored only if reliably above zero).
        {ece != null && <> Calibration: a displayed probability is, on average, within {(ece * 100).toFixed(1)} points of what actually happened.</>}
        {' '}Tested on {t.n_holdout.toLocaleString()} held-out pitches.
      </div>
    </div>
  )
}

function ModelValidation() {
  const d = METRICS.data
  const swing = METRICS.targets.swing, whiff = METRICS.targets.whiff
  const swingOk = swing.comparisons['headline'].reliable && swing.comparisons['count_controlled'].reliable
  const whiffOk = whiff.comparisons['headline'].reliable
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>Model Validation — Does Sequencing Actually Add Anything?</div>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, lineHeight: 1.5 }}>
        {d.n_games} regular-season games, {fmtDate(d.date_start)} – {fmtDate(d.date_end)} ({d.n_pitches.toLocaleString()} pitches, {d.n_pitchers} pitchers, {d.n_batters} hitters). Models trained on {d.n_train_games} games and tested on the {d.n_holdout_games} games of {d.holdout_dates.map(fmtDate).join(', ')}, which they never saw. Score is AUC on a 0–100 scale (50 = coin flip), with its 95% range in parentheses.
      </div>
      <div style={{ fontSize: 11, color: C.text, marginBottom: 10, lineHeight: 1.6, background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
        <b>What the data supports right now:</b>{' '}
        {swingOk
          ? <>Knowing what the hitter has already seen in the at-bat reliably improves the swing/take read — and it still does after both models are also told the count, so it isn’t just the count showing through.</>
          : <>The swing/take improvement is not yet reliably above noise at this sample size.</>}
        {' '}
        {whiffOk
          ? <>The whiff/contact improvement is also reliably above zero.</>
          : <>For whiff vs. contact, the improvement is <b>within noise</b> at this sample size — treat it as unproven, not as evidence either way.</>}
        {' '}The pitcher release-point and hitter-profile pieces did not add anything measurable in this one week of games; the gain is the within-at-bat sequence.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
        <ValidationTargetCard id="swing" t={swing} />
        <ValidationTargetCard id="whiff" t={whiff} />
      </div>
      <div style={{ fontSize: 9, color: C.textDim, marginTop: 8, lineHeight: 1.5 }}>
        Split by date; pitcher norms use only pitches thrown before each pitch (min {METRICS.method.min_baseline_n}); ranges from {METRICS.method.n_bootstrap.toLocaleString()} bootstrap resamples. Release extension + spin axis: {METRICS.extra_features.decision === 'keep' ? 'included (they cleared the range)' : METRICS.extra_features.decision === 'drop' ? 'tested and left out (within noise)' : 'not yet tested'}. Last retrained {METRICS.generated_at.slice(0, 10)}.
      </div>
    </div>
  )
}

export default function TimingIQTool() {
  const supabase = createClient()
  const [rows, setRows] = useState<ScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scope, setScope] = useState<'all' | 'game'>('all')
  const [pitcherId, setPitcherId] = useState<string>('')
  const [sortMode, setSortMode] = useState<'lift' | 'recent'>('lift')
  const [gamePk, setGamePk] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    fetchAllRows(supabase, 'pitch_sequence_scores')
      .then(data => {
        if (cancelled) return
        setRows(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('TimingIQTool: failed to load pitch_sequence_scores', err)
        setLoadError(err instanceof Error ? err.message : 'Could not load the scored pitches.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const pitchers = useMemo(() => {
    const byId = new Map<string, { id: string, name: string, n: number }>()
    for (const r of rows) {
      const id = String(r.pitcher_id)
      const existing = byId.get(id)
      if (existing) existing.n++
      else byId.set(id, { id, name: r.pitcher_name, n: 1 })
    }
    return [...byId.values()].sort((a, b) => b.n - a.n)
  }, [rows])

  const games = useMemo(() => {
    const byGame = new Map<string, { id: string, label: string, date: string }>()
    for (const r of rows) {
      const id = String(r.game_pk)
      if (!byGame.has(id)) byGame.set(id, { id, label: `${r.game_date} — ${r.away_team} @ ${r.home_team}`, date: r.game_date })
    }
    return [...byGame.values()].sort((a, b) => (b.date > a.date ? 1 : -1) || Number(b.id) - Number(a.id))
  }, [rows])

  const filtered = useMemo(() => {
    let list = pitcherId ? rows.filter(r => String(r.pitcher_id) === pitcherId) : rows
    list = [...list]
    if (sortMode === 'recent') {
      list.sort((a, b) => (b.game_date > a.game_date ? 1 : -1) || b.at_bat_index - a.at_bat_index)
    } else {
      const mag = (r: ScoreRow) => Math.abs(liftFor(r) ?? 0)
      list.sort((a, b) => mag(b) - mag(a))
    }
    return list.slice(0, 40)
  }, [rows, pitcherId, sortMode])

  const gameGroups = useMemo(() => {
    if (!gamePk) return []
    const gameRows = rows.filter(r => String(r.game_pk) === gamePk)
    // Group into half-innings (in game order), then into plate appearances (in order), each
    // PA's own pitches already come back from Supabase in no guaranteed order, so sort fully.
    const sorted = [...gameRows].sort((a, b) =>
      (a.inning - b.inning) || (a.half_inning === b.half_inning ? 0 : a.half_inning === 'top' ? -1 : 1) ||
      (a.at_bat_index - b.at_bat_index) || (a.pitch_num_in_pa - b.pitch_num_in_pa)
    )
    const halfInnings: { key: string, label: string, pas: { key: string, header: string, rows: ScoreRow[] }[] }[] = []
    for (const r of sorted) {
      const hiKey = `${r.inning}-${r.half_inning}`
      let hi = halfInnings.find(h => h.key === hiKey)
      if (!hi) { hi = { key: hiKey, label: halfInningLabel(r), pas: [] }; halfInnings.push(hi) }
      const paKey = String(r.at_bat_index)
      let pa = hi.pas.find(p => p.key === paKey)
      if (!pa) {
        const lastRow = sorted.filter(x => x.at_bat_index === r.at_bat_index).slice(-1)[0]
        pa = { key: paKey, header: `${r.pitcher_name} → ${r.batter_name} (${lastRow.call_description})`, rows: [] }
        hi.pas.push(pa)
      }
      pa.rows.push(r)
    }
    return halfInnings
  }, [rows, gamePk])

  const summary = useMemo(() => {
    const scoped = pitcherId ? rows.filter(r => String(r.pitcher_id) === pitcherId) : rows
    const lifts = scoped.map(liftFor).filter((v): v is number => v != null)
    const avgAbs = (a: number[]) => a.length ? a.reduce((s, v) => s + Math.abs(v), 0) / a.length : null
    return { n: scoped.length, avgLiftAbs: avgAbs(lifts) }
  }, [rows, pitcherId])

  if (loading) return <div style={{ textAlign: 'center' as const, padding: 30, color: C.textMuted, fontSize: 13 }}>Loading...</div>

  return (
    <div style={{ color: C.text, fontSize: 13 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.gold, marginBottom: 4 }}>Timing IQ</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, lineHeight: 1.6 }}>
        Grades each pitch on only what a hitter could have known by roughly the middle of its flight — before its final location/movement is fully visible — plus what he’s already seen earlier in the at-bat. Sports-vision research (Adair; Sherwin/deCervo; the PLOS One occlusion study) puts the actual swing-decision point at roughly 45-55% of ball flight; this uses the midpoint of that range.
      </div>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 16, lineHeight: 1.6 }}>
        This independently tests the same underlying claim Perry Husband’s Effective Velocity theory rests on — that what’s already happened in an at-bat changes how the next pitch is read — using our own MLB Stats API pitch data and Baseball Savant bat-tracking exports, not Husband’s own (patented) zone values.
      </div>

      <HowToRead />

      <ModelValidation />

      {loadError && (
        <div style={{ background: 'rgba(248,81,73,0.1)', border: `1px solid ${C.red}`, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: C.red }}>
          Couldn’t load the scored pitches ({loadError}). The validation numbers above are unaffected; the per-pitch table below will be empty until this loads.
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['all', 'game'] as const).map(s => (
          <button key={s} onClick={() => setScope(s)} style={{ background: scope === s ? C.gold : C.bg3, color: scope === s ? C.bg : C.textMuted, border: `1px solid ${scope === s ? C.gold : C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: scope === s ? 700 : 400, cursor: 'pointer' }}>
            {s === 'all' ? 'All Pitchers' : 'By Game'}
          </button>
        ))}
      </div>

      {scope === 'all' ? (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: 16, alignItems: 'center' }}>
            <select value={pitcherId} onChange={e => setPitcherId(e.target.value)} style={{ background: C.bg2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
              <option value="">All pitchers ({rows.length} pitches)</option>
              {pitchers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.n})</option>)}
            </select>
            {(['lift', 'recent'] as const).map(m => (
              <button key={m} onClick={() => setSortMode(m)} style={{ background: sortMode === m ? C.gold : C.bg3, color: sortMode === m ? C.bg : C.textMuted, border: `1px solid ${sortMode === m ? C.gold : C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: sortMode === m ? 700 : 400, cursor: 'pointer' }}>
                {m === 'lift' ? 'Most Sequence-Driven' : 'Most Recent'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: 20 }}>
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>Pitches scored</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{summary.n.toLocaleString()}</div>
            </div>
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>Avg size of the Change (points, either direction)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>{summary.avgLiftAbs != null ? `${(summary.avgLiftAbs * 100).toFixed(1)} pts` : '—'}</div>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>{pitcherId ? pitchers.find(p => p.id === pitcherId)?.name : 'All Pitchers'} — Pitch-Level Scores</div>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, lineHeight: 1.5 }}>
            Showing up to 40, sorted by {sortMode === 'lift' ? 'how much sequence context changed the read vs. the pitch alone' : 'most recent'}. A Change of +20 pts means “Pitch + Situation” read 20 points higher than “Pitch Alone” (e.g. 30% → 50%), not “20% higher.”
          </div>
          <PitchList rows={filtered} showDate />
        </>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <select value={gamePk} onChange={e => setGamePk(e.target.value)} style={{ background: C.bg2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, minWidth: 320, maxWidth: '100%' }}>
              <option value="">Select a game...</option>
              {games.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </div>
          {!gamePk ? (
            <div style={{ color: C.textMuted, fontSize: 12, padding: 20, textAlign: 'center' as const }}>Pick a game to see every at-bat, inning by inning, in the order it actually happened.</div>
          ) : (
            <div>
              {gameGroups.map(hi => (
                <div key={hi.key} style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 4 }}>{hi.label}</div>
                  {hi.pas.map(pa => (
                    <div key={pa.key} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 4 }}>{pa.header}</div>
                      <PitchList rows={[...pa.rows].sort((a, b) => a.pitch_num_in_pa - b.pitch_num_in_pa)} showDate={false} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 16 }}>
        Data: MLB Stats API live-feed pitch tracking (pitch-level physics + sequence) and Baseball Savant’s Swing Path/Attack Angle leaderboard (batter timing-adjustment profiles), scored by a two-stage XGBoost model (see scripts/train_stage1_model.py, train_stage2_model.py, score_all_pitches.py). Regular-season games only. Recomputed as a batch job after new games are pulled, not live per request.
      </div>
    </div>
  )
}
