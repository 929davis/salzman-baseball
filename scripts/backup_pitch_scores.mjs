// Exports the live pitch_sequence_scores table (what Timing IQ reads) to a timestamped,
// gzipped CSV in backups/ BEFORE any re-score/upload touches it. Pages through the table with
// the service key so RLS can't hide rows.
//
// Usage: node --env-file=.env.local scripts/backup_pitch_scores.mjs
// Restore (if ever needed): gunzip the file, then load it with upload_pitch_scores.mjs's row
// shape -- the columns are the table's own columns, unchanged.

import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'backups')
const TABLE = 'pitch_sequence_scores'
const PAGE = 1000

function csvEscape(v) {
  if (v == null) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set -- run with: node --env-file=.env.local scripts/backup_pitch_scores.mjs')
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  const { count, error: countErr } = await supabase.from(TABLE).select('*', { count: 'exact', head: true })
  if (countErr) throw new Error(`count: ${countErr.message}`)
  console.log(`${TABLE}: ${count} rows in the live table`)

  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(TABLE).select('*').order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(`page ${from}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  if (rows.length !== count) throw new Error(`fetched ${rows.length} rows but the table reports ${count} -- refusing to write a partial backup`)

  const cols = Object.keys(rows[0] ?? {})
  const lines = [cols.join(',')]
  for (const r of rows) lines.push(cols.map(c => csvEscape(r[c])).join(','))
  const csv = lines.join('\n') + '\n'

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outPath = path.join(OUT_DIR, `${TABLE}_${stamp}.csv.gz`)
  fs.writeFileSync(outPath, zlib.gzipSync(Buffer.from(csv, 'utf8')))
  const stat = fs.statSync(outPath)
  console.log(`wrote ${outPath} (${rows.length} rows, ${cols.length} columns, ${(stat.size / 1024 / 1024).toFixed(1)} MB gzipped)`)

  // Read-back check: the gzipped file must decompress to the same number of data lines.
  const back = zlib.gunzipSync(fs.readFileSync(outPath)).toString('utf8').split('\n').filter(Boolean)
  if (back.length - 1 !== rows.length) throw new Error(`read-back mismatch: ${back.length - 1} lines vs ${rows.length} rows`)
  console.log('read-back OK')
}

main().catch(err => { console.error(err); process.exit(1) })
