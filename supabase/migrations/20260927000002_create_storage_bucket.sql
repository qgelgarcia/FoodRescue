-- Create food-photos storage bucket and policies

insert into storage.buckets (id, name, public)
values ('food-photos', 'food-photos', true)
on conflict (id) do nothing;

drop policy if exists "public_read_food_photos" on storage.objects;
create policy "public_read_food_photos" on storage.objects
  for select using (bucket_id = 'food-photos');

drop policy if exists "auth_upload_food_photos" on storage.objects;
create policy "auth_upload_food_photos" on storage.objects
  for insert with check (bucket_id = 'food-photos' and auth.role() = 'authenticated');
