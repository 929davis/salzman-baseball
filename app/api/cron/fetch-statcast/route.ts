import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

function getYesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function classifyArmAngle(angle: number | null): string {
  if (angle === null || isNaN(angle)) return 'unknown'
  if (angle < 0)  return 'submarine'
  if (angle < 16) return 'sidearm'
  if (angle < 31) return 'low_three_quarter'
  if (angle < 50) return 'three_quarter'
  if (angle < 63) return 'high_three_quarter'
  return 'overhand'
}

function classifyCount(balls: number, strikes: number): string {
  if (strikes === 2 && balls === 0) return '0-2'
  if (strikes === 2 && balls === 1) return '1-2'
  if (strikes === 2 && balls === 2) return '2-2'
  if (strikes === 2 && balls === 3) return '3-2'
  if (balls === strikes) return 'even'
  if (strikes > balls) return 'ahead'
  return 'behind'
}

function parseCSVLine(line: string): string[] {
  const row: string[] = []
  let inQuote = false
  let current = ''
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote }
    else if (ch === ',' && !inQuote) { row.push(current); current = '' }
    else { current += ch }
  }
  row.push(current)
  return row
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = getYesterdayDate()

  // Baseball Savant CSV - swings and contact only, 2026 season
  const savantUrl = [
    'https://baseballsavant.mlb.com/statcast_search/csv',
    '?all=true',
    '&hfSea=2026%7C',
    `&game_date_gt=${date}`,
    `&game_date_lt=${date}`,
    '&player_type=pitcher',
    '&hfAB=swinging_strike%7Cswinging_strike_blocked%7Chit_into_play%7Chit_into_play_no_out%7Chit_into_play_score%7C',
    '&type=details',
  ].join('')

  let csvText: string
  try {
    const res = await fetch(savantUrl, {
      headers: { 'User-Agent': 'salzman-baseball-app/1.0' },
      signal: AbortSignal.timeout(55000),
    })
    if (!res.ok) throw new Error(`Savant returned ${res.status}`)
    csvText = await res.text()
  } catch (err) {
    console.error('Savant fetch failed:', err)
    return NextResponse.json({ error: 'Savant fetch failed', detail: String(err) }, { status: 500 })
  }

  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    return NextResponse.json({ message: 'No games yesterday', date })
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

  function col(row: string[], name: string): string {
    const i = headers.indexOf(name)
    return i >= 0 ? (row[i] || '').replace(/"/g, '').trim() : ''
  }
  function num(val: string): number | null {
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }
  function int(val: string): number | null {
    const n = parseInt(val)
    return isNaN(n) ? null : n
  }

  const rows: object[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const row = parseCSVLine(line)
    const balls   = int(col(row, 'balls')) ?? 0
    const strikes = int(col(row, 'strikes')) ?? 0
    const armAngle = num(col(row, 'arm_angle'))

    rows.push({
      game_date:         col(row, 'game_date'),
      player_name:       col(row, 'player_name'),
      pitcher_id:        int(col(row, 'pitcher')),
      p_throws:          col(row, 'p_throws'),
      bats:              col(row, 'stand'),
      pitch_type:        col(row, 'pitch_type'),
      release_speed:     num(col(row, 'release_speed')),
      release_spin_rate: num(col(row, 'release_spin_rate')),
      pfx_x:             num(col(row, 'pfx_x')),
      pfx_z:             num(col(row, 'pfx_z')),
      plate_x:           num(col(row, 'plate_x')),
      plate_z:           num(col(row, 'plate_z')),
      zone:              int(col(row, 'zone')),
      description:       col(row, 'description'),
      events:            col(row, 'events'),
      launch_speed:      num(col(row, 'launch_speed')),
      launch_angle:      num(col(row, 'launch_angle')),
      estimated_woba:    num(col(row, 'estimated_woba_using_speedangle')),
      barrel:            col(row, 'barrel') === '1',
      arm_angle:         armAngle,
      arm_angle_bucket:  classifyArmAngle(armAngle),
      balls,
      strikes,
      count_bucket:      classifyCount(balls, strikes),
      inning:            int(col(row, 'inning')),
    })
  }

  if (rows.length === 0) {
    return NextResponse.json({ message: 'No qualifying pitches found', date })
  }

  // Use service role key so we can insert without RLS restrictions
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const BATCH = 500
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase
      .from('statcast_pitches')
      .insert(batch)

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: 'DB insert failed', detail: error.message }, { status: 500 })
    }
    inserted += batch.length
  }

  return NextResponse.json({
    success: true,
    date,
    pitches_inserted: inserted,
  })
}
