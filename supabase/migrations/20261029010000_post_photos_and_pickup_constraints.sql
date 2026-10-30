-- Limit listing photos to the agreed formats and size, and keep uploads in the donor's path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-photos', 'food-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public_read_food_photos" on storage.objects;
create policy "public_read_food_photos" on storage.objects
  for select using (bucket_id = 'food-photos');

drop policy if exists "auth_upload_food_photos" on storage.objects;
drop policy if exists "food_photo_insert_own_folder" on storage.objects;
create policy "food_photo_insert_own_folder" on storage.objects
  for insert with check (
    bucket_id = 'food-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "food_photo_delete_own_folder" on storage.objects;
create policy "food_photo_delete_own_folder" on storage.objects
  for delete using (
    bucket_id = 'food-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter table public.food_posts
  drop constraint if exists food_posts_pickup_lat_range,
  drop constraint if exists food_posts_pickup_lng_range,
  drop constraint if exists food_posts_live_pickup_coordinates;

alter table public.food_posts
  add constraint food_posts_pickup_lat_range
    check (pickup_lat is null or pickup_lat between -90 and 90),
  add constraint food_posts_pickup_lng_range
    check (pickup_lng is null or pickup_lng between -180 and 180),
  add constraint food_posts_live_pickup_coordinates
    check (status not in ('active', 'fully_claimed') or (pickup_lat is not null and pickup_lng is not null));
