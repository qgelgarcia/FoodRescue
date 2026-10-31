-- Wake the Vercel email processor from Supabase Cron; secrets live in Vault.
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create function public.dispatch_email_queue() returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_url text;v_secret text;v_request bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name='foodrescue_email_dispatch_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='foodrescue_email_dispatch_secret' limit 1;
  if v_url is null or v_secret is null then return null; end if;
  if v_url !~ '^https://[a-z0-9.-]+\.vercel\.app/api/internal/email-dispatch$' then raise exception 'Invalid email dispatch destination'; end if;
  select net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),body:='{}'::jsonb,timeout_milliseconds:=110000) into v_request;
  return v_request;
end $$;
revoke all on function public.dispatch_email_queue() from public,anon,authenticated;
grant execute on function public.dispatch_email_queue() to service_role;
select cron.schedule('foodrescue-email-dispatch','* * * * *','select public.dispatch_email_queue();');
