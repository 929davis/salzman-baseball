-- Adds a "Photo Post" mode: real uploaded photo(s) + a caption, no generated card involved.
-- Run this in the Supabase SQL Editor (same place as the previous social_posts SQL files).

-- Public bucket -- Meta's crawler needs to fetch these photos directly with no auth, same
-- requirement as the generated card images already used by single/thread posts.
insert into storage.buckets (id, name, public)
values ('social-photos', 'social-photos', true)
on conflict (id) do nothing;

-- Only the coach can upload or remove photos. Reads don't need a policy -- the bucket is
-- public, so Supabase already serves objects to anyone via their URL regardless of RLS.
create policy "coach upload social photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'social-photos');

create policy "coach delete social photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'social-photos');

-- 'photo_urls' holds the real, already-public photo URLs for this post (1 photo = posts as a
-- single image; 2-10 = posts as a carousel), analogous to 'segments' for thread posts.
alter table social_posts
  add column if not exists photo_urls jsonb;

alter table social_posts drop constraint if exists social_posts_post_type_check;
alter table social_posts add constraint social_posts_post_type_check check (post_type in ('single', 'thread', 'photo'));
