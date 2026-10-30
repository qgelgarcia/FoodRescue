-- Explained donor cancellation and persisted deadline cleanup.

alter table public.food_posts
  add column if not exists cancellation_reason text;

create or replace function public.guard_food_post_workflow()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_has_claim_history boolean;
  v_workflow_actor boolean := coalesce(current_setting('foodrescue.claim_workflow_actor', true) = auth.uid()::text, false)
    or coalesce(current_setting('foodrescue.reservation_actor', true) = auth.uid()::text, false);
  v_expiration_actor boolean := coalesce(current_setting('foodrescue.expiration_actor', true) = 'true', false);
  v_admin_removal boolean := coalesce(current_setting('foodrescue.moderation_actor', true) = auth.uid()::text, false)
    and public.is_admin();
begin
  select exists (select 1 from public.claims c where c.post_id = old.id)
    into v_has_claim_history;

  if new.quantity_remaining is distinct from old.quantity_remaining and not v_workflow_actor then
    raise exception 'Available portions are managed by the claim workflow';
  end if;

  if v_has_claim_history and not v_admin_removal and (
       new.food_name is distinct from old.food_name
       or new.description is distinct from old.description
       or new.category is distinct from old.category
       or new.quantity_total is distinct from old.quantity_total
       or new.photo_url is distinct from old.photo_url
       or new.pickup_lat is distinct from old.pickup_lat
       or new.pickup_lng is distinct from old.pickup_lng
       or new.pickup_address is distinct from old.pickup_address
       or new.expires_at is distinct from old.expires_at
       or new.donor_id is distinct from old.donor_id
     ) then
    raise exception 'Listing details are locked after the first claim';
  end if;

  if new.status is distinct from old.status then
    if v_expiration_actor then
      if old.status not in ('active', 'fully_claimed') or new.status <> 'expired'
         or old.expires_at > clock_timestamp() then
        raise exception 'The expiration worker can only expire due listings';
      end if;
      return new;
    end if;
    if v_admin_removal or v_workflow_actor then
      return new;
    end if;
    if new.status = 'removed_by_donor' and not v_has_claim_history then
      return new;
    end if;
    if v_has_claim_history and new.status = 'removed_by_donor' then
      raise exception 'This listing has claim history and cannot be archived directly';
    end if;
    raise exception 'Listing status is managed by the reservation and moderation workflows';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_food_post_workflow() from public, anon, authenticated;

create or replace function public.guard_food_post_cancellation_reason()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.cancellation_reason is distinct from old.cancellation_reason
     and coalesce(current_setting('foodrescue.donor_cancellation_actor', true) = auth.uid()::text, false) is not true then
    raise exception 'Cancellation reasons are managed by the donor cancellation workflow';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_food_post_cancellation_reason on public.food_posts;
create trigger guard_food_post_cancellation_reason
  before update on public.food_posts
  for each row execute function public.guard_food_post_cancellation_reason();

revoke all on function public.guard_food_post_cancellation_reason() from public, anon, authenticated;

create or replace function public.cancel_food_post(p_post_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_post public.food_posts%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_now timestamptz;
begin
  if v_actor is null then raise exception 'Sign in as the donor to cancel this listing'; end if;
  if char_length(v_reason) < 10 or char_length(v_reason) > 2000 then
    raise exception 'Provide a 10 to 2,000 character cancellation explanation';
  end if;

  select fp.* into v_post
  from public.food_posts fp
  where fp.id = p_post_id
  for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_post.donor_id <> v_actor then raise exception 'Only the listing donor can cancel it'; end if;

  -- A retry after successful cancellation is a no-op: do not repeat notices or claim effects.
  if v_post.status = 'removed_by_donor' and v_post.cancellation_reason is not null then return; end if;
  if v_post.status not in ('active', 'fully_claimed') then
    raise exception 'Only an open listing can be cancelled';
  end if;

  v_now := clock_timestamp();
  if v_post.expires_at <= v_now then raise exception 'The pickup deadline has passed'; end if;
  perform set_config('foodrescue.claim_workflow_actor', v_actor::text, true);
  perform set_config('foodrescue.donor_cancellation_actor', v_actor::text, true);
  update public.food_posts
  set status = 'removed_by_donor', cancellation_reason = v_reason
  where id = p_post_id;

  with closed as (
    update public.claims c
    set status = case when c.status = 'pending' then 'rejected' else 'cancelled' end,
        updated_at = v_now
    where c.post_id = p_post_id and c.status in ('pending', 'accepted')
    returning c.claimant_id
  )
  insert into public.notifications (user_id, type, related_post_id, message)
  select distinct closed.claimant_id, 'moderation_update', p_post_id,
         'The donor cancelled "' || v_post.food_name || '". Reason: ' || v_reason
  from closed;

  perform set_config('foodrescue.claim_workflow_actor', '', true);
  perform set_config('foodrescue.donor_cancellation_actor', '', true);
end;
$$;

revoke all on function public.cancel_food_post(uuid, text) from public, anon;
grant execute on function public.cancel_food_post(uuid, text) to authenticated;

create or replace function public.notify_food_pickup_confirmation()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_food_name text;
begin
  if new.status is distinct from old.status and new.status = 'picked_up' then
    select fp.food_name into v_food_name
    from public.food_posts fp where fp.id = new.post_id;

    insert into public.notifications (user_id, type, related_post_id, message)
    values (new.claimant_id, 'moderation_update', new.post_id,
            'The donor confirmed pickup of "' || coalesce(v_food_name, 'your food reservation') || '".');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_food_pickup_confirmation on public.claims;
create trigger notify_food_pickup_confirmation
  after update of status on public.claims
  for each row execute function public.notify_food_pickup_confirmation();

revoke all on function public.notify_food_pickup_confirmation() from public, anon, authenticated;

create or replace function public.expire_food_posts()
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_post_id uuid;
  v_post public.food_posts%rowtype;
  v_now timestamptz;
  v_expired_posts integer := 0;
begin
  for v_post_id in
    select fp.id
    from public.food_posts fp
    where fp.status in ('active', 'fully_claimed')
      and fp.expires_at <= clock_timestamp()
    order by fp.expires_at, fp.id
    for update skip locked
  loop
    select fp.* into v_post from public.food_posts fp where fp.id = v_post_id;
    v_now := clock_timestamp();

    perform set_config('foodrescue.expiration_actor', 'true', true);
    update public.food_posts
    set status = 'expired'
    where id = v_post_id
      and status in ('active', 'fully_claimed')
      and expires_at <= v_now;
    if not found then continue; end if;
    v_expired_posts := v_expired_posts + 1;

    with closed as (
      update public.claims c
      set status = case when c.status = 'pending' then 'rejected' else 'expired' end,
          updated_at = v_now
      where c.post_id = v_post_id and c.status in ('pending', 'accepted')
      returning c.claimant_id
    )
    insert into public.notifications (user_id, type, related_post_id, message)
    select distinct closed.claimant_id, 'moderation_update', v_post_id,
           'The pickup deadline passed for "' || v_post.food_name || '". Any active claim is closed.'
    from closed;

    insert into public.notifications (user_id, type, related_post_id, message)
    values (v_post.donor_id, 'moderation_update', v_post_id,
            'The pickup deadline passed for "' || v_post.food_name || '". Outstanding claims were closed; completed pickup history was preserved.');
  end loop;

  perform set_config('foodrescue.expiration_actor', '', true);
  return v_expired_posts;
end;
$$;

revoke all on function public.expire_food_posts() from public, anon, authenticated;
grant execute on function public.expire_food_posts() to service_role;

-- Schedule persistent cleanup where Supabase pg_cron is installed. The named
-- job is replaced on migration reruns; RPC deadline checks remain authoritative.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    execute $schedule$
      select cron.schedule(
        'foodrescue-expire-posts',
        '* * * * *',
        'select public.expire_food_posts();'
      )
    $schedule$;
  end if;
end;
$$;
