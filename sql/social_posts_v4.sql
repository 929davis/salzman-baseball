-- Caches real Instagram engagement stats (likes/comments/saves/shares) for published posts.
-- Fetched on demand (coach clicks "Load Stats" / "Refresh Stats"), not automatically -- this
-- app never calls Meta's API without an explicit click.
alter table social_posts add column if not exists stats jsonb;
