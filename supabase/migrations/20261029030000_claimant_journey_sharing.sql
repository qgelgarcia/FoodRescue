-- One-time departure notices and claimant-controlled, foreground-only journey sharing.

alter table public.claims
  add column if not exists on_my_way_at timestamptz;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'new_post_nearby', 'claim_received', 'claim_accepted', 'claim_rejected',
    'pickup_reminder', 'broadcast', 'moderation_update', 'on_my_way'
  ));

create table if not exists public.claim_journeys (
  claim_id uuid primary key references public.claims(id) on delete cascade,
  share_token uuid not null default gen_random_uuid(),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  updated_at timestamptz,
  sequence_number bigint not null default 0 check (sequence_number >= 0),
  check (
    (lat is null and lng is null and updated_at is null and sequence_number = 0)
    or (lat is not null and lng is not null and updated_at is not null and sequence_number > 0)
  )
);

alter table public.claim_journeys enable row level security;
revoke all on public.claim_journeys from public, anon, authenticated;
grant select (claim_id, lat, lng, updated_at) on public.claim_journeys to authenticated;

drop policy if exists donor_read_claim_journey on public.claim_journeys;
create policy donor_read_claim_journey on public.claim_journeys
  for select to authenticated
  using (exists (
    select 1
    from public.claims c
    join public.food_posts p on p.id = c.post_id
    where c.id = claim_journeys.claim_id
      and p.donor_id = auth.uid()
      and c.status = 'accepted'
      and p.status in ('active', 'fully_claimed')
      and p.expires_at > clock_timestamp()
  ));

create or replace function public.claim_on_my_way(p_claim_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_post_id uuid;
  v_post public.food_posts%rowtype;
  v_claim public.claims%rowtype;
  v_now timestamptz;
begin
  if v_actor is null then raise exception 'Sign in before notifying the donor'; end if;

  select c.post_id into v_post_id from public.claims c where c.id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  select p.* into v_post from public.food_posts p where p.id = v_post_id for update;
  if not found then raise exception 'Listing not found'; end if;
  select c.* into v_claim from public.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.claimant_id <> v_actor then raise exception 'Only the claimant can notify the donor'; end if;

  v_now := clock_timestamp();
  if v_claim.status <> 'accepted'
     or v_post.status not in ('active', 'fully_claimed')
     or v_post.expires_at <= v_now then
    raise exception 'Only an accepted, unexpired claim can send an On my way notice';
  end if;
  if v_claim.on_my_way_at is not null then return false; end if;

  update public.claims
  set on_my_way_at = v_now
  where id = p_claim_id and on_my_way_at is null;
  if not found then return false; end if;

  insert into public.notifications (user_id, type, related_post_id, message)
  values (v_post.donor_id, 'on_my_way', v_post.id,
          'The claimant for "' || v_post.food_name || '" is on the way.');

  return true;
end;
$$;

create or replace function public.start_claim_journey_sharing(p_claim_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_post_id uuid;
  v_post public.food_posts%rowtype;
  v_claim public.claims%rowtype;
  v_share_token uuid;
begin
  if v_actor is null then raise exception 'Sign in before sharing your location'; end if;

  select c.post_id into v_post_id from public.claims c where c.id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  select p.* into v_post from public.food_posts p where p.id = v_post_id for update;
  if not found then raise exception 'Listing not found'; end if;
  select c.* into v_claim from public.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.claimant_id <> v_actor then raise exception 'Only the claimant can share this journey'; end if;
  if v_claim.status <> 'accepted' or v_claim.on_my_way_at is null
     or v_post.status not in ('active', 'fully_claimed')
     or v_post.expires_at <= clock_timestamp() then
    raise exception 'Only an accepted, unexpired claim with an On my way notice can share location';
  end if;

  insert into public.claim_journeys (claim_id, share_token)
  values (p_claim_id, gen_random_uuid())
  on conflict (claim_id) do update
    set share_token = excluded.share_token,
        lat = null,
        lng = null,
        updated_at = null,
        sequence_number = 0
  returning share_token into v_share_token;

  return v_share_token;
end;
$$;

create or replace function public.publish_claim_journey_location(
  p_claim_id uuid,
  p_share_token uuid,
  p_sequence bigint,
  p_lat double precision,
  p_lng double precision
)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_post_id uuid;
  v_post public.food_posts%rowtype;
  v_claim public.claims%rowtype;
begin
  if v_actor is null then raise exception 'Sign in before sharing your location'; end if;
  if p_sequence is null or p_sequence < 1
     or p_lat is null or p_lat not between -90 and 90
     or p_lng is null or p_lng not between -180 and 180 then
    raise exception 'A valid location update is required';
  end if;

  select c.post_id into v_post_id from public.claims c where c.id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  select p.* into v_post from public.food_posts p where p.id = v_post_id for update;
  if not found then raise exception 'Listing not found'; end if;
  select c.* into v_claim from public.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.claimant_id <> v_actor then raise exception 'Only the claimant can share this journey'; end if;
  if v_claim.status <> 'accepted' or v_claim.on_my_way_at is null
     or v_post.status not in ('active', 'fully_claimed')
     or v_post.expires_at <= clock_timestamp() then
    return false;
  end if;

  update public.claim_journeys
  set lat = p_lat,
      lng = p_lng,
      updated_at = clock_timestamp(),
      sequence_number = p_sequence
  where claim_id = p_claim_id
    and share_token = p_share_token
    and sequence_number < p_sequence;

  return found;
end;
$$;

drop function if exists public.stop_claim_journey_sharing(uuid);
create function public.stop_claim_journey_sharing(p_claim_id uuid, p_share_token uuid default null)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_post_id uuid;
  v_post public.food_posts%rowtype;
  v_claim public.claims%rowtype;
begin
  if v_actor is null then raise exception 'Sign in before stopping location sharing'; end if;

  select c.post_id into v_post_id from public.claims c where c.id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  select p.* into v_post from public.food_posts p where p.id = v_post_id for update;
  if not found then raise exception 'Listing not found'; end if;
  select c.* into v_claim from public.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.claimant_id <> v_actor then raise exception 'Only the claimant can stop this journey'; end if;

  delete from public.claim_journeys
  where claim_id = p_claim_id
    and (p_share_token is null or share_token = p_share_token);
end;
$$;

create or replace function public.my_claim_journey_sharing_active(p_claim_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_claim public.claims%rowtype;
  v_post public.food_posts%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to check journey sharing'; end if;
  select c.* into v_claim from public.claims c where c.id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.claimant_id <> auth.uid() then raise exception 'Only the claimant can check this journey'; end if;
  select p.* into v_post from public.food_posts p where p.id = v_claim.post_id;
  if not found then return false; end if;
  if v_claim.status <> 'accepted' or v_claim.on_my_way_at is null
     or v_post.status not in ('active', 'fully_claimed')
     or v_post.expires_at <= clock_timestamp() then
    return false;
  end if;

  return exists (select 1 from public.claim_journeys j where j.claim_id = p_claim_id);
end;
$$;

-- Claim terminal updates, including the lifecycle worker's cancellation and expiry paths,
-- delete the current point. Publishing also locks post then claim and needs a current token,
-- so late requests cannot recreate a closed journey.
create or replace function public.delete_terminal_claim_journey()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.claim_journeys where claim_id = new.id;
  return new;
end;
$$;

drop trigger if exists delete_terminal_claim_journey on public.claims;
create trigger delete_terminal_claim_journey
  after update of status on public.claims
  for each row
  when (new.status is distinct from old.status and new.status not in ('pending', 'accepted'))
  execute function public.delete_terminal_claim_journey();

-- Expose the timestamp to the claimant and the owning donor only through their scoped views.
drop function if exists public.get_my_food_claims();
create function public.get_my_food_claims()
returns table (
  id uuid,
  claim_code text,
  post_id uuid,
  post_title text,
  category text,
  quantity integer,
  location text,
  donor_name text,
  claimed_at timestamptz,
  expires_at timestamptz,
  status text,
  image text,
  cancellation_request_id uuid,
  cancellation_status text,
  cancellation_reason text,
  cancellation_decision_reason text,
  on_my_way_at timestamptz,
  pickup_lat numeric,
  pickup_lng numeric
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view your pickups'; end if;
  return query
  select c.id,
         case when c.status = 'accepted'
                   and p.status in ('active', 'fully_claimed')
                   and p.expires_at > clock_timestamp()
                   and pa.invalidated_at is null then pa.pickup_code else null end,
         c.post_id, p.food_name, p.category, c.quantity_claimed, p.pickup_address,
         coalesce(d.full_name, 'Former member'), c.claimed_at, p.expires_at,
         case when c.status = 'pending' and p.expires_at <= clock_timestamp() then 'rejected'
              when c.status = 'accepted' and p.expires_at <= clock_timestamp() then 'expired'
              else c.status end,
         p.photo_url,
         latest.id,
         case when latest.status = 'pending' and p.expires_at <= clock_timestamp() then 'obsolete'
              else latest.status end,
         latest.reason,
         case when latest.status = 'pending' and p.expires_at <= clock_timestamp()
              then 'The pickup deadline passed.' else latest.decision_reason end,
         c.on_my_way_at, p.pickup_lat, p.pickup_lng
  from public.claims c
  join public.food_posts p on p.id = c.post_id
  left join public.profiles d on d.id = p.donor_id
  left join public.pickup_authorizations pa on pa.claim_id = c.id
  left join lateral (
    select r.id, r.status, r.reason, r.decision_reason
    from public.claim_cancellation_requests r
    where r.claim_id = c.id
    order by r.requested_at desc, r.id desc
    limit 1
  ) latest on true
  where c.claimant_id = auth.uid()
  order by c.claimed_at desc;
end;
$$;

drop function if exists public.get_donor_food_claims();
create function public.get_donor_food_claims()
returns table (
  id uuid,
  post_id uuid,
  post_title text,
  claimant_name text,
  quantity integer,
  status text,
  claimed_at timestamptz,
  expires_at timestamptz,
  cancellation_request_id uuid,
  cancellation_status text,
  cancellation_reason text,
  cancellation_decision_reason text,
  on_my_way_at timestamptz
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view listing claims'; end if;
  return query
  select c.id, p.id, p.food_name, coalesce(claimant.full_name, 'Former member'),
         c.quantity_claimed,
         case when c.status = 'pending' and p.expires_at <= clock_timestamp() then 'rejected'
              when c.status = 'accepted' and p.expires_at <= clock_timestamp() then 'expired'
              else c.status end,
         c.claimed_at, p.expires_at,
         latest.id,
         case when latest.status = 'pending' and p.expires_at <= clock_timestamp() then 'obsolete'
              else latest.status end,
         latest.reason,
         case when latest.status = 'pending' and p.expires_at <= clock_timestamp()
              then 'The pickup deadline passed.' else latest.decision_reason end,
         c.on_my_way_at
  from public.claims c
  join public.food_posts p on p.id = c.post_id
  left join public.profiles claimant on claimant.id = c.claimant_id
  left join lateral (
    select r.id, r.status, r.reason, r.decision_reason
    from public.claim_cancellation_requests r
    where r.claim_id = c.id
    order by r.requested_at desc, r.id desc
    limit 1
  ) latest on true
  where p.donor_id = auth.uid()
  order by c.claimed_at desc;
end;
$$;

revoke all on function public.claim_on_my_way(uuid) from public, anon;
revoke all on function public.start_claim_journey_sharing(uuid) from public, anon;
revoke all on function public.publish_claim_journey_location(uuid, uuid, bigint, double precision, double precision) from public, anon;
revoke all on function public.stop_claim_journey_sharing(uuid, uuid) from public, anon;
revoke all on function public.my_claim_journey_sharing_active(uuid) from public, anon;
revoke all on function public.delete_terminal_claim_journey() from public, anon, authenticated;
revoke all on function public.get_my_food_claims() from public, anon;
revoke all on function public.get_donor_food_claims() from public, anon;

grant execute on function public.claim_on_my_way(uuid) to authenticated;
grant execute on function public.start_claim_journey_sharing(uuid) to authenticated;
grant execute on function public.publish_claim_journey_location(uuid, uuid, bigint, double precision, double precision) to authenticated;
grant execute on function public.stop_claim_journey_sharing(uuid, uuid) to authenticated;
grant execute on function public.my_claim_journey_sharing_active(uuid) to authenticated;
grant execute on function public.get_my_food_claims() to authenticated;
grant execute on function public.get_donor_food_claims() to authenticated;
