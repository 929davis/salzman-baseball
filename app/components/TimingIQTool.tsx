'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/baseScenario'
import { buildSavantLink } from '@/lib/savantLink'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

type ScoreRow = {
  game_pk: number, game_date: string, at_bat_index: number, pitch_num_in_pa: number,
  pitcher_id: number, pitcher_name: string, batter_id: number, batter_name: string, batter_side: string,
  pitch_type: string, pitch_type_desc: string, start_speed: number, balls_before: number, strikes_before: number,
  call_description: string, is_swing: boolean, is_whiff: boolean,
  stage1_swing_prob: number, stage1_whiff_prob: number, stage2_swing_prob: number | null, stage2_whiff_prob: number | null,
  swing_lift: number | null, whiff_lift: number | null, top_shap_feature: string, insight_text: string,
  post_decision_break: number, decision_point_zone_mismatch: boolean, within_pa_expectation_deviation: number | null,
  release_deviation_from_own_baseline_ft: number | null, batter_intercept_point_range: number | null,
}

// Measured once during training/validation (train_stage2_model.py, holdout = most recent 15%
// of pulled games) -- not recomputed live, since there's no server-side Python inference in
// this app. Re-run that script and update these by hand if the model is retrained.
const VALIDATION = [
  { target: 'Swing vs. take', base: 0.693, full: 0.735 },
  { target: 'Whiff vs. contact (given a swing)', base: 0.656, full: 0.679 },
]

function pct(p: number | null) { return p == null ? '—' : `${(p * 100).toFixed(0)}%` }
function lift(v: number | null) {
  if (v == null) return null
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(0)}pp`
}
function liftColor(v: number | null) {
  if (v == null) return C.textDim
  return Math.abs(v) >= 0.15 ? C.gold : C.textMuted
}

export default function TimingIQTool() {
  const supabase = createClient()
  const [rows, setRows] = useState<ScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pitcherId, setPitcherId] = useState<string>('')
  const [sortMode, setSortMode] = useState<'lift' | 'recent'>('lift')

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

  const filtered = useMemo(() => {
    let list = pitcherId ? rows.filter(r => String(r.pitcher_id) === pitcherId) : rows
    list = [...list]
    if (sortMode === 'recent') {
      list.sort((a, b) => (b.game_date > a.game_date ? 1 : -1) || b.at_bat_index - a.at_bat_index)
    } else {
      const mag = (r: ScoreRow) => Math.max(Math.abs(r.swing_lift ?? 0), Math.abs(r.whiff_lift ?? 0))
      list.sort((a, b) => mag(b) - mag(a))
    }
    return list.slice(0, 40)
  }, [rows, pitcherId, sortMode])

  const summary = useMemo(() => {
    const scoped = pitcherId ? rows.filter(r => String(r.pitcher_id) === pitcherId) : rows
    const swingLifts = scoped.map(r => r.swing_lift).filter((v): v is number => v != null)
    const whiffLifts = scoped.map(r => r.whiff_lift).filter((v): v is number => v != null)
    const avg = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
    const avgAbs = (a: number[]) => a.length ? a.reduce((s, v) => s + Math.abs(v), 0) / a.length : null
    return {
      n: scoped.length,
      avgSwingLiftAbs: avgAbs(swingLifts),
      avgWhiffLiftAbs: avgAbs(whiffLifts),
    }
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

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Model Validation — Does Sequencing Actually Add Anything?</div>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, lineHeight: 1.5 }}>
        Two models per target: physics-only (pitch's own velocity/angle/movement, Stage 1) vs. physics + what the hitter had already seen this at-bat + this pitcher's own release-point norms + this hitter's own timing-adjustment profile (Stage 2). Measured on held-out games the models never trained on.
      </div>
      <div style={{ overflowX: 'auto' as const, marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: 420 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ textAlign: 'left' as const, padding: '8px 10px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Target</th>
              <th style={{ textAlign: 'right' as const, padding: '8px 10px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Stage 1 AUC</th>
              <th style={{ textAlign: 'right' as const, padding: '8px 10px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Stage 2 AUC</th>
              <th style={{ textAlign: 'right' as const, padding: '8px 10px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Lift</th>
            </tr>
          </thead>
          <tbody>
            {VALIDATION.map(v => (
              <tr key={v.target} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 10px', fontSize: 12, color: C.text }}>{v.target}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' as const, fontFamily: 'monospace', fontSize: 12, color: C.textMuted }}>{v.base.toFixed(3)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' as const, fontFamily: 'monospace', fontSize: 12, color: C.gold, fontWeight: 700 }}>{v.full.toFixed(3)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right' as const, fontFamily: 'monospace', fontSize: 12, color: C.teal }}>+{(v.full - v.base).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>Avg |sequence swing-lift|</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>{summary.avgSwingLiftAbs != null ? `${(summary.avgSwingLiftAbs * 100).toFixed(1)}pp` : '—'}</div>
        </div>
        <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>Avg |sequence whiff-lift|</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>{summary.avgWhiffLiftAbs != null ? `${(summary.avgWhiffLiftAbs * 100).toFixed(1)}pp` : '—'}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>{pitcherId ? pitchers.find(p => p.id === pitcherId)?.name : 'All Pitchers'} — Pitch-Level Scores</div>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, lineHeight: 1.5 }}>
        Showing up to 40, sorted by {sortMode === 'lift' ? 'how much sequence context changed the read vs. raw physics alone' : 'most recent'}. Stage 2 is blank for a PA's first pitch — no sequence exists yet to use.
      </div>
      <div style={{ overflowX: 'auto' as const }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Date', 'Matchup', 'Pitch', 'Count', 'Result', 'Stage 1', 'Stage 2', 'Lift', 'Why', ''].map(h => (
                <th key={h} style={{ textAlign: 'left' as const, padding: '8px 10px', fontSize: 10, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const target = r.is_swing ? 'whiff' : 'swing'
              const s1 = target === 'whiff' ? r.stage1_whiff_prob : r.stage1_swing_prob
              const s2 = target === 'whiff' ? r.stage2_whiff_prob : r.stage2_swing_prob
              const l = target === 'whiff' ? r.whiff_lift : r.swing_lift
              const link = buildSavantLink({
                dateGt: r.game_date, dateLt: r.game_date,
                batterStands: r.batter_side as 'R' | 'L',
                countBucket: `${r.balls_before}-${r.strikes_before}`,
                pitchType: r.pitch_type,
              })
              return (
                <tr key={`${r.game_pk}-${r.at_bat_index}-${r.pitch_num_in_pa}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' as const }}>{r.game_date}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: C.text }}>{r.pitcher_name} → {r.batter_name}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: C.text, whiteSpace: 'nowrap' as const }}>{r.pitch_type} {r.start_speed?.toFixed(1)}mph</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: C.textMuted }}>{r.balls_before}-{r.strikes_before}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: C.textMuted }}>{r.call_description}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', color: C.textMuted }}>{pct(s1)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{pct(s2)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', color: liftColor(l) }}>{lift(l) ?? '—'}</td>
                  <td style={{ padding: '8px 10px', fontSize: 10, color: C.textDim, maxWidth: 260 }}>{r.insight_text}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: C.blue, whiteSpace: 'nowrap' as const }}>Savant ↗</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 16 }}>
        Data: MLB Stats API live-feed pitch tracking (pitch-level physics + sequence) and Baseball Savant's Swing Path/Attack Angle leaderboard (batter timing-adjustment profiles), scored by a two-stage XGBoost model (see scripts/train_stage1_model.py, train_stage2_model.py, score_all_pitches.py). Recomputed as a batch job after new games are pulled, not live per request.
      </div>
    </div>
  )
}
