-- Allow users to insert their own profile record if missing
drop policy if exists "insert_own_profile" on public.profiles;
create policy "insert_own_profile" on public.profiles for insert with check (id = auth.uid());
