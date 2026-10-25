-- Unified Ideas table (Salzman Baseball OS, Phase 1).
--
-- DECISION: supersede radar_ideas (sql/question_radar.sql) with a single `ideas` table,
-- rather than extending radar_ideas in place or running two tables side by side.
--
-- Why not extend radar_ideas: it has one content column (`text`) and a bare `status` with
-- no check constraint. Phase 1 needs a separate title/details, a wider status lifecycle, and
-- 8 new AI-triage columns. Bolting all of that onto a table named for one specific source
-- (Question Radar) would leave a business-wide ideas table permanently named after a single
-- feed into it, which is confusing to any future reader -- this repo's own SQL comments
-- consistently explain naming/scope for exactly that reason (see question_radar.sql itself).
--
-- Why not two tables: the spec asks for "the smallest design that supports both manually
-- captured ideas and ideas originating from Question Radar." One table with a `source` enum
-- is that smallest design -- not a join, not a second table to keep in sync.
--
-- Migration safety: radar_ideas' existing rows are copied forward below. The radar_ideas
-- TABLE ITSELF IS NOT DROPPED OR MODIFIED here -- only app/social/radar/page.tsx's write site
-- is repointed (separate code change) to insert into `ideas` going forward. radar_ideas is
-- left in place, inert, so this migration is reversible. Drop it manually later once the
-- migrated rows in `ideas` are confirmed correct in the Supabase dashboard -- not automated.
--
-- RERUN SAFETY (fixed after a preflight review flagged the original version as not safely
-- rerunnable):
--   1. The whole script runs inside one explicit transaction (BEGIN/COMMIT), so a failure on
--      any statement rolls back everything in this file, instead of leaving the table
--      created but some policies missing, or similar partial states, regardless of how the
--      SQL client that runs this happens to batch statements.
--   2. Policies are dropped-if-exists immediately before being recreated -- Postgres has no
--      `CREATE POLICY IF NOT EXISTS`, so this is the standard idempotent substitute.
--   3. The migration INSERT reuses each radar_ideas row's own `id` as the new `ideas.id`
--      (instead of generating a fresh one) and relies on `ON CONFLICT (id) DO NOTHING` --
--      a plain, standard dedup key, instead of the previous version's NOT EXISTS guard keyed
--      on radar_item_id (which didn't handle re-running as cleanly and didn't address the
--      blank-text issue below). Reusing the original id also means every migrated row has a
--      stable, traceable identity across both tables.
--   4. A blank/whitespace-only radar_ideas.text no longer aborts the entire INSERT: the new
--      `title` column still requires a non-empty value (see its check constraint below), but
--      the migration now falls back to a placeholder title for that one row instead of
--      letting the constraint violation fail the whole multi-row INSERT statement. The
--      original (blank) text is still preserved verbatim in `details`.
--
-- Run this once, by hand, in the Supabase SQL editor (see audit: no migration runner exists
-- in this repo, and this script does not execute itself). Safe to run again later -- every
-- statement below is now idempotent.

begin;

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),

  title text not null check (char_length(trim(title)) > 0),
  details text not null default '',

  source text not null default 'manual' check (source in ('manual', 'question_radar')),
  radar_item_id uuid references radar_items(id) on delete set null,

  status text not null default 'new' check (status in ('new', 'triaged', 'approved', 'rejected', 'in_progress')),

  -- AI triage output. All nullable until a triage run succeeds -- only
  -- app/api/ideas/triage/route.ts (via lib/ideas.ts's runTriage) ever writes these columns.
  -- Coarse low/medium/high buckets, not numbers, on purpose -- see lib/ideas.ts's prompt
  -- comment: a one-paragraph idea doesn't support a fabricated-precise dollar/hour estimate.
  ai_category text check (ai_category in ('content', 'research', 'product', 'business')),
  ai_time_saving text check (ai_time_saving in ('low', 'medium', 'high')),
  ai_revenue_potential text check (ai_revenue_potential in ('low', 'medium', 'high')),
  ai_research_needed boolean,
  ai_research_notes text,
  ai_recommended_action text,
  ai_rationale text,
  ai_confidence text check (ai_confidence in ('low', 'medium', 'high')),
  ai_triaged_at timestamptz,
  ai_triage_error text,  -- last triage failure message, if any; cleared on the next success --
                         -- lets the UI show "Retry triage" without losing the original idea

  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ideas enable row level security;

-- Coach-only, matching every other business-ops table in this repo (question_radar.sql,
-- athlete_state.sql) -- idea intake/triage/approval has no pitcher-facing read path, same
-- reasoning as Question Radar. Verify this empirically after running the migration: an
-- unauthenticated request and a pitcher-role account should both see zero rows.
drop policy if exists "ideas coach select" on ideas;
create policy "ideas coach select" on ideas
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

drop policy if exists "ideas coach write" on ideas;
create policy "ideas coach write" on ideas
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

-- One-time forward migration of radar_ideas' existing rows, safe to run more than once:
-- reuses each source row's own `id`, so a repeat run's ON CONFLICT (id) DO NOTHING simply
-- skips rows already migrated -- no duplicates, regardless of how many times this is run.
--
-- Title fallback: derives a title the same way lib/ideas.ts's deriveTitleFromText does
-- (trim, then truncate to 80 chars with an ellipsis if longer) -- but if `text` is blank or
-- all whitespace, that derivation produces an empty string, which would violate `title`'s
-- non-empty check constraint and abort this entire multi-row INSERT for every row, not just
-- the offending one. The nullif/coalesce below substitutes a clearly-labeled placeholder for
-- that one row instead -- `details` still gets the real (blank) original text, unchanged.
insert into ideas (id, title, details, source, radar_item_id, status, created_at)
select
  r.id,
  coalesce(
    nullif(
      case
        when length(trim(r.text)) > 80 then left(trim(r.text), 77) || '...'
        else trim(r.text)
      end,
      ''
    ),
    '(untitled idea from Question Radar)'
  ),
  r.text,
  'question_radar',
  r.radar_item_id,
  case when r.status in ('new','triaged','approved','rejected','in_progress') then r.status else 'new' end,
  r.created_at
from radar_ideas r
on conflict (id) do nothing;

commit;
