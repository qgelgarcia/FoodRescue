-- ====================================================================
-- FoodRescue — Phase 1 Initial Schema Migration
-- Tables, Triggers, RLS Policies, and RPC Functions
-- ====================================================================

-- 1. PROFILES (Extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  phone text,
  role text check (role in ('student','org','provider','admin')) default 'student',
  avatar_url text,
  status text check (status in ('active','suspended','banned')) default 'active',
  created_at timestamptz default now()
);

-- Trigger to auto-create a profile when a new user registers in Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Campus Member'),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'student')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, profiles.phone),
    role = coalesce(excluded.role, profiles.role);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. FOOD_POSTS
create table if not exists public.food_posts (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid references public.profiles(id) on delete cascade not null,
  food_name text not null,
  description text,
  category text default 'Meals',
  quantity_total int not null check (quantity_total > 0),
  quantity_remaining int not null check (quantity_remaining >= 0),
  photo_url text,
  pickup_lat numeric not null,
  pickup_lng numeric not null,
  pickup_address text not null,
  expires_at timestamptz not null,
  status text check (status in ('active','fully_claimed','expired','removed_by_admin')) default 'active',
  created_at timestamptz default now()
);

create index if not exists idx_food_posts_status_expires on public.food_posts(status, expires_at);
create index if not exists idx_food_posts_location on public.food_posts(pickup_lat, pickup_lng);

-- 3. CLAIMS
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.food_posts(id) on delete cascade not null,
  claimant_id uuid references public.profiles(id) on delete cascade not null,
  quantity_claimed int not null check (quantity_claimed > 0),
  status text check (status in ('pending','accepted','rejected','picked_up','cancelled')) default 'pending',
  claimed_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_claims_post on public.claims(post_id);
create index if not exists idx_claims_claimant on public.claims(claimant_id);

-- 4. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('new_post_nearby','claim_received','claim_accepted','claim_rejected','pickup_reminder','broadcast')),
  related_post_id uuid references public.food_posts(id) on delete set null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, is_read);

-- 5. REPORTS
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  target_type text check (target_type in ('post','user')) not null,
  target_id uuid not null,
  reason text not null,
  status text check (status in ('open','reviewed','resolved')) default 'open',
  created_at timestamptz default now()
);

-- 6. ADMIN_LOGS
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_id uuid,
  created_at timestamptz default now()
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

alter table public.profiles enable row level security;
alter table public.food_posts enable row level security;
alter table public.claims enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.admin_logs enable row level security;

-- PROFILES Policies
drop policy if exists "view_own_profile" on public.profiles;
create policy "view_own_profile" on public.profiles for select using (id = auth.uid());

drop policy if exists "update_own_profile" on public.profiles;
create policy "update_own_profile" on public.profiles for update using (id = auth.uid());

drop policy if exists "admin_view_all_profiles" on public.profiles;
create policy "admin_view_all_profiles" on public.profiles for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- FOOD_POSTS Policies
drop policy if exists "view_active_or_own_posts" on public.food_posts;
create policy "view_active_or_own_posts" on public.food_posts for select using (
  status = 'active' or donor_id = auth.uid()
);

drop policy if exists "donor_insert_post" on public.food_posts;
create policy "donor_insert_post" on public.food_posts for insert with check (donor_id = auth.uid());

drop policy if exists "donor_update_own_post" on public.food_posts;
create policy "donor_update_own_post" on public.food_posts for update using (donor_id = auth.uid());

drop policy if exists "admin_full_access_posts" on public.food_posts;
create policy "admin_full_access_posts" on public.food_posts for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- CLAIMS Policies
drop policy if exists "claimant_view_own_claims" on public.claims;
create policy "claimant_view_own_claims" on public.claims for select using (claimant_id = auth.uid());

drop policy if exists "donor_view_claims_on_own_posts" on public.claims;
create policy "donor_view_claims_on_own_posts" on public.claims for select using (
  exists (select 1 from public.food_posts where food_posts.id = claims.post_id and food_posts.donor_id = auth.uid())
);

drop policy if exists "claimant_insert_claim" on public.claims;
create policy "claimant_insert_claim" on public.claims for insert with check (claimant_id = auth.uid());

drop policy if exists "donor_update_claim_status" on public.claims;
create policy "donor_update_claim_status" on public.claims for update using (
  exists (select 1 from public.food_posts where food_posts.id = claims.post_id and food_posts.donor_id = auth.uid())
);

drop policy if exists "admin_full_access_claims" on public.claims;
create policy "admin_full_access_claims" on public.claims for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- NOTIFICATIONS Policies
drop policy if exists "view_own_notifications" on public.notifications;
create policy "view_own_notifications" on public.notifications for select using (user_id = auth.uid());

drop policy if exists "update_own_notifications" on public.notifications;
create policy "update_own_notifications" on public.notifications for update using (user_id = auth.uid());

-- REPORTS Policies
drop policy if exists "insert_own_report" on public.reports;
create policy "insert_own_report" on public.reports for insert with check (reporter_id = auth.uid());

drop policy if exists "admin_manage_reports" on public.reports;
create policy "admin_manage_reports" on public.reports for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ADMIN_LOGS Policies
drop policy if exists "admin_only_logs" on public.admin_logs;
create policy "admin_only_logs" on public.admin_logs for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ====================================================================
-- ATOMIC RPC FUNCTION FOR CLAIMING FOOD
-- ====================================================================
create or replace function public.claim_food(post_id uuid, claimant_id uuid, qty int)
returns void as $$
begin
  update public.food_posts
  set quantity_remaining = quantity_remaining - qty,
      status = case when quantity_remaining - qty <= 0 then 'fully_claimed' else status end
  where id = post_id and quantity_remaining >= qty and status = 'active';

  if not found then
    raise exception 'Not enough quantity remaining or post is no longer active';
  end if;

  insert into public.claims (post_id, claimant_id, quantity_claimed)
  values (post_id, claimant_id, qty);
end;
$$ language plpgsql security definer;
