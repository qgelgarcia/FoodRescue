alter table public.food_posts
  add column if not exists donor_cancel_reason text;

create or replace function public.guard_donor_food_post_updates()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.quantity_remaining < old.quantity_total
     and (new.food_name is distinct from old.food_name
       or new.description is distinct from old.description
       or new.category is distinct from old.category
      or new.quantity_total is distinct from old.quantity_total
       or new.pickup_address is distinct from old.pickup_address
       or new.pickup_lat is distinct from old.pickup_lat
       or new.pickup_lng is distinct from old.pickup_lng
       or new.photo_url is distinct from old.photo_url
       or new.expires_at is distinct from old.expires_at) then
    raise exception 'This listing is locked after its first claim';
  end if;

  if new.status = 'removed_by_donor'
     and length(trim(coalesce(new.donor_cancel_reason, ''))) < 5 then
    raise exception 'A cancellation explanation of at least 5 characters is required';
  end if;
  if new.status = 'removed_by_donor'
     and length(trim(new.donor_cancel_reason)) > 500 then
    raise exception 'Cancellation explanation must be 500 characters or fewer';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_donor_food_post_updates on public.food_posts;
create trigger guard_donor_food_post_updates
  before update on public.food_posts
  for each row execute function public.guard_donor_food_post_updates();

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'food-photos';

drop policy if exists "auth_upload_food_photos" on storage.objects;
create policy "auth_upload_own_food_photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'food-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "auth_delete_own_food_photos" on storage.objects;
create policy "auth_delete_own_food_photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'food-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );