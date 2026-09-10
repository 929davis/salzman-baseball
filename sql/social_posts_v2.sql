-- Adds thread/carousel support and a delete policy to social_posts.
-- Run this AFTER sql/social_posts.sql (which created the table). Existing single-image posts
-- are unaffected: post_type defaults to 'single' and segments stays null for them.

alter table social_posts
  add column if not exists post_type text not null default 'single' check (post_type in ('single', 'thread')),
  add column if not exists segments jsonb;

-- 'segments' holds the thread's individual tweet-sized parts as a JSON array of strings, e.g.
-- ["First part...", "Second part...", ...] -- one per carousel slide. Null/unused for
-- post_type = 'single', where source_text is the whole card text as before.

-- Delete wasn't in the original policy set -- needed now so old drafts can be removed.
create policy "coach delete" on social_posts for delete to authenticated using (true);
