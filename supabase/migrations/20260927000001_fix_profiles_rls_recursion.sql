-- Fix infinite recursion in profiles RLS policies using a security definer function

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Update PROFILES policies
drop policy if exists "admin_view_all_profiles" on public.profiles;
create policy "admin_view_all_profiles" on public.profiles for select using (
  public.is_admin()
);

-- Update FOOD_POSTS policies
drop policy if exists "admin_full_access_posts" on public.food_posts;
create policy "admin_full_access_posts" on public.food_posts for all using (
  public.is_admin()
);

-- Update CLAIMS policies
drop policy if exists "admin_full_access_claims" on public.claims;
create policy "admin_full_access_claims" on public.claims for all using (
  public.is_admin()
);

-- Update REPORTS policies
drop policy if exists "admin_manage_reports" on public.reports;
create policy "admin_manage_reports" on public.reports for all using (
  public.is_admin()
);

-- Update ADMIN_LOGS policies
drop policy if exists "admin_only_logs" on public.admin_logs;
create policy "admin_only_logs" on public.admin_logs for all using (
  public.is_admin()
);
