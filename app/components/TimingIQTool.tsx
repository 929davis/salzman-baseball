'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/baseScenario'
import { buildSavantLink } from '@/lib/savantLink'
import HowToReadPanel from '@/app/components/HowToReadPanel'

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

// Measured once during training/validation (train_stage2_model.py, holdout = most recent 15%
// of pulled games) -- not recomputed live, since there's no server-side Python inference in
// this app. Re-run that script and update these by hand if the model is retrained.
const VALIDATION = [
  {
    target: 'Swing vs. take', base: 0.693, full: 0.735,
    why: "Predicts whether the hitter swings at all — flags which pitches actually get a hitter to chase or take a strike, not just which pitches look nasty on paper.",
  },
  {
    target: 'Whiff vs. contact (given a swing)', base: 0.656, full: 0.679,
    why: "Given he swings, predicts whether he misses entirely — isolates which pitches actually miss bats, separate from whether they get swung at in the first place.",
  },
]

function pct(p: number | null) { return p == null ? '—' : `${(p * 100).toFixed(0)}%` }
function liftFor(r: ScoreRow) { return r.primary_metric === 'whiff' ? r.whiff_lift : r.swing_lift }
function stage1For(r: ScoreRow) { return r.primary_metric === 'whiff' ? r.stage1_whiff_prob : r.stage1_swing_prob }
function stage2For(r: ScoreRow) { return r.primary_metric === 'whiff' ? r.stage2_whiff_prob : r.stage2_swing_prob }
function liftLabel(v: number | null) {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(0)}pp`
}
function liftColor(v: number | null) {
  if (v == null) return C.textDim
  return Math.abs(v) >= 0.15 ? C.gold : C.textMuted
}
const ORDINALS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' }
function ordinal(n: number) { return ORDINALS[n] || `${n}th` }
function halfInningLabel(r: ScoreRow) { return `${r.half_inning === 'top' ? 'Top' : 'Bottom'} ${ordinal(r.inning)}` }

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

const ROW_HEADERS = ['Matchup', 'Pitch', 'Count', 'Result', 'Reading', 'Stage 1', 'Stage 2', 'Lift (pp)', 'Why', '']

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
        <b style={{ color: C.blue }}>Stage 1</b> is what the pitch's own shape says, alone — its velocity, where it crossed the zone, and how much it kept moving after the point research says a hitter has already committed to swinging or not (roughly the midpoint of ball flight). It has no idea what count it is, what's been thrown earlier in the at-bat, or who's hitting.
      </div>
      <div>
        <b style={{ color: C.gold }}>Stage 2</b> adds three things Stage 1 can't see: what the hitter has already been shown earlier in this at-bat, whether this pitcher's release point matches his own normal spot for this pitch type (or looks off — a tip, fatigue, mechanics drifting), and this specific hitter's own measured tendency to time fastballs differently than breaking balls.
      </div>
      <div>
        Both numbers are a percent chance of <i>one</i> outcome — but which outcome depends on what actually happened, and that's what the <b>Reading</b> badge on each row tells you:
        <div style={{ display: 'flex', gap: 16, marginTop: 6, marginLeft: 4 }}>
          <div><span style={{ fontSize: 9, fontWeight: 700, color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 5, padding: '2px 6px' }}>Swing %</span> — he took the pitch; this is his estimated chance of swinging at it.</div>
          <div><span style={{ fontSize: 9, fontWeight: 700, color: C.purple, border: `1px solid ${C.purple}`, borderRadius: 5, padding: '2px 6px' }}>Whiff %</span> — he swung; this is his estimated chance of missing entirely.</div>
        </div>
      </div>
      <div>
        <b>Lift (pp)</b> is just Stage 2 minus Stage 1, in <b>percentage points</b> (pp) — e.g. +20pp means the probability read 20 points higher (like 30%→50%), not "20% higher." A big lift (either direction) means context — not the pitch's own shape — is what moved the number. A lift near zero means the pitch's shape alone already told most of the story.
      </div>
      <div>
        <b>Why</b> is the single biggest factor behind that specific pitch's number, in plain language — not everything the model weighed, just the top one.
      </div>
      <div>
        <b>Blank Stage 2</b> means this was the first pitch of the at-bat — there's nothing earlier in the PA yet for Stage 2 to use, so only Stage 1 applies.
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <b>Model Validation</b> (below) is a completely different pair of numbers from the per-pitch table above — it isn't about any one pitch, it's whether Stage 2 actually beats Stage 1 across thousands of pitches the model never trained on. Its <b>Score</b> is a stat called AUC: 0.50 (coin flip) to 1.00 (perfect). Both stages score clearly above a coin flip, and Stage 2 scores higher than Stage 1 on both targets — that <b>Gain</b> is the real evidence sequencing adds something, not a claim about any single pitch below. Each target row also says in plain language why that specific prediction is worth having, not just that the model scores well on it.
      </div>
      <div style={{ color: C.textDim, fontSize: 11 }}>
        <b>What this isn't:</b> a certainty about any one pitch. It's a pattern learned across thousands of pitches and hundreds of pitchers and hitters — good for flagging which specific pitches are worth a second look on video, not a guarantee about what should have happened on that pitch.
      </div>
    </HowToReadPanel>
  )
}

export default function TimingIQTool() {
  const supabase = createClient()
  const [rows, setRows] = useState<ScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'all' | 'game'>('all')
  const [pitcherId, setPitcherId] = useState<string>('')
  const [sortMode, setSortMode] = useState<'lift' | 'recent'>('lift')
  const [gamePk, setGamePk] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    fetchAllRows(supabase, 'pitch_sequence_scores').then(data => {
      if (cancelled) return
      setRows(data)
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
        Grades each pitch on only what a hitter could have known by roughly the middle of its flight — before its final location/movement is fully visible — plus what he's already seen earlier in the at-bat. Sports-vision research (Adair; Sherwin/deCervo; the PLOS One occlusion study) puts the actual swing-decision point at roughly 45-55% of ball flight; this uses the midpoint of that range.
      </div>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 16, lineHeight: 1.6 }}>
        This independently tests the same underlying claim Perry Husband's Effective Velocity theory rests on — that what's already happened in an at-bat changes how the next pitch is read — using our own MLB Stats API pitch data and Baseball Savant bat-tracking exports, not Husband's own (patented) zone values.
      </div>

      <HowToRead />

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Model Validation — Does Sequencing Actually Add Anything?</div>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, lineHeight: 1.5 }}>
        Two models per target: physics-only (pitch's own velocity/angle/movement, Stage 1) vs. physics + what the hitter had already seen this at-bat + this pitcher's own release-point norms + this hitter's own timing-adjustment profile (Stage 2). Measured on held-out games the models never trained on.
      </div>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, lineHeight: 1.5, background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
        <b style={{ color: C.text }}>Score</b> = ranking accuracy, a stat called <b>AUC</b>: 0.50 means no better than a coin flip, 1.00 means perfect. Higher is always better. <b style={{ color: C.text }}>Gain</b> = Stage 2's score minus Stage 1's — a positive gain here is the actual proof sequencing helps, measured once across thousands of held-out pitches (not something recalculated per pitch below).
      </div>
      <div style={{ overflowX: 'auto' as const, marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: 420 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <Th>Target — Why It Matters</Th>
              <th style={{ textAlign: 'right' as const, padding: '8px 10px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Stage 1 Score</th>
              <th style={{ textAlign: 'right' as const, padding: '8px 10px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Stage 2 Score</th>
              <th style={{ textAlign: 'right' as const, padding: '8px 10px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Gain</th>
            </tr>
          </thead>
          <tbody>
            {VALIDATION.map(v => (
              <tr key={v.target} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{v.target}</div>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, maxWidth: 380 }}>{v.why}</div>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right' as const, fontFamily: 'monospace', fontSize: 12, color: C.textMuted, verticalAlign: 'top' as const }}>{v.base.toFixed(3)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' as const, fontFamily: 'monospace', fontSize: 12, color: C.gold, fontWeight: 700, verticalAlign: 'top' as const }}>{v.full.toFixed(3)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' as const, fontFamily: 'monospace', fontSize: 12, color: C.teal, verticalAlign: 'top' as const }}>+{(v.full - v.base).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>Avg sequence lift (points)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>{summary.avgLiftAbs != null ? `${(summary.avgLiftAbs * 100).toFixed(1)}pp` : '—'}</div>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>{pitcherId ? pitchers.find(p => p.id === pitcherId)?.name : 'All Pitchers'} — Pitch-Level Scores</div>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, lineHeight: 1.5 }}>
            Showing up to 40, sorted by {sortMode === 'lift' ? 'how much sequence context changed the read vs. raw physics alone' : 'most recent'}. <b>pp = percentage points</b> — a Lift of +20pp means Stage 2's probability read 20 points higher than Stage 1's (e.g. 30% → 50%), not "20% higher."
          </div>
          <PitchList rows={filtered} showDate />
        </>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <select value={gamePk} onChange={e => setGamePk(e.target.value)} style={{ background: C.bg2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, minWidth: 320 }}>
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
        Data: MLB Stats API live-feed pitch tracking (pitch-level physics + sequence) and Baseball Savant's Swing Path/Attack Angle leaderboard (batter timing-adjustment profiles), scored by a two-stage XGBoost model (see scripts/train_stage1_model.py, train_stage2_model.py, score_all_pitches.py). Recomputed as a batch job after new games are pulled, not live per request.
      </div>
    </div>
  )
}
