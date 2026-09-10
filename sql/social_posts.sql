create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  source_text text not null,
  caption text,
  status text not null default 'draft' check (status in ('draft', 'published', 'failed')),
  ig_media_id text,
  -- Instagram post URLs use a shortcode (instagram.com/p/<shortcode>), which media_publish's
  -- response does not include -- only the numeric media id. Fetched with one extra Graph API
  -- call right after a successful publish (see app/api/social/publish/route.ts) so the UI has
  -- a real, working link rather than a guessed one. Not in the original spec's column list;
  -- added because "link to the live IG post" isn't constructible from ig_media_id alone.
  permalink text,
  error text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

alter table social_posts enable row level security;

-- Coach-side only -- athletes never touch this table. The public card route
-- (app/api/social/card/[id]/route.tsx) deliberately does NOT use these policies: it has no
-- user session to authenticate (Instagram's servers fetch it directly), so it reads via the
-- service-role key, which bypasses RLS entirely. Do not add an `anon` policy here to work
-- around that -- the service-role key is the correct and only way that route should read
-- this table.
create policy "coach select" on social_posts for select to authenticated using (true);
create policy "coach insert" on social_posts for insert to authenticated with check (true);
create policy "coach update" on social_posts for update to authenticated using (true) with check (true);
