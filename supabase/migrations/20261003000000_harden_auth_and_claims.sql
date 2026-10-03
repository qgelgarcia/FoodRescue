-- Harden user-controlled metadata and the atomic claim RPC.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Campus Member'),
    new.raw_user_meta_data->>'phone',
    case
      when new.raw_user_meta_data->>'role' in ('student', 'org', 'provider')
        then new.raw_user_meta_data->>'role'
      else 'student'
    end
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, profiles.phone),
    role = profiles.role;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.prevent_profile_role_escalation()
returns trigger as $$
begin
  if old.role is distinct from new.role
     and auth.uid() is not null
     and (auth.uid() <> old.id or not public.is_admin()) then
    raise exception 'Users cannot change their own profile role';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_profile_role_escalation();

create or replace function public.claim_food(post_id uuid, claimant_id uuid, qty int)
returns void as $$
begin
  if auth.uid() is null or auth.uid() <> claimant_id then
    raise exception 'The authenticated user can only create claims for their own account';
  end if;

  if qty is null or qty <= 0 then
    raise exception 'Claim quantity must be greater than zero';
  end if;

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
$$ language plpgsql security definer set search_path = public;

revoke all on function public.claim_food(uuid, uuid, int) from public;
grant execute on function public.claim_food(uuid, uuid, int) to authenticated;
