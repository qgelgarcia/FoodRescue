create table public.terms_acceptances (
 user_id uuid not null references public.profiles(id) on delete cascade,
 terms_version text not null,
 accepted_at timestamptz not null default now(),
 primary key(user_id,terms_version)
);
alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from public,anon,authenticated;
grant select on public.terms_acceptances to authenticated;
grant all on public.terms_acceptances to service_role;
create policy terms_read_own on public.terms_acceptances for select to authenticated using(user_id=auth.uid());

create function public.accept_current_terms(p_version text,p_email_updates boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid();v_acceptance public.terms_acceptances;
begin
 if v_user is null then raise exception 'Sign in to review terms';end if;
 if p_version is distinct from '2026-10-31.1' or p_email_updates is null then raise exception 'Review the current terms version';end if;
 if not exists(select 1 from public.profiles where id=v_user) then raise exception 'Account unavailable';end if;
 insert into public.terms_acceptances(user_id,terms_version) values(v_user,p_version) on conflict do nothing;
 -- Do not let a replay of acceptance overwrite preferences changed later in Profile.
 if found then
   insert into public.email_preferences(user_id,claims_enabled,receipts_enabled)
   values(v_user,p_email_updates,p_email_updates)
   on conflict(user_id) do update set claims_enabled=excluded.claims_enabled,receipts_enabled=excluded.receipts_enabled;
 end if;
 select * into v_acceptance from public.terms_acceptances where user_id=v_user and terms_version=p_version;
 return to_jsonb(v_acceptance);
end $$;
revoke all on function public.accept_current_terms(text,boolean) from public,anon;
grant execute on function public.accept_current_terms(text,boolean) to authenticated;

-- The delivery worker, including a direct service-role RPC call, cannot send app
-- notification email before the recipient accepts the current disclosure.
alter function public.claim_email_jobs(integer) rename to claim_email_jobs_before_consent;
revoke all on function public.claim_email_jobs_before_consent(integer) from public,anon,authenticated,service_role;
create function public.claim_email_jobs(p_limit integer default 5) returns setof public.email_outbox
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.email_outbox q set state='skipped',finished_at=now(),lease_id=null,lease_until=null
 where (q.state='pending' or (q.state='processing' and q.lease_until<now())) and not exists(select 1 from public.terms_acceptances t where t.user_id=q.user_id and t.terms_version='2026-10-31.1');
 return query select * from public.claim_email_jobs_before_consent(p_limit);
end $$;
revoke all on function public.claim_email_jobs(integer) from public,anon,authenticated;
grant execute on function public.claim_email_jobs(integer) to service_role;
