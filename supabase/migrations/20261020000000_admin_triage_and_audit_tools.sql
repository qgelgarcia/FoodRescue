-- Admin triage context, safety/expiry checks, and actionable dashboard totals.

drop function if exists public.admin_list_posts();
create function public.admin_list_posts()
returns table (
  id uuid, food_name text, category text, status text,
  quantity_total integer, quantity_remaining integer,
  created_at timestamptz, donor_name text,
  description text, expires_at timestamptz
)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select f.id, f.food_name, f.category, f.status, f.quantity_total,
         f.quantity_remaining, f.created_at,
         coalesce(p.full_name, 'Former member'), f.description, f.expires_at
  from public.food_posts f
  left join public.profiles p on p.id = f.donor_id
  order by f.created_at desc;
end;
$$;

drop function if exists public.admin_list_reports();
create function public.admin_list_reports()
returns table (
  id uuid, reporter_name text, target_type text,
  target_label text, reason text, status text,
  resolution_explanation text, created_at timestamptz,
  reviewed_at timestamptz, resolved_at timestamptz,
  target_context jsonb
)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select r.id, coalesce(reporter.full_name, r.reporter_name, 'Former member'),
         r.target_type,
         case when r.target_type = 'post' then target_post.food_name else target_user.full_name end,
         r.reason, r.status, r.resolution_explanation, r.created_at,
         r.reviewed_at, r.resolved_at,
         case when r.target_type = 'post' then
           jsonb_build_object(
             'status', target_post.status,
             'category', target_post.category,
             'description', target_post.description,
             'expires_at', target_post.expires_at
           )
         when r.target_type = 'user' then
           jsonb_build_object(
             'role', target_user.role,
             'status', target_user.status,
             'joined_at', target_user.created_at
           )
         else '{}'::jsonb end
  from public.reports r
  left join public.profiles reporter on reporter.id = r.reporter_id
  left join public.food_posts target_post on r.target_type = 'post' and target_post.id = r.target_id
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
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'unresolved_reports', (select count(*) from public.reports where status in ('open', 'reviewed')),
    'expiring_soon_posts', (select count(*) from public.food_posts
      where status = 'active' and expires_at > now() and expires_at <= now() + interval '24 hours'),
    'expired_active_posts', (select count(*) from public.food_posts
      where status = 'active' and expires_at <= now()),
    'posts_missing_description', (select count(*) from public.food_posts
      where status = 'active' and nullif(btrim(description), '') is null)
  );
end;
$$;

revoke all on function public.admin_list_posts() from public, anon;
revoke all on function public.admin_list_reports() from public, anon;
revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_list_posts() to authenticated;
grant execute on function public.admin_list_reports() to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
