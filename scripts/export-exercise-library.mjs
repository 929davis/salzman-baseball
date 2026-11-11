// Exports the FULL exercise library exactly as the coach page sees it: built-in exercises
// (from BUILT_IN_EXERCISES in app/coach/page.tsx) + custom_exercises + exercise_overrides from
// Supabase, merged the same way EXERCISE_DB is (override fields win). Every field is included,
// descriptions too.
//
// Usage: node --env-file=.env.local scripts/export-exercise-library.mjs
// Writes exports/exercise-library-<date>.csv and .json (the exports/ folder is created if needed).

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function loadBuiltIns() {
  const src = fs.readFileSync(path.join(ROOT, 'app', 'coach', 'page.tsx'), 'utf8')
  const start = src.indexOf('const BUILT_IN_EXERCISES = [')
  if (start < 0) throw new Error('BUILT_IN_EXERCISES not found in app/coach/page.tsx')
  const open = src.indexOf('[', start)
  const end = src.indexOf('\n]', open)
  const arrayText = src.slice(open, end + 2)
  return new Function(`return ${arrayText}`)()
}

const csvCell = v => {
  if (v == null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) throw new Error('Run with: node --env-file=.env.local scripts/export-exercise-library.mjs')
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  const builtIns = loadBuiltIns().map(e => ({ ...e, source: 'built-in' }))
  const { data: custom, error: ce } = await supabase.from('custom_exercises').select('*').order('created_at')
  if (ce) throw new Error(`custom_exercises: ${ce.message}`)
  const { data: ovs, error: oe } = await supabase.from('exercise_overrides').select('*')
  if (oe) throw new Error(`exercise_overrides: ${oe.message}`)

  const overrides = Object.fromEntries((ovs || []).map(o => [o.exercise_id, o]))
  const customs = (custom || []).map(c => ({ ...c, id: c.exercise_id, source: 'custom' }))

  const all = [...builtIns, ...customs].map(ex => {
    const ov = overrides[ex.id]
    if (!ov) return ex
    const { exercise_id, id: _id, created_at, ...fields } = ov
    return { ...ex, ...fields, overridden: true }
  })

  const cols = ['id', 'name', 'category', 'cns', 'pattern', 'description', 'source', 'overridden', 'movement_category', 'equipment_tier', 'deprecated', 'throwing_phase', 'ground_contacts_per_rep']
  const extra = [...new Set(all.flatMap(e => Object.keys(e)))].filter(k => !cols.includes(k) && !['exercise_id', 'created_at', 'user_id'].includes(k))
  const header = [...cols, ...extra]
  all.sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name)))

  const outDir = path.join(ROOT, 'exports')
  fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const csvPath = path.join(outDir, `exercise-library-${stamp}.csv`)
  const jsonPath = path.join(outDir, `exercise-library-${stamp}.json`)
  fs.writeFileSync(csvPath, '﻿' + [header.join(','), ...all.map(e => header.map(h => csvCell(e[h])).join(','))].join('\n') + '\n')
  fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2))

  const noDesc = all.filter(e => !e.description || !String(e.description).trim()).length
  console.log(`${all.length} exercises (${builtIns.length} built-in, ${customs.length} custom, ${Object.keys(overrides).length} overrides applied); ${noDesc} without a description`)
  console.log(csvPath)
  console.log(jsonPath)
}

main().catch(err => { console.error(err); process.exit(1) })
