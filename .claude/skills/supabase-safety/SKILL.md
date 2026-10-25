---
name: supabase-safety
description: "Checklist-driven safety review for anything touching this project's Supabase database or auth: new or edited .sql files, migrations, RLS policies, new tables, authentication checks (supabase.auth.getUser()), authorization gates (coach vs. pitcher role checks, in API routes or pages), or any change to how data is read, written, or protected. Load before writing or reviewing SQL migrations, RLS policy changes, Supabase client auth code, or server-side authorization logic in this repo. Also load when asked to run SQL against Supabase, change a database schema, or verify RLS. Not for application logic that doesn't touch Supabase, a database table, or an auth/role check."
---

## When this applies

Any of: a new or modified file under `sql/`, a Supabase migration, a `CREATE POLICY` / `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statement, a new or changed Supabase table, a `supabase.auth.getUser()` check, a `profiles.role` gate, an API route that reads or writes Supabase data, or a request to run SQL against the live project.

## Hard rule

**Never execute SQL against the live Supabase project, and never claim a live check (RLS, row counts, migration result) occurred unless it actually did, this session, against the real database.** Writing and reviewing a migration file is not the same as running it. If asked to run one, confirm the user has explicitly approved that specific run before doing anything beyond preparing the file.

## RLS checklist

- Every new table gets `alter table <name> enable row level security;` in the same migration that creates it — don't leave a window where the table exists without RLS enabled (this repo has a documented prior incident of exactly that gap: `sql/enable_rls_open_tables.sql`).
- Default-deny: a policy scoped `to authenticated` means an anonymous/anon-key caller matches no policy and sees nothing — confirm that's actually the intended behavior for the table, don't assume it.
- Match this repo's existing coach-only idiom unless there's a stated reason to deviate:
  ```sql
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  ```
  (see `sql/question_radar.sql`, `sql/athlete_state.sql`, `sql/ideas.sql`). A pitcher-owns-their-own-row table instead uses `pitcher_id = auth.uid() or <coach-exists-clause>` (see `sql/rls_pitcher_isolation.sql`) — pick the one that matches who should actually read/write the row, not whichever is easiest to paste.
- State explicitly, in the migration's own comments, which of select/insert/update/delete each policy covers (`for select` vs `for all`) — don't let "write access" be ambiguous.
- After any RLS change, the verification that actually matters is empirical: an unauthenticated request, a correctly-scoped authenticated request, and a wrongly-scoped authenticated request (e.g. pitcher on a coach-only table) should be checked against the real behavior, not just read off the policy text. Flag this as outstanding if it hasn't been done live.

## Server-side authentication and authorization gates

- Every API route that touches a protected table re-checks auth itself — RLS is the real backstop, but a route should still fail fast with a clear status before it gets anywhere near a query: `401` for no session, `403` for wrong role. Match the existing pattern:
  ```ts
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'coach') return Response.json({ error: 'Coach access only.' }, { status: 403 })
  ```
  (see `app/api/radar/refresh/route.ts`, `app/api/ideas/triage/route.ts`).
- A page-level redirect (e.g. `if (profile?.role !== 'coach') router.push('/pitcher')`) is a UX convenience, never a security boundary — it runs client-side and doesn't stop a direct Supabase call. Don't describe it as "enforcing" access; RLS and the API route's own check are what actually enforce it.
- Never let a secret (service key, API key) reach client-side code. This repo's convention: server-only secrets are read with `process.env.X` only inside files that never ship to the browser (API routes, server components, `lib/supabase/server.ts`), and the file's own leading comment states that explicitly (e.g. "Server-only. ANTHROPIC_API_KEY never reaches the browser").

## Data protection

- Never print, log, or echo a secret value (API keys, service role key, tokens) — confirm presence/absence only (`process.env.X ? 'set' : 'missing'`), never the value itself, including in error messages returned to the client.
- Check constraints at the database level for anything a UI's own validation might not catch (e.g. non-empty title, valid status enum) — client-side validation is a UX nicety, the `check (...)` constraint is the actual guarantee.
- Don't duplicate a source of truth across two tables/pipelines without a stated reason — this repo already has one documented case of two independent Statcast ingestion paths silently diverging in what columns they capture; treat that as a cautionary example, not a pattern to repeat.

## Migration rerun-safety

A migration should be safe to run more than once without manual cleanup first. Specifically:

- Wrap the whole file in `begin; ... commit;` so a failure partway through rolls back everything, rather than leaving a half-applied table/policy state.
- `create table if not exists` is already idempotent; `CREATE POLICY` is NOT (Postgres has no `IF NOT EXISTS` for policies) — always precede it with `drop policy if exists "<name>" on <table>;`.
- Any migration `INSERT` that copies rows from another table needs a real dedup key. Prefer reusing the source row's own `id` as the destination row's `id` and using `on conflict (id) do nothing` — this is simpler and more robust than a `NOT EXISTS` subquery keyed on a nullable foreign key.
- Check constraints can abort an entire multi-row `INSERT ... SELECT` if even one source row violates one (e.g. an empty/whitespace value hitting a non-empty check). Handle that in the `SELECT` itself (a `coalesce`/`nullif` fallback), not by weakening the constraint.
- Never drop or destructively modify a table a migration is superseding unless explicitly asked — leave it in place, inert, so the change stays reversible (see `sql/ideas.sql`'s treatment of `radar_ideas`).

## Before reporting a migration "ready"

State plainly which of the following you have actually done vs. only reasoned about from reading the code: (1) ran it against a real database, (2) verified RLS empirically with real anon/coach/pitcher sessions, (3) confirmed row counts/data integrity post-migration. Anything not actually done gets listed as outstanding, not implied as covered.
