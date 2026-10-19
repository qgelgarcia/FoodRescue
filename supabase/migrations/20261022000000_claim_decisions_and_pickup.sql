-- Canonical donor decisions, explained claim cancellation, and donor-verified pickup.

-- Include the expired accepted-claim state described by ADR 0003. The RPC views project
-- deadline-passed claims to terminal history values without relying on a scheduled update.
alter table public.claims drop constraint if exists claims_status_check;
alter table public.claims
  add constraint claims_status_check
  check (status in ('pending', 'accepted', 'rejected', 'picked_up', 'cancelled', 'expired'));

create table if not exists public.claim_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'obsolete')),
  decision_reason text,
  requested_at timestamptz not null default clock_timestamp(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);

create index if not exists idx_claim_cancellation_requests_claim_latest
  on public.claim_cancellation_requests(claim_id, requested_at desc, id desc);
create unique index if not exists idx_claim_cancellation_requests_one_pending
  on public.claim_cancellation_requests(claim_id)
  where status = 'pending';

alter table public.claim_cancellation_requests enable row level security;
revoke all on public.claim_cancellation_requests from public, anon, authenticated;

-- Direct client writes to workflow state would bypass reservation and token handling.
revoke all on public.claims from public, anon, authenticated;
grant select on public.claims to authenticated;
revoke all on public.pickup_authorizations from public, anon, authenticated;

create or replace function public.guard_food_post_workflow()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_has_claim_history boolean;
  v_workflow_actor boolean := coalesce(current_setting('foodrescue.claim_workflow_actor', true) = auth.uid()::text, false)
    or coalesce(current_setting('foodrescue.reservation_actor', true) = auth.uid()::text, false);
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

drop trigger if exists guard_food_post_workflow on public.food_posts;
create trigger guard_food_post_workflow
  before update on public.food_posts
  for each row execute function public.guard_food_post_workflow();

revoke all on function public.guard_food_post_workflow() from public, anon, authenticated;

-- Closing a claim makes its outstanding cancellation request obsolete and its token unusable.
-- Trigger order follows the workflow lock order: post, claim, cancellation request, authorization.
create or replace function public.close_claim_workflow()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text;
begin
  if new.status is not distinct from old.status
     or new.status in ('pending', 'accepted') then
    return new;
  end if;

  v_reason := case new.status
    when 'picked_up' then 'Pickup was confirmed.'
    when 'expired' then 'The pickup deadline passed.'
    when 'rejected' then 'The claim was rejected.'
    when 'cancelled' then 'The claim was cancelled.'
    else 'The claim is no longer active.'
  end;

  update public.claim_cancellation_requests r
  set status = 'obsolete', decision_reason = v_reason, decided_at = clock_timestamp()
  where r.claim_id = new.id and r.status = 'pending';

  update public.pickup_authorizations pa
  set invalidated_at = coalesce(pa.invalidated_at, clock_timestamp()),
      invalidation_reason = coalesce(pa.invalidation_reason, case new.status
        when 'picked_up' then 'pickup_completed'
        when 'expired' then 'pickup_expired'
        when 'rejected' then 'claim_rejected'
        else 'claim_cancelled'
      end)
  where pa.claim_id = new.id and pa.invalidated_at is null;

  return new;
end;
$$;

drop trigger if exists close_claim_workflow on public.claims;
create trigger close_claim_workflow
  after update of status on public.claims
  for each row execute function public.close_claim_workflow();

revoke all on function public.close_claim_workflow() from public, anon, authenticated;

create or replace function public.claim_food(post_id uuid, claimant_id uuid, qty integer)
returns table (claim_id uuid, claim_code text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_post public.food_posts%rowtype;
  v_claim_id uuid;
  v_now timestamptz;
begin
  if v_actor is null or v_actor <> $2 then
    raise exception 'You can only create a claim for your signed-in account';
  end if;
  if not public.is_active_member() then
    raise exception 'An active account is required to start a new pickup';
  end if;
  if $3 is null or $3 <= 0 then
    raise exception 'Claim quantity must be greater than zero';
  end if;

  select fp.* into v_post
  from public.food_posts fp
  where fp.id = $1
  for update;
  if not found then raise exception 'Listing not found'; end if;

  v_now := clock_timestamp();
  if v_post.expires_at <= v_now then
    raise exception 'The pickup deadline has passed';
  end if;
  if v_post.donor_id = v_actor then
    raise exception 'You cannot claim your own listing';
  end if;
  if v_post.status <> 'active' or v_post.quantity_remaining < $3 then
    raise exception 'Not enough quantity remains or the listing is no longer active';
  end if;
  if exists (
    select 1 from public.claims c
    where c.post_id = $1 and c.claimant_id = v_actor
      and c.status in ('pending', 'accepted', 'picked_up')
  ) then
    if exists (
      select 1 from public.claims c
      where c.post_id = $1 and c.claimant_id = v_actor and c.status = 'picked_up'
    ) then
      raise exception 'You cannot claim again from a listing you already picked up';
    end if;
    raise exception 'You already have an active pickup for this listing';
  end if;

  -- Recheck immediately before changing inventory, after the post lock and eligibility reads.
  if v_post.expires_at <= clock_timestamp() then
    raise exception 'The pickup deadline has passed';
  end if;

  perform set_config('foodrescue.claim_workflow_actor', v_actor::text, true);
  update public.food_posts fp
  set quantity_remaining = fp.quantity_remaining - $3,
      status = case when fp.quantity_remaining - $3 = 0 then 'fully_claimed' else fp.status end
  where fp.id = $1;

  insert into public.claims (post_id, claimant_id, quantity_claimed, status)
  values ($1, v_actor, $3, 'pending')
  returning id into v_claim_id;

  insert into public.notifications (user_id, type, related_post_id, message)
  values (v_post.donor_id, 'claim_received', $1,
          'A member requested portions from "' || v_post.food_name || '". Review the request before pickup.');

  -- A pass is created only after donor approval; pending claims never receive a usable code.
  return query select v_claim_id, null::text;
end;
$$;

revoke all on function public.claim_food(uuid, uuid, integer) from public, anon;
grant execute on function public.claim_food(uuid, uuid, integer) to authenticated;

create or replace function public.decide_food_claim(
  p_claim_id uuid, p_accept boolean, p_reason text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_post_id uuid;
  v_post public.food_posts%rowtype;
  v_claim public.claims%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_now timestamptz;
begin
  if v_actor is null then raise exception 'Sign in to review claims'; end if;
  if p_accept is null then raise exception 'Choose whether to accept or reject the claim'; end if;
  if char_length(coalesce(v_reason, '')) > 2000 then raise exception 'Decision reason is too long'; end if;

  select c.post_id into v_post_id from public.claims c where c.id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;

  select fp.* into v_post from public.food_posts fp where fp.id = v_post_id for update;
  if not found then raise exception 'Listing not found'; end if;
  select c.* into v_claim from public.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_post.donor_id <> v_actor then raise exception 'Only the listing donor can decide this claim'; end if;
  if v_claim.status <> 'pending' then raise exception 'Only pending claims can be decided'; end if;

  v_now := clock_timestamp();
  if v_post.expires_at <= v_now or v_post.status not in ('active', 'fully_claimed') then
    raise exception 'The pickup deadline passed or the listing is no longer available';
  end if;

  if p_accept then
    update public.claims set status = 'accepted', updated_at = v_now
    where id = p_claim_id and status = 'pending';
    if not found then raise exception 'Only pending claims can be decided'; end if;

    insert into public.pickup_authorizations (claim_id, pickup_code)
    values (p_claim_id, gen_random_uuid()::text)
    on conflict (claim_id) do update
      set pickup_code = excluded.pickup_code,
          created_at = v_now,
          invalidated_at = null,
          invalidation_reason = null;

    insert into public.notifications (user_id, type, related_post_id, message)
    values (v_claim.claimant_id, 'claim_accepted', v_post_id,
            'Your request for "' || v_post.food_name || '" was accepted. Your pickup pass is ready.');
  else
    update public.claims set status = 'rejected', updated_at = v_now
    where id = p_claim_id and status = 'pending';
    if not found then raise exception 'Only pending claims can be decided'; end if;

    perform set_config('foodrescue.reservation_actor', v_actor::text, true);
    update public.food_posts fp
    set quantity_remaining = fp.quantity_remaining + v_claim.quantity_claimed,
        status = case when fp.status = 'fully_claimed' then 'active' else fp.status end
    where fp.id = v_post_id
      and fp.status in ('active', 'fully_claimed')
      and fp.expires_at > v_now;

    insert into public.notifications (user_id, type, related_post_id, message)
    values (v_claim.claimant_id, 'claim_rejected', v_post_id,
            'Your request for "' || v_post.food_name || '" was declined.'
              || case when v_reason is null then '' else ' Reason: ' || v_reason end);
  end if;
end;
$$;

create or replace function public.request_claim_cancellation(p_claim_id uuid, p_reason text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_post_id uuid;
  v_post public.food_posts%rowtype;
  v_claim public.claims%rowtype;
  v_name text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_request_id uuid;
  v_now timestamptz;
  v_existing uuid;
begin
  if v_actor is null then raise exception 'Sign in to request cancellation'; end if;
  if char_length(v_reason) < 10 or char_length(v_reason) > 2000 then
    raise exception 'Explain the cancellation request in 10 to 2,000 characters';
  end if;

  select c.post_id into v_post_id from public.claims c where c.id = p_claim_id;
  if not found then raise exception 'Claim not found'; end if;
  select fp.* into v_post from public.food_posts fp where fp.id = v_post_id for update;
  if not found then raise exception 'Listing not found'; end if;
  select c.* into v_claim from public.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.claimant_id <> v_actor then raise exception 'Only the claimant can request cancellation'; end if;
  if v_claim.status not in ('pending', 'accepted') then
    raise exception 'Only pending or accepted claims can be cancelled';
  end if;

  select r.id into v_existing
  from public.claim_cancellation_requests r
  where r.claim_id = p_claim_id and r.status = 'pending'
  for update;
  if found then raise exception 'A cancellation request is already awaiting a decision'; end if;

  v_now := clock_timestamp();
  if v_post.expires_at <= v_now or v_post.status not in ('active', 'fully_claimed') then
    raise exception 'The pickup deadline passed or the listing is no longer available';
  end if;

  insert into public.claim_cancellation_requests (claim_id, requester_id, reason)
  values (p_claim_id, v_actor, v_reason)
  returning id into v_request_id;

  select p.full_name into v_name from public.profiles p where p.id = v_actor;
  insert into public.notifications (user_id, type, related_post_id, message)
  values (v_post.donor_id, 'moderation_update', v_post_id,
          coalesce(v_name, 'A claimant') || ' requested cancellation of the claim for "'
            || v_post.food_name || '". Reason: ' || v_reason);

  return v_request_id;
end;
$$;

create or replace function public.decide_claim_cancellation(
  p_request_id uuid, p_approve boolean, p_reason text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_claim_id uuid;
  v_post_id uuid;
  v_post public.food_posts%rowtype;
  v_claim public.claims%rowtype;
  v_request public.claim_cancellation_requests%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_now timestamptz;
begin
  if v_actor is null then raise exception 'Sign in to decide cancellation requests'; end if;
  if p_approve is null then raise exception 'Choose whether to approve or deny the request'; end if;
  if char_length(coalesce(v_reason, '')) > 2000 then raise exception 'Decision reason is too long'; end if;

  select r.claim_id, c.post_id into v_claim_id, v_post_id
  from public.claim_cancellation_requests r
  join public.claims c on c.id = r.claim_id
  where r.id = p_request_id;
  if not found then raise exception 'Cancellation request not found'; end if;

  select fp.* into v_post from public.food_posts fp where fp.id = v_post_id for update;
  if not found then raise exception 'Listing not found'; end if;
  select c.* into v_claim from public.claims c where c.id = v_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  select r.* into v_request
  from public.claim_cancellation_requests r where r.id = p_request_id for update;
  if not found then raise exception 'Cancellation request not found'; end if;

  if v_post.donor_id <> v_actor then raise exception 'Only the listing donor can decide this request'; end if;
  if v_request.status <> 'pending' then raise exception 'This cancellation request is no longer pending'; end if;
  if v_claim.status not in ('pending', 'accepted') then raise exception 'The claim is no longer active'; end if;

  v_now := clock_timestamp();
  if v_post.expires_at <= v_now or v_post.status not in ('active', 'fully_claimed') then
    raise exception 'The pickup deadline passed or the listing is no longer available';
  end if;

  update public.claim_cancellation_requests
  set status = case when p_approve then 'approved' else 'denied' end,
      decision_reason = v_reason,
      decided_at = v_now,
      decided_by = v_actor
  where id = p_request_id and status = 'pending';
  if not found then raise exception 'This cancellation request is no longer pending'; end if;

  if p_approve then
    update public.claims set status = 'cancelled', updated_at = v_now
    where id = v_claim_id and status in ('pending', 'accepted');
    if not found then raise exception 'The claim is no longer active'; end if;

    perform set_config('foodrescue.reservation_actor', v_actor::text, true);
    update public.food_posts fp
    set quantity_remaining = fp.quantity_remaining + v_claim.quantity_claimed,
        status = case when fp.status = 'fully_claimed' then 'active' else fp.status end
    where fp.id = v_post_id
      and fp.status in ('active', 'fully_claimed')
      and fp.expires_at > v_now;

    insert into public.notifications (user_id, type, related_post_id, message)
    values (v_claim.claimant_id, 'moderation_update', v_post_id,
            'Your cancellation request for "' || v_post.food_name || '" was approved. The reservation was released.'
              || case when v_reason is null then '' else ' Note: ' || v_reason end);
  else
    insert into public.notifications (user_id, type, related_post_id, message)
    values (v_claim.claimant_id, 'moderation_update', v_post_id,
            'Your cancellation request for "' || v_post.food_name || '" was denied. Any accepted pickup pass remains valid.'
              || case when v_reason is null then '' else ' Reason: ' || v_reason end);
  end if;
end;
$$;

-- Internal verifier is shared with the legacy two-argument RPC, which remains donor-only.
create or replace function public.verify_food_pickup_internal(
  p_pickup_code text, p_expected_claim_id uuid default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_claim_id uuid;
  v_post_id uuid;
  v_post public.food_posts%rowtype;
  v_claim public.claims%rowtype;
  v_auth public.pickup_authorizations%rowtype;
  v_cancel_pending boolean;
  v_now timestamptz;
begin
  if v_actor is null then raise exception 'Sign in as the donor to confirm pickup'; end if;
  if nullif(btrim(coalesce(p_pickup_code, '')), '') is null then raise exception 'Pickup pass is invalid or expired'; end if;

  select pa.claim_id, c.post_id into v_claim_id, v_post_id
  from public.pickup_authorizations pa
  join public.claims c on c.id = pa.claim_id
  where pa.pickup_code = p_pickup_code;
  if not found then raise exception 'Pickup pass is invalid or expired'; end if;
  if p_expected_claim_id is not null and v_claim_id <> p_expected_claim_id then
    raise exception 'Pickup pass does not match this claim';
  end if;

  select fp.* into v_post from public.food_posts fp where fp.id = v_post_id for update;
  if not found then raise exception 'Listing not found'; end if;
  select c.* into v_claim from public.claims c where c.id = v_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;

  select exists (
    select 1 from public.claim_cancellation_requests r
    where r.claim_id = v_claim_id and r.status = 'pending'
  ) into v_cancel_pending;
  if v_cancel_pending then
    raise exception 'Pickup cannot be confirmed while a cancellation request awaits a decision';
  end if;

  select pa.* into v_auth
  from public.pickup_authorizations pa
  where pa.claim_id = v_claim_id
  for update;
  if not found then raise exception 'Pickup pass is invalid or expired'; end if;

  v_now := clock_timestamp();
  if v_post.donor_id <> v_actor then raise exception 'Only the listing donor can confirm this pickup'; end if;
  if v_claim.status <> 'accepted' then raise exception 'Only an accepted claim can be picked up'; end if;
  if v_post.status not in ('active', 'fully_claimed') or v_post.expires_at <= v_now then
    raise exception 'The listing is closed or its pickup deadline has passed';
  end if;
  if v_auth.pickup_code <> p_pickup_code or v_auth.invalidated_at is not null then
    raise exception 'Pickup pass is invalid or already used';
  end if;

  update public.claims set status = 'picked_up', updated_at = v_now
  where id = v_claim_id and status = 'accepted';
  if not found then raise exception 'This pickup was already confirmed or is no longer active'; end if;
  -- The claim-status trigger invalidates the same authorization atomically.
end;
$$;

create or replace function public.verify_food_pickup(p_pickup_code text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.verify_food_pickup_internal(p_pickup_code, null);
end;
$$;

create or replace function public.complete_food_claim(p_claim_id uuid, p_pickup_code text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.verify_food_pickup_internal(p_pickup_code, p_claim_id);
end;
$$;

-- The old compatibility RPC delegates to the donor-only verifier and cannot self-confirm.
revoke all on function public.verify_food_pickup_internal(text, uuid) from public, anon, authenticated;
revoke all on function public.decide_food_claim(uuid, boolean, text) from public, anon;
revoke all on function public.request_claim_cancellation(uuid, text) from public, anon;
revoke all on function public.decide_claim_cancellation(uuid, boolean, text) from public, anon;
revoke all on function public.verify_food_pickup(text) from public, anon;
revoke all on function public.complete_food_claim(uuid, text) from public, anon;
grant execute on function public.decide_food_claim(uuid, boolean, text) to authenticated;
grant execute on function public.request_claim_cancellation(uuid, text) to authenticated;
grant execute on function public.decide_claim_cancellation(uuid, boolean, text) to authenticated;
grant execute on function public.verify_food_pickup(text) to authenticated;
grant execute on function public.complete_food_claim(uuid, text) to authenticated;

-- Output changes require DROP first because PostgreSQL cannot replace a table-returning signature.
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
  cancellation_decision_reason text
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
              then 'The pickup deadline passed.' else latest.decision_reason end
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
  cancellation_decision_reason text
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
              then 'The pickup deadline passed.' else latest.decision_reason end
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

revoke all on function public.get_my_food_claims() from public, anon;
revoke all on function public.get_donor_food_claims() from public, anon;
grant execute on function public.get_my_food_claims() to authenticated;
grant execute on function public.get_donor_food_claims() to authenticated;

