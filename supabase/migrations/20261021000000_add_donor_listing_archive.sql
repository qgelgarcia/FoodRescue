alter table public.food_posts
  drop constraint if exists food_posts_status_check;

alter table public.food_posts
  add constraint food_posts_status_check
  check (status in ('active', 'fully_claimed', 'expired', 'removed_by_admin', 'removed_by_donor'));

drop policy if exists "donor_update_own_post" on public.food_posts;
create policy "donor_update_own_post" on public.food_posts
  for update
  using (donor_id = auth.uid())
  with check (donor_id = auth.uid() and public.is_active_member());
