-- Exact notification destinations. Historical and bulk listing notices retain post fallback.
-- Retain destination identity after deletion so an exact notice never falls back
-- to a different claim on the same listing. Destinations use authorized reads.
alter table public.notifications
  add column related_claim_id uuid,
  add column related_report_id uuid;
alter table public.notifications add constraint notifications_one_exact_target
  check (related_claim_id is null or related_report_id is null);

-- Recipients may acknowledge notices, never change their canonical targets or content.
revoke update on public.notifications from anon, authenticated;
grant update (is_read) on public.notifications to authenticated;

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

  insert into public.notifications (related_claim_id, user_id, type, related_post_id, message)
    values (v_claim_id, v_post.donor_id, 'claim_received', $1,
          'A member requested portions from "' || v_post.food_name || '". Review the request before pickup.');

  -- A pass is created only after donor approval; pending claims never receive a usable code.
  return query select v_claim_id, null::text;
end;
$$;

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

    insert into public.notifications (related_claim_id, user_id, type, related_post_id, message)
    values (p_claim_id, v_claim.claimant_id, 'claim_accepted', v_post_id,
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

    insert into public.notifications (related_claim_id, user_id, type, related_post_id, message)
    values (p_claim_id, v_claim.claimant_id, 'claim_rejected', v_post_id,
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
  insert into public.notifications (related_claim_id, user_id, type, related_post_id, message)
    values (p_claim_id, v_post.donor_id, 'moderation_update', v_post_id,
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

    insert into public.notifications (related_claim_id, user_id, type, related_post_id, message)
    values (v_claim_id, v_claim.claimant_id, 'moderation_update', v_post_id,
            'Your cancellation request for "' || v_post.food_name || '" was approved. The reservation was released.'
              || case when v_reason is null then '' else ' Note: ' || v_reason end);
  else
    insert into public.notifications (related_claim_id, user_id, type, related_post_id, message)
    values (v_claim_id, v_claim.claimant_id, 'moderation_update', v_post_id,
            'Your cancellation request for "' || v_post.food_name || '" was denied. Any accepted pickup pass remains valid.'
              || case when v_reason is null then '' else ' Reason: ' || v_reason end);
  end if;
end;
$$;

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

  insert into public.notifications (related_claim_id, user_id, type, related_post_id, message)
    values (p_claim_id, v_post.donor_id, 'on_my_way', v_post.id,
          'The claimant for "' || v_post.food_name || '" is on the way.');

  return true;
end;
$$;

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

    insert into public.notifications (related_claim_id, user_id, type, related_post_id, message)
    values (new.id, new.claimant_id, 'moderation_update', new.post_id,
            'The donor confirmed pickup of "' || coalesce(v_food_name, 'your food reservation') || '".');
  end if;
  return new;
end;
$$;

create or replace function public.admin_update_report(
  p_report_id uuid, p_next_status text, p_resolution_explanation text default null
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_reporter_id uuid;
  v_target_type text;
  v_target_id uuid;
  v_status text;
  v_reason text;
  v_resolution text := btrim(coalesce(p_resolution_explanation, ''));
begin
  if v_actor is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  select r.reporter_id, r.target_type, r.target_id, r.status, r.reason
  into v_reporter_id, v_target_type, v_target_id, v_status, v_reason
  from public.reports r where r.id = p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  if p_next_status is null or p_next_status not in ('reviewed', 'resolved')
     or not ((v_status = 'open' and p_next_status = 'reviewed')
       or (v_status = 'reviewed' and p_next_status = 'resolved')) then
    raise exception 'Reports must move from open to reviewed to resolved';
  end if;
  if p_next_status = 'resolved' and (char_length(v_resolution) < 10 or char_length(v_resolution) > 2000) then
    raise exception 'Provide a 10 to 2,000 character resolution explanation';
  end if;

  select p.full_name into v_actor_name from public.profiles p where p.id = v_actor;
  perform set_config('foodrescue.moderation_actor', v_actor::text, true);
  update public.reports
  set status = p_next_status,
      resolution_explanation = case when p_next_status = 'resolved' then v_resolution else resolution_explanation end,
      reviewed_by = case when p_next_status = 'reviewed' then v_actor else reviewed_by end,
      reviewed_at = case when p_next_status = 'reviewed' then now() else reviewed_at end,
      resolved_by = case when p_next_status = 'resolved' then v_actor else resolved_by end,
      resolved_at = case when p_next_status = 'resolved' then now() else resolved_at end,
      updated_at = now()
  where id = p_report_id;

  insert into public.admin_logs (admin_id, actor_name, action, target_type, target_id, details)
  values (v_actor, v_actor_name, 'report_status_changed', 'report', p_report_id,
          jsonb_build_object('from', v_status, 'to', p_next_status,
                             'target_type', v_target_type, 'target_id', v_target_id,
                             'reason', v_reason, 'resolution_explanation', nullif(v_resolution, '')));

  if v_reporter_id is not null then
    insert into public.notifications (related_report_id, user_id, type, related_post_id, message)
    values (p_report_id, v_reporter_id, 'moderation_update',
            case when v_target_type = 'post' then v_target_id else null end,
            case when p_next_status = 'reviewed'
                 then 'Your report has been reviewed by the campus admin team.'
                 else 'Your report has been resolved. Admin note: ' || v_resolution end);
  end if;
end;
$$;
