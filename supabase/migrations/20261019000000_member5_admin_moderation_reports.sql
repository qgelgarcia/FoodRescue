-- Member 5: server-authorized moderation, retained reports, pickup closure, and audit.

alter table public.reports
  add column if not exists reporter_name text,
  add column if not exists resolution_explanation text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.reports r
set reporter_name = p.full_name
from public.profiles p
where p.id = r.reporter_id and r.reporter_name is null;

alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete set null;

alter table public.admin_logs
  add column if not exists target_type text,
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists actor_name text;

update public.admin_logs l
set actor_name = p.full_name
from public.profiles p
where p.id = l.admin_id and l.actor_name is null;

alter table public.food_posts
  alter column pickup_lat drop not null,
  alter column pickup_lng drop not null;

create table if not exists public.pickup_authorizations (
  claim_id uuid primary key references public.claims(id) on delete cascade,
  pickup_code text not null unique,
  created_at timestamptz not null default now(),
  invalidated_at timestamptz,
  invalidation_reason text
);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'new_post_nearby', 'claim_received', 'claim_accepted', 'claim_rejected',
    'pickup_reminder', 'broadcast', 'moderation_update'
  ));

create index if not exists idx_reports_status_created_at
  on public.reports(status, created_at desc);
create index if not exists idx_admin_logs_created_at
  on public.admin_logs(created_at desc);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  );
$$;

create or replace function public.is_active_member()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_active_member() from public;
-- RLS expressions can run for anonymous requests; both helpers safely return false without auth.uid().
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_active_member() to anon, authenticated;

create or replace function public.guard_profile_moderation_fields()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and tg_op = 'INSERT' and new.id = auth.uid()
     and (new.role not in ('student', 'org', 'provider')
          or new.status is distinct from 'active') then
    raise exception 'Members cannot provision privileged profiles';
  end if;

  if auth.uid() is not null and tg_op = 'UPDATE'
     and (new.role is distinct from old.role or new.status is distinct from old.status)
     and (current_setting('foodrescue.moderation_actor', true) is distinct from auth.uid()::text
          or not public.is_admin()) then
    raise exception 'Role and account status changes require an audited admin operation';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_moderation_fields on public.profiles;
create trigger guard_profile_moderation_fields
  before insert or update on public.profiles
  for each row execute function public.guard_profile_moderation_fields();

create or replace function public.guard_admin_post_removal()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
     and new.status is distinct from old.status
     and ('removed_by_admin' in (new.status, old.status))
     and (current_setting('foodrescue.moderation_actor', true) is distinct from auth.uid()::text
          or not public.is_admin()) then
    raise exception 'Admin post removal requires the audited removal operation';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_admin_post_removal on public.food_posts;
create trigger guard_admin_post_removal
  before update on public.food_posts
  for each row execute function public.guard_admin_post_removal();

-- Admin reads use narrowly shaped RPCs; direct table access cannot reveal coordinates.
drop policy if exists "admin_view_all_profiles" on public.profiles;
drop policy if exists "view_active_or_own_posts" on public.food_posts;
create policy "view_active_or_own_posts" on public.food_posts for select using (
  not public.is_admin() and (status = 'active' or donor_id = auth.uid())
);
drop policy if exists "admin_full_access_posts" on public.food_posts;

drop policy if exists "donor_insert_post" on public.food_posts;
create policy "donor_insert_post" on public.food_posts for insert
  with check (donor_id = auth.uid() and public.is_active_member());

drop policy if exists "donor_update_own_post" on public.food_posts;
create policy "donor_update_own_post" on public.food_posts for update
  using (donor_id = auth.uid())
  with check (
    donor_id = auth.uid()
    and public.is_active_member()
  );

drop policy if exists "admin_full_access_claims" on public.claims;
drop policy if exists "donor_update_claim_status" on public.claims;
drop policy if exists "claimant_insert_claim" on public.claims;
revoke all on public.claims from public, anon, authenticated;
grant select on public.claims to authenticated;

drop policy if exists "insert_own_report" on public.reports;
drop policy if exists "admin_manage_reports" on public.reports;
revoke all on public.reports from public, anon, authenticated;

drop policy if exists "admin_only_logs" on public.admin_logs;
drop policy if exists "admin_read_logs" on public.admin_logs;
drop policy if exists "admin_insert_own_logs" on public.admin_logs;
revoke all on public.admin_logs from public, anon, authenticated;

alter table public.pickup_authorizations enable row level security;
revoke all on public.pickup_authorizations from public, anon, authenticated;
insert into public.pickup_authorizations (claim_id, pickup_code)
select c.id, gen_random_uuid()::text
from public.claims c
where c.status in ('pending', 'accepted')
on conflict (claim_id) do nothing;

-- No client-side authenticated write can create a claim without a live server pass.
drop function if exists public.claim_food(uuid, uuid, integer);
create function public.claim_food(post_id uuid, claimant_id uuid, qty integer)
returns table (claim_id uuid, claim_code text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_claim_id uuid;
  v_code text;
begin
  if auth.uid() is null or auth.uid() <> $2 then
    raise exception 'You can only create a claim for your signed-in account';
  end if;
  if not public.is_active_member() then
    raise exception 'An active account is required to start a new pickup';
  end if;
  if $3 is null or $3 <= 0 then
    raise exception 'Claim quantity must be greater than zero';
  end if;

  update public.food_posts fp
  set quantity_remaining = fp.quantity_remaining - $3,
      status = case when fp.quantity_remaining - $3 <= 0 then 'fully_claimed' else fp.status end
  where fp.id = $1 and fp.quantity_remaining >= $3 and fp.status = 'active';
  if not found then
    raise exception 'Not enough quantity remains or the listing is no longer active';
  end if;

  insert into public.claims (post_id, claimant_id, quantity_claimed)
  values ($1, $2, $3)
  returning id into v_claim_id;

  v_code := gen_random_uuid()::text;
  insert into public.pickup_authorizations (claim_id, pickup_code)
  values (v_claim_id, v_code);

  return query select v_claim_id, v_code;
end;
$$;

revoke all on function public.claim_food(uuid, uuid, integer) from public, anon;
grant execute on function public.claim_food(uuid, uuid, integer) to authenticated;

create or replace function public.get_my_food_claims()
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
  image text
)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view your pickups'; end if;
  return query
  select c.id,
         case when c.status in ('pending', 'accepted') and p.status <> 'removed_by_admin'
                    and pa.invalidated_at is null then pa.pickup_code else null end,
         c.post_id, p.food_name, p.category, c.quantity_claimed, p.pickup_address,
         coalesce(d.full_name, 'Former member'), c.claimed_at, p.expires_at,
         case when c.status in ('pending', 'accepted') and p.status <> 'removed_by_admin'
              then 'ready_for_pickup' else c.status end,
         p.photo_url
  from public.claims c
  join public.food_posts p on p.id = c.post_id
  left join public.profiles d on d.id = p.donor_id
  left join public.pickup_authorizations pa on pa.claim_id = c.id
  where c.claimant_id = auth.uid()
  order by c.claimed_at desc;
end;
$$;

create or replace function public.complete_food_claim(p_claim_id uuid, p_pickup_code text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_claim public.claims%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to complete a pickup'; end if;
  select c.* into v_claim
  from public.claims c
  where c.id = p_claim_id and c.claimant_id = auth.uid()
  for update;
  if not found then raise exception 'Pickup not found'; end if;
  if v_claim.status not in ('pending', 'accepted') then
    raise exception 'This pickup is no longer active';
  end if;
  if not exists (
    select 1 from public.food_posts p
    where p.id = v_claim.post_id and p.status <> 'removed_by_admin'
  ) then raise exception 'This listing was removed; its pickup pass is invalid'; end if;
  if not exists (
    select 1 from public.pickup_authorizations pa
    where pa.claim_id = p_claim_id and pa.pickup_code = p_pickup_code
      and pa.invalidated_at is null
  ) then raise exception 'Pickup pass is invalid or expired'; end if;

  update public.claims set status = 'picked_up', updated_at = now()
  where id = p_claim_id;
  update public.pickup_authorizations
  set invalidated_at = now(), invalidation_reason = 'pickup_completed'
  where claim_id = p_claim_id;
end;
$$;

create or replace function public.get_my_reports()
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  target_label text,
  reason text,
  status text,
  resolution_explanation text,
  created_at timestamptz,
  reviewed_at timestamptz,
  resolved_at timestamptz
)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view your reports'; end if;
  return query
  select r.id, r.target_type, r.target_id,
         case when r.target_type = 'post' then p.food_name else u.full_name end,
         r.reason, r.status, r.resolution_explanation, r.created_at, r.reviewed_at, r.resolved_at
  from public.reports r
  left join public.food_posts p on r.target_type = 'post' and p.id = r.target_id
  left join public.profiles u on r.target_type = 'user' and u.id = r.target_id
  where r.reporter_id = auth.uid()
  order by r.created_at desc;
end;
$$;

create or replace function public.submit_report(p_target_type text, p_target_id uuid, p_reason text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_reporter uuid := auth.uid();
  v_reporter_name text;
  v_report_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_reporter is null then raise exception 'Sign in before submitting a report'; end if;
  if public.is_admin() then raise exception 'Admins cannot submit member reports'; end if;
  if char_length(v_reason) < 10 or char_length(v_reason) > 2000 then
    raise exception 'Explain the concern in 10 to 2,000 characters';
  end if;
  if p_target_type is null or p_target_type not in ('post', 'user') or p_target_id is null then
    raise exception 'Choose a valid listing or member to report';
  end if;
  if p_target_type = 'user' and p_target_id = v_reporter then
    raise exception 'You cannot report your own account';
  end if;
  if p_target_type = 'post' and not exists (
    select 1 from public.food_posts p where p.id = p_target_id
  ) then raise exception 'The reported listing no longer exists'; end if;
  if p_target_type = 'post' and exists (
    select 1 from public.food_posts p where p.id = p_target_id and p.donor_id = v_reporter
  ) then raise exception 'You cannot report your own listing'; end if;
  if p_target_type = 'user' and not exists (
    select 1 from public.profiles p where p.id = p_target_id
  ) then raise exception 'The reported member no longer exists'; end if;

  select p.full_name into v_reporter_name from public.profiles p where p.id = v_reporter;
  insert into public.reports (reporter_id, reporter_name, target_type, target_id, reason)
  values (v_reporter, coalesce(v_reporter_name, 'Campus member'), p_target_type, p_target_id, v_reason)
  returning id into v_report_id;
  return v_report_id;
end;
$$;

create or replace function public.admin_list_members()
returns table (id uuid, full_name text, role text, status text, created_at timestamptz)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select p.id, p.full_name, p.role, p.status, p.created_at
  from public.profiles p
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_list_posts()
returns table (
  id uuid, food_name text, category text, status text,
  quantity_total integer, quantity_remaining integer,
  created_at timestamptz, donor_name text
)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select f.id, f.food_name, f.category, f.status, f.quantity_total,
         f.quantity_remaining, f.created_at,
         coalesce(p.full_name, 'Former member')
  from public.food_posts f
  left join public.profiles p on p.id = f.donor_id
  order by f.created_at desc;
end;
$$;

create or replace function public.admin_list_claims()
returns table (
  id uuid, post_title text, claimant_name text,
  quantity_claimed integer, status text, claimed_at timestamptz
)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select c.id, f.food_name,
         coalesce(p.full_name, 'Former member'), c.quantity_claimed, c.status, c.claimed_at
  from public.claims c
  left join public.food_posts f on f.id = c.post_id
  left join public.profiles p on p.id = c.claimant_id
  order by c.claimed_at desc;
end;
$$;

create or replace function public.admin_list_reports()
returns table (
  id uuid, reporter_name text, target_type text,
  target_label text, reason text, status text,
  resolution_explanation text, created_at timestamptz, reviewed_at timestamptz, resolved_at timestamptz
)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select r.id, coalesce(p.full_name, r.reporter_name, 'Former member'),
         r.target_type,
         case when r.target_type = 'post' then f.food_name else target_user.full_name end,
         r.reason, r.status, r.resolution_explanation, r.created_at, r.reviewed_at, r.resolved_at
  from public.reports r
  left join public.profiles p on p.id = r.reporter_id
  left join public.food_posts f on r.target_type = 'post' and f.id = r.target_id
  left join public.profiles target_user on r.target_type = 'user' and target_user.id = r.target_id
  order by case r.status when 'open' then 0 when 'reviewed' then 1 else 2 end, r.created_at desc;
end;
$$;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return jsonb_build_object(
    'active_posts', (select count(*) from public.food_posts where status = 'active'),
    'completed_pickups', (select count(*) from public.claims where status = 'picked_up'),
    'active_members', (select count(*) from public.profiles where status = 'active'),
    'open_reports', (select count(*) from public.reports where status = 'open')
  );
end;
$$;

create or replace function public.admin_list_audit_logs()
returns table (
  id uuid, actor_name text, action text, target_type text,
  target_id uuid, details jsonb, created_at timestamptz
)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select l.id, coalesce(l.actor_name, p.full_name, 'Former admin'),
         l.action, l.target_type, l.target_id, l.details, l.created_at
  from public.admin_logs l
  left join public.profiles p on p.id = l.admin_id
  order by l.created_at desc
  limit 200;
end;
$$;

create or replace function public.admin_set_member_status(p_user_id uuid, p_status text, p_reason text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_target_name text;
  v_target_role text;
  v_previous_status text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status is null or p_status not in ('active', 'suspended') then raise exception 'Choose active or suspended'; end if;
  if p_user_id = v_actor then raise exception 'Admins cannot change their own account status'; end if;
  if char_length(v_reason) < 10 or char_length(v_reason) > 2000 then
    raise exception 'Provide a 10 to 2,000 character explanation';
  end if;

  select p.full_name, p.role, p.status
  into v_target_name, v_target_role, v_previous_status
  from public.profiles p where p.id = p_user_id for update;
  if not found then raise exception 'Member not found'; end if;
  if v_target_role = 'admin' then raise exception 'Admin accounts cannot be suspended here'; end if;
  if v_previous_status = p_status then raise exception 'Member already has that status'; end if;
  select p.full_name into v_actor_name from public.profiles p where p.id = v_actor;

  perform set_config('foodrescue.moderation_actor', v_actor::text, true);
  update public.profiles set status = p_status where id = p_user_id;
  insert into public.admin_logs (admin_id, actor_name, action, target_type, target_id, details)
  values (v_actor, v_actor_name,
          case when p_status = 'suspended' then 'member_suspended' else 'member_reactivated' end,
          'user', p_user_id,
          jsonb_build_object('member', v_target_name, 'from', v_previous_status,
                             'to', p_status, 'reason', v_reason));
  insert into public.notifications (user_id, type, message)
  values (p_user_id, 'moderation_update',
          case when p_status = 'suspended'
               then 'Your account is suspended from starting new listings or pickups. You may still report concerns and finish existing pickups. Reason: ' || v_reason
               else 'Your account has been reactivated. Reason: ' || v_reason end);
end;
$$;

create or replace function public.admin_remove_food_post(p_post_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_donor_id uuid;
  v_post_title text;
  v_post_status text;
  v_claimants uuid[];
  v_claims_closed integer;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  if char_length(v_reason) < 10 or char_length(v_reason) > 2000 then
    raise exception 'Provide a 10 to 2,000 character explanation';
  end if;

  select f.donor_id, f.food_name, f.status
  into v_donor_id, v_post_title, v_post_status
  from public.food_posts f where f.id = p_post_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_post_status = 'removed_by_admin' then raise exception 'Listing was already removed'; end if;

  select array_agg(distinct c.claimant_id) into v_claimants
  from public.claims c where c.post_id = p_post_id;
  select p.full_name into v_actor_name from public.profiles p where p.id = v_actor;

  perform set_config('foodrescue.moderation_actor', v_actor::text, true);
  update public.food_posts
  set status = 'removed_by_admin', pickup_lat = null, pickup_lng = null
  where id = p_post_id;

  update public.claims
  set status = case when status = 'pending' then 'rejected' else 'cancelled' end,
      updated_at = now()
  where post_id = p_post_id and status in ('pending', 'accepted');
  get diagnostics v_claims_closed = row_count;

  update public.pickup_authorizations pa
  set invalidated_at = coalesce(pa.invalidated_at, now()),
      invalidation_reason = coalesce(pa.invalidation_reason, 'listing_removed')
  from public.claims c
  where c.post_id = p_post_id and c.id = pa.claim_id and pa.invalidated_at is null;

  insert into public.notifications (user_id, type, related_post_id, message)
  select distinct recipient.user_id, 'moderation_update', p_post_id,
         'Listing "' || v_post_title || '" was removed by an administrator. Any active pickup pass is invalidated; completed pickup history is preserved. Reason: ' || v_reason
  from unnest(array_append(coalesce(v_claimants, array[]::uuid[]), v_donor_id)) as recipient(user_id)
  where recipient.user_id is not null;

  insert into public.admin_logs (admin_id, actor_name, action, target_type, target_id, details)
  values (v_actor, v_actor_name, 'food_post_removed', 'post', p_post_id,
          jsonb_build_object('post_title', v_post_title, 'reason', v_reason,
                             'claims_closed', v_claims_closed,
                             'coordinates_deleted', true,
                             'completed_pickups_preserved', true));
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
    insert into public.notifications (user_id, type, related_post_id, message)
    values (v_reporter_id, 'moderation_update',
            case when v_target_type = 'post' then v_target_id else null end,
            case when p_next_status = 'reviewed'
                 then 'Your report has been reviewed by the campus admin team.'
                 else 'Your report has been resolved. Admin note: ' || v_resolution end);
  end if;
end;
$$;

create or replace function public.guard_report_workflow()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
     and (new.status is distinct from old.status
          or new.resolution_explanation is distinct from old.resolution_explanation)
     and (current_setting('foodrescue.moderation_actor', true) is distinct from auth.uid()::text
          or not public.is_admin()) then
    raise exception 'Report workflow changes require the audited admin operation';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_report_workflow on public.reports;
create trigger guard_report_workflow
  before update on public.reports
  for each row execute function public.guard_report_workflow();

-- Keep the claim API and own-history API private to authenticated sessions.
revoke all on function public.get_my_food_claims() from public, anon;
revoke all on function public.complete_food_claim(uuid, text) from public, anon;
revoke all on function public.get_my_reports() from public, anon;
revoke all on function public.submit_report(text, uuid, text) from public, anon;
revoke all on function public.admin_list_members() from public, anon;
revoke all on function public.admin_list_posts() from public, anon;
revoke all on function public.admin_list_claims() from public, anon;
revoke all on function public.admin_list_reports() from public, anon;
revoke all on function public.admin_dashboard_stats() from public, anon;
revoke all on function public.admin_list_audit_logs() from public, anon;
revoke all on function public.admin_set_member_status(uuid, text, text) from public, anon;
revoke all on function public.admin_remove_food_post(uuid, text) from public, anon;
revoke all on function public.admin_update_report(uuid, text, text) from public, anon;

grant execute on function public.get_my_food_claims() to authenticated;
grant execute on function public.complete_food_claim(uuid, text) to authenticated;
grant execute on function public.get_my_reports() to authenticated;
grant execute on function public.submit_report(text, uuid, text) to authenticated;
grant execute on function public.admin_list_members() to authenticated;
grant execute on function public.admin_list_posts() to authenticated;
grant execute on function public.admin_list_claims() to authenticated;
grant execute on function public.admin_list_reports() to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_list_audit_logs() to authenticated;
grant execute on function public.admin_set_member_status(uuid, text, text) to authenticated;
grant execute on function public.admin_remove_food_post(uuid, text) to authenticated;
grant execute on function public.admin_update_report(uuid, text, text) to authenticated;
