-- Question Radar (social tab, v1): pulls candidate content questions/claims from YouTube
-- (and later Reddit, gated on env credentials) into a coach-only review queue, clustered via
-- a manual copy-prompt/paste-back round trip through claude.ai (no in-app Claude API calls),
-- with a "send to ideas" path into a new radar_ideas table -- no idea-capture table existed
-- anywhere in this repo before this migration (confirmed by grep across sql/*.sql and every
-- supabase.from(...) call in app/ and lib/).
--
-- Deliberately does NOT store commenter names, handles, or channel IDs of commenters --
-- keeps this out of "personal data" territory under YouTube's API Services Terms entirely.
-- Comment/post text and public video/channel metadata are the only content stored.
--
-- 30-day retention: YouTube's API Services Terms require non-authorized data (this is
-- API-key access, not per-user OAuth) be deleted or refreshed within 30 calendar days of
-- storage. There is no cron for this app (v1 scope is a manual refresh button only), so
-- app/api/radar/refresh purges radar_items older than 30 days as the first step of every
-- refresh run, before fetching anything new -- compliance piggybacks on the coach's own
-- manual action instead of needing a scheduled job.
--
-- Coach-only RLS on every table here (select AND write), which is new for this repo -- every
-- existing table either does "authenticated select, coach write" (athlete_state.sql) or
-- "owner-or-coach select, coach write" (sql/rls_pitcher_isolation.sql). This is the first
-- table set with no pitcher-facing read path at all, since Question Radar is a coach-only
-- content-research tool with nothing for a pitcher account to see.

create table if not exists radar_sources (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('youtube_query', 'youtube_channel', 'subreddit')),
  value text not null,           -- the search query, channel ID, or subreddit name
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists radar_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references radar_sources(id) on delete cascade,
  source_url text not null unique,   -- de-dup key: re-running refresh never creates duplicates
  text text not null,
  kind text not null check (kind in ('question', 'claim')),
  engagement_count int,
  video_or_post_title text,
  fetched_at timestamptz not null default now(),
  cluster_label text,                -- nullable; set via the copy-prompt/paste-back round trip
  status text not null default 'new',
  created_at timestamptz default now()
);

-- One row per day. youtube_search_calls_used tracks search.list specifically, which as of
-- 2026 has its own separate 100-calls/day bucket, distinct from the general 10,000-unit pool
-- youtube_units_used tracks (commentThreads.list, channels.list, playlistItems.list all draw
-- from the general pool at 1 unit/call). Confirmed against Google's own quota docs, not
-- assumed from the old (pre-2026) single-pool model.
create table if not exists radar_api_usage (
  date date primary key,
  youtube_units_used int not null default 0,
  youtube_search_calls_used int not null default 0
);

create table if not exists radar_ideas (
  id uuid primary key default gen_random_uuid(),
  radar_item_id uuid references radar_items(id) on delete set null,
  text text not null,
  source text not null default 'question_radar',
  status text not null default 'new',
  created_at timestamptz default now()
);

alter table radar_sources enable row level security;
alter table radar_items enable row level security;
alter table radar_api_usage enable row level security;
alter table radar_ideas enable row level security;

create policy "radar_sources coach select" on radar_sources
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));
create policy "radar_sources coach write" on radar_sources
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "radar_items coach select" on radar_items
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));
create policy "radar_items coach write" on radar_items
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "radar_api_usage coach select" on radar_api_usage
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));
create policy "radar_api_usage coach write" on radar_api_usage
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));

create policy "radar_ideas coach select" on radar_ideas
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));
create policy "radar_ideas coach write" on radar_ideas
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'coach'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'coach'));
