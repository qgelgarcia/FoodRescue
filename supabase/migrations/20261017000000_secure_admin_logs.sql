drop policy if exists "admin_only_logs" on public.admin_logs;
drop policy if exists "admin_read_logs" on public.admin_logs;
drop policy if exists "admin_insert_own_logs" on public.admin_logs;

create policy "admin_read_logs" on public.admin_logs
  for select using (public.is_admin());

create policy "admin_insert_own_logs" on public.admin_logs
  for insert with check (public.is_admin() and admin_id = auth.uid());

revoke all on public.admin_logs from anon, authenticated;
grant select, insert on public.admin_logs to authenticated;

create index if not exists idx_admin_logs_created_at
  on public.admin_logs(created_at desc);
