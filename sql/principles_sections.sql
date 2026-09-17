-- Step 1 of the coaching-logic rebuild: splits the single 39k-char `principles.content`
-- blob into addressable sections, so buildPrompt() (app/coach/page.tsx) can inject only what's
-- relevant to a given pitcher instead of the entire doc. The rewritten principles doc this is
-- meant to hold is ~140k chars -- full-blob injection is no longer viable at that size.
--
-- The existing `principles` table/row is left untouched by this migration -- it keeps
-- powering parsePrinciples()/lookupPrescription() (the exercise-prescription auto-suggest
-- feature) exactly as it does today. Cutover happens later, after this table is verified.
create table if not exists principles_sections (
  id uuid primary key default gen_random_uuid(),
  -- Which document this section belongs to. Check constraint kept loose enough to extend
  -- (a third doc later) without a migration, but the two known values are pinned here so a
  -- typo'd doc name fails loudly instead of silently creating an orphaned third bucket.
  doc text not null check (doc in ('strength', 'throwing')),
  section_number text not null, -- e.g. '4.2', '13.5' -- free text, not numeric (dotted outline numbering)
  title text not null,
  body text not null, -- markdown
  -- Always injected into the program-writing prompt regardless of athlete context (see
  -- selectPrinciplesSections in lib/principlesSections.ts). Everything else is only included
  -- when its tags match the athlete's current context.
  is_engine_rule boolean not null default false,
  tags text[] not null default '{}',
  sort_order integer not null,
  updated_at timestamptz default now()
);

-- Serves both the coach editor's grouped-by-doc listing and buildPrompt's section selection --
-- both always fetch/order by (doc, sort_order).
create index if not exists principles_sections_doc_sort_idx on principles_sections (doc, sort_order);

alter table principles_sections enable row level security;

-- Any logged-in user can read (athletes have no read path today, but nothing here is
-- coach-only content by nature -- matches the task's "authenticated read" spec). Anon is
-- deliberately NOT granted a policy at all -- do not add one. See the audit's RLS section for
-- why several other tables ended up unintentionally anon-readable; this table should not join
-- that list.
create policy "principles_sections authenticated select" on principles_sections
  for select to authenticated using (true);

-- Write access requires the caller's own profiles row to have role = 'coach'. Unlike the
-- blanket "authenticated ... using (true)" write policies on older tables in this schema
-- (e.g. social_posts.sql), this is the first table that actually needs to distinguish coach
-- from pitcher at the RLS layer, since pitchers can already read this table but must not be
-- able to edit programming rules.
create policy "principles_sections coach insert" on principles_sections
  for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "principles_sections coach update" on principles_sections
  for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "principles_sections coach delete" on principles_sections
  for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));
