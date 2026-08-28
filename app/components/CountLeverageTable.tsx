'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { meanCI, countLeverageBallBucket, countLeverageStrikeBucket, COUNT_ORDER, MIN_RENDER_N } from '@/lib/baseScenario'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',teal:'#39d353',red:'#f85149',blue:'#58a6ff',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

export default function CountLeverageTable(){
  const supabase = createClient()
  const [rows,setRows] = useState<any[]>([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    let cancelled = false
    supabase.from('bs_count_leverage').select('*').then(({data})=>{
      if (cancelled) return
      setRows(data||[])
      setLoading(false)
    })
    return ()=>{cancelled=true}
  },[])

  if (loading) return <div style={{textAlign:'center' as const,padding:30,color:C.textMuted,fontSize:13}}>Loading...</div>

  const byCount = Object.fromEntries(rows.map(r=>[r.count_bucket,r]))
  const computed = COUNT_ORDER.map(count=>{
    const row = byCount[count]
    if (!row) return {count, ball:null, strike:null, swing:null}
    const ballB = countLeverageBallBucket(row), strikeB = countLeverageStrikeBucket(row)
    const ball = meanCI(ballB.n, ballB.sum, ballB.sumSq)
    const strike = meanCI(strikeB.n, strikeB.sum, strikeB.sumSq)
    const swing = (ball && strike) ? ball.mean - strike.mean : null
    return {count, ball, strike, swing}
  })
  const maxSwing = Math.max(...computed.map(c=>c.swing||0))

  return (
    <div style={{color:C.text,fontSize:13}}>
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:4}}>Count Leverage</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:6,lineHeight:1.6}}>
        How much is riding on the next pitch at each count — the run-value swing between it going as a ball vs. a strike. Higher swing = more worth fighting for. 2026 season-to-date, league-wide.
      </div>
      <div style={{fontSize:10,color:C.textDim,marginBottom:16,lineHeight:1.6}}>
        "Ball value" combines plain balls with walks (a ball at 3-0 is a walk — same underlying event). "Strike value" combines called strikes, swinging strikes, and strikeouts, but not fouls (a foul doesn't end the at-bat or advance the count at 2 strikes, so it isn't a clean ball-vs-strike comparison). Positive = favors the batting team, negative = favors the pitcher. Shaded bands are 95% confidence intervals.
      </div>

      <div style={{overflowX:'auto' as const}}>
        <table style={{width:'100%',borderCollapse:'collapse' as const,minWidth:560}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${C.border}`}}>
              <th style={{textAlign:'left' as const,padding:'8px 10px',fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Count</th>
              <th style={{textAlign:'right' as const,padding:'8px 10px',fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Ball Value</th>
              <th style={{textAlign:'right' as const,padding:'8px 10px',fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Strike Value</th>
              <th style={{textAlign:'left' as const,padding:'8px 10px',fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Swing (Leverage)</th>
            </tr>
          </thead>
          <tbody>
            {computed.map(c=>(
              <tr key={c.count} style={{borderBottom:`1px solid ${C.border}`}}>
                <td style={{padding:'10px',fontWeight:700,color:C.white,fontFamily:'monospace'}}>{c.count}</td>
                <td style={{padding:'10px',textAlign:'right' as const}}>
                  {c.ball && c.ball.n>=MIN_RENDER_N ? (
                    <div>
                      <span style={{color:C.teal,fontWeight:600}}>{c.ball.mean>=0?'+':''}{c.ball.mean.toFixed(3)}</span>
                      <div style={{fontSize:9,color:C.textDim}}>[{c.ball.lower.toFixed(3)}, {c.ball.upper.toFixed(3)}] · n={c.ball.n.toLocaleString()}</div>
                    </div>
                  ) : <span style={{color:C.textDim,fontSize:11}}>insufficient sample{c.ball?` (n=${c.ball.n})`:''}</span>}
                </td>
                <td style={{padding:'10px',textAlign:'right' as const}}>
                  {c.strike && c.strike.n>=MIN_RENDER_N ? (
                    <div>
                      <span style={{color:C.red,fontWeight:600}}>{c.strike.mean.toFixed(3)}</span>
                      <div style={{fontSize:9,color:C.textDim}}>[{c.strike.lower.toFixed(3)}, {c.strike.upper.toFixed(3)}] · n={c.strike.n.toLocaleString()}</div>
                    </div>
                  ) : <span style={{color:C.textDim,fontSize:11}}>insufficient sample{c.strike?` (n=${c.strike.n})`:''}</span>}
                </td>
                <td style={{padding:'10px'}}>
                  {c.swing!=null ? (
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{flex:1,height:14,background:C.bg3,borderRadius:4,overflow:'hidden' as const,maxWidth:160}}>
                        <div style={{width:`${(c.swing/maxSwing)*100}%`,height:'100%',background:C.gold,borderRadius:4}}/>
                      </div>
                      <span style={{fontWeight:700,color:C.gold,fontFamily:'monospace',minWidth:50}}>{c.swing.toFixed(3)}</span>
                    </div>
                  ) : <span style={{color:C.textDim,fontSize:11}}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
