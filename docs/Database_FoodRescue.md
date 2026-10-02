# FoodRescue — Database Design (Supabase / Postgres)

## 1. Entity Relationship Overview
```
auth.users (Supabase managed)
     │ 1:1
     ▼
 profiles ──1:N──► food_posts ──1:N──► claims ◄──N:1── profiles
     │                  │                                  │
     │                  └──────1:N──────► notifications ◄──┘
     │
     ├──1:N──► reports (reporter_id)
     └──1:N──► admin_logs (admin_id)
```

## 2. Tables

### 2.1 `profiles` (extends `auth.users`)
```sql
create table profiles (
  id uuid references auth.users(id) primary key,
  full_name text not null,
  phone text,
  role text check (role in ('student','org','provider','admin')) default 'student',
  avatar_url text,
  status text check (status in ('active','suspended','banned')) default 'active',
  created_at timestamptz default now()
);
```

### 2.2 `food_posts`
```sql
create table food_posts (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid references profiles(id) not null,
  food_name text not null,
  description text,
  category text,
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

create index idx_food_posts_status_expires on food_posts(status, expires_at);
create index idx_food_posts_location on food_posts(pickup_lat, pickup_lng);
```

### 2.3 `claims`
```sql
create table claims (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references food_posts(id) not null,
  claimant_id uuid references profiles(id) not null,
  quantity_claimed int not null check (quantity_claimed > 0),
  status text check (status in ('pending','accepted','rejected','picked_up','cancelled')) default 'pending',
  claimed_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_claims_post on claims(post_id);
create index idx_claims_claimant on claims(claimant_id);
```

### 2.4 `notifications`
```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  type text check (type in ('new_post_nearby','claim_received','claim_accepted','claim_rejected','pickup_reminder','broadcast')),
  related_post_id uuid references food_posts(id),
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index idx_notifications_user on notifications(user_id, is_read);
```

### 2.5 `reports`
```sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) not null,
  target_type text check (target_type in ('post','user')) not null,
  target_id uuid not null,
  reason text not null,
  status text check (status in ('open','reviewed','resolved')) default 'open',
  created_at timestamptz default now()
);
```

### 2.6 `admin_logs`
```sql
create table admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id) not null,
  action text not null,
  target_id uuid,
  created_at timestamptz default now()
);
```

## 3. Row Level Security (RLS)

```sql
alter table profiles enable row level security;
alter table food_posts enable row level security;
alter table claims enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;
alter table admin_logs enable row level security;

-- PROFILES
create policy "view_own_profile" on profiles for select using (id = auth.uid());
create policy "update_own_profile" on profiles for update using (id = auth.uid());
create policy "admin_view_all_profiles" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- FOOD_POSTS
create policy "view_active_or_own_posts" on food_posts for select using (
  status = 'active' or donor_id = auth.uid()
);
create policy "donor_insert_post" on food_posts for insert with check (donor_id = auth.uid());
create policy "donor_update_own_post" on food_posts for update using (donor_id = auth.uid());
create policy "admin_full_access_posts" on food_posts for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- CLAIMS
create policy "claimant_view_own_claims" on claims for select using (claimant_id = auth.uid());
create policy "donor_view_claims_on_own_posts" on claims for select using (
  exists (select 1 from food_posts where food_posts.id = claims.post_id and food_posts.donor_id = auth.uid())
);
create policy "claimant_insert_claim" on claims for insert with check (claimant_id = auth.uid());
create policy "donor_update_claim_status" on claims for update using (
  exists (select 1 from food_posts where food_posts.id = claims.post_id and food_posts.donor_id = auth.uid())
);
create policy "admin_full_access_claims" on claims for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- NOTIFICATIONS
create policy "view_own_notifications" on notifications for select using (user_id = auth.uid());
create policy "update_own_notifications" on notifications for update using (user_id = auth.uid());

-- REPORTS
create policy "insert_own_report" on reports for insert with check (reporter_id = auth.uid());
create policy "admin_manage_reports" on reports for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ADMIN_LOGS
create policy "admin_only_logs" on admin_logs for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
```

## 4. Server-Side Functions (RPC)

### 4.1 Atomic claim function
```sql
create or replace function claim_food(post_id uuid, claimant_id uuid, qty int)
returns void as $$
begin
  update food_posts
  set quantity_remaining = quantity_remaining - qty,
      status = case when quantity_remaining - qty <= 0 then 'fully_claimed' else status end
  where id = post_id and quantity_remaining >= qty;

  if not found then
    raise exception 'Not enough quantity remaining';
  end if;

  insert into claims (post_id, claimant_id, quantity_claimed)
  values (post_id, claimant_id, qty);
end;
$$ language plpgsql security definer;
```

### 4.2 Scheduled expiration job
```sql
select cron.schedule('expire-posts', '*/5 * * * *', $$
  update food_posts set status = 'expired'
  where status = 'active' and expires_at < now();
$$);
```

## 5. Storage Bucket
```sql
-- Created via Supabase Dashboard or API
-- bucket: food-photos
-- public read, authenticated write, path convention: {donor_id}/{timestamp}.jpg
```

## 6. Notes for Antigravity / AI Agent
- Run schema creation scripts in the order: `profiles` → `food_posts` → `claims` → `notifications` → `reports` → `admin_logs`, then enable RLS and add policies, then create functions and the cron job.
- `profiles.id` must match `auth.users.id` exactly — create a trigger on `auth.users` insert to auto-create a matching `profiles` row.
