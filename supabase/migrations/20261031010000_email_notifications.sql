create function public.email_distance_m(lat1 double precision,lng1 double precision,lat2 double precision,lng2 double precision)
returns double precision language sql immutable set search_path = public, pg_temp as $$
  select 12742000 * asin(sqrt(least(1.0,greatest(0.0,
    power(sin(radians((lat1-lat2)/2)),2)+cos(radians(lat1))*cos(radians(lat2))*power(sin(radians((lng1-lng2)/2)),2)))));
$$;
revoke all on function public.email_distance_m(double precision,double precision,double precision,double precision) from public, anon, authenticated;

-- Server-owned email queue. No browser can choose recipients or forge email events.
create table public.email_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  claims_enabled boolean not null default true,
  receipts_enabled boolean not null default true,
  nearby_enabled boolean not null default false,
  alert_lat double precision,
  alert_lng double precision,
  radius_m integer not null default 1000 check (radius_m between 500 and 5000),
  check ((alert_lat is null) = (alert_lng is null)),
  check (alert_lat is null or (alert_lat between -90 and 90 and alert_lng between -180 and 180)),
  check (not nearby_enabled or alert_lat is not null),
  check (nearby_enabled or alert_lat is null)
);
alter table public.email_preferences enable row level security;
revoke all on public.email_preferences from anon, authenticated;
grant select, insert, update on public.email_preferences to authenticated;
grant all on public.email_preferences to service_role;
create policy email_preferences_owner on public.email_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('claim','receipt','nearby')),
  post_id uuid references public.food_posts(id) on delete set null,
  claim_id uuid references public.claims(id) on delete set null,
  event_key text not null unique,
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending','processing','sent','skipped','failed','uncertain')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  smtp_started_at timestamptz,
  recipient_email text,
  provider_id text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index email_outbox_pending on public.email_outbox (next_attempt_at, created_at)
  where state in ('pending','processing');
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant all on public.email_outbox to service_role;

create function public.queue_claim_email() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare p public.food_posts%rowtype; v_kind text; v_payload jsonb; v_claimant text; v_donor text;
begin
  if TG_OP = 'UPDATE' then
    if new.status is not distinct from old.status then return new; end if;
  end if;
  select * into p from public.food_posts where id = new.post_id;
  select full_name into v_claimant from public.profiles where id = new.claimant_id;
  select full_name into v_donor from public.profiles where id = p.donor_id;
  v_kind := case when new.status = 'picked_up' then 'receipt' else 'claim' end;
  v_payload := jsonb_build_object('foodName',p.food_name,'quantity',new.quantity_claimed,
    'status',new.status,'claimantName',v_claimant,'donorName',v_donor,
    'pickupAddress',p.pickup_address,'pickupDeadline',p.expires_at,
    'eventAt',coalesce(new.updated_at,new.claimed_at,now()),'claimReference',new.id);
  insert into public.email_outbox(user_id,kind,post_id,claim_id,event_key,payload)
  select recipient,v_kind,new.post_id,new.id,new.id::text||':'||new.status||':'||recipient::text,
    v_payload || jsonb_build_object('audience',case when recipient = new.claimant_id then 'claimant' else 'donor' end)
  from unnest(array[new.claimant_id,p.donor_id]) recipient
  left join public.email_preferences pref on pref.user_id = recipient
  where case when v_kind = 'receipt' then coalesce(pref.receipts_enabled,true) else coalesce(pref.claims_enabled,true) end
  on conflict (event_key) do nothing;
  return new;
end $$;
revoke all on function public.queue_claim_email() from public, anon, authenticated;
create trigger email_claim_event after insert or update of status on public.claims
for each row execute function public.queue_claim_email();

create function public.queue_nearby_food_email() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.status <> 'active' or new.quantity_remaining <= 0 or new.expires_at <= now() then return new; end if;
  insert into public.email_outbox(user_id,kind,post_id,event_key,payload)
  select pref.user_id,'nearby',new.id,'nearby:'||new.id::text||':'||pref.user_id::text,
    jsonb_build_object('foodName',new.food_name,'quantity',new.quantity_remaining,
      'pickupAddress',new.pickup_address,'pickupDeadline',new.expires_at)
  from public.email_preferences pref
  join public.profiles member on member.id = pref.user_id and member.status = 'active'
  where pref.nearby_enabled and pref.user_id <> new.donor_id
    and public.email_distance_m(pref.alert_lat,pref.alert_lng,new.pickup_lat::double precision,new.pickup_lng::double precision) <= pref.radius_m
  on conflict (event_key) do nothing;
  return new;
end $$;
revoke all on function public.queue_nearby_food_email() from public, anon, authenticated;
create trigger email_nearby_food after insert on public.food_posts
for each row execute function public.queue_nearby_food_email();

-- Recipients are resolved from verified Auth email, never caller-supplied profile fields.
create function public.claim_email_jobs(p_limit integer default 5) returns setof public.email_outbox
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.email_outbox set state='uncertain',finished_at=now(),lease_id=null,lease_until=null
    where state='processing' and lease_until<now() and smtp_started_at is not null;
  update public.email_outbox q set state = 'skipped', finished_at = now(), lease_id = null
  where q.state in ('pending','processing') and (q.lease_until is null or q.lease_until < now()) and (
    q.created_at < now() - interval '20 hours' or q.attempts >= 5
    or not exists (select 1 from auth.users u where u.id=q.user_id and u.email_confirmed_at is not null
      and u.email is not null and (q.recipient_email is null or q.recipient_email = u.email))
    or not exists (select 1 from public.profiles member where member.id=q.user_id and member.status in ('active','suspended')
      and (q.kind<>'nearby' or member.status='active'))
    or exists (select 1 from public.email_preferences pref where pref.user_id=q.user_id and
      ((q.kind='claim' and not pref.claims_enabled) or (q.kind='receipt' and not pref.receipts_enabled) or (q.kind='nearby' and not pref.nearby_enabled)))
    or (q.kind='nearby' and (not exists(select 1 from public.email_preferences pref where pref.user_id=q.user_id and pref.nearby_enabled)
      or not exists(select 1 from public.food_posts p join public.email_preferences pref on pref.user_id=q.user_id
        where p.id=q.post_id and p.status='active' and p.quantity_remaining>0 and p.expires_at>now()
        and public.email_distance_m(pref.alert_lat,pref.alert_lng,p.pickup_lat::double precision,p.pickup_lng::double precision)<=pref.radius_m)))
    or (q.kind='claim' and not exists(select 1 from public.claims c where c.id=q.claim_id and c.status=q.payload->>'status'))
  );
  return query
  with batch as (
    select q.id from public.email_outbox q where
      (q.state='pending' or (q.state='processing' and q.lease_until < now()))
      and q.next_attempt_at<=now() and q.attempts<5 and q.created_at>=now()-interval '20 hours'
    order by q.created_at for update skip locked limit greatest(1,least(p_limit,10))
  )
  update public.email_outbox q set state='processing', attempts=q.attempts+1,
    lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',
    recipient_email=coalesce(q.recipient_email,(select u.email from auth.users u where u.id=q.user_id))
  from batch where q.id=batch.id returning q.*;
end $$;

create function public.finish_email_job(p_id uuid,p_lease uuid,p_result text,p_provider_id text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_result not in ('sent','retry','failed','uncertain') then raise exception 'Invalid result'; end if;
  update public.email_outbox set
    state=case when p_result='retry' and attempts<5 then 'pending' when p_result='retry' then 'failed' else p_result end,
    next_attempt_at=now()+make_interval(secs=>least(1800,(30*power(2,attempts))::integer)),
    finished_at=case when p_result='retry' and attempts<5 then null else now() end,
    provider_id=case when p_result='sent' then left(p_provider_id,200) else provider_id end,
    smtp_started_at=case when p_result='retry' then null else smtp_started_at end,
    lease_id=null,lease_until=null
  where id=p_id and lease_id=p_lease and state='processing';
end $$;
revoke all on function public.claim_email_jobs(integer) from public, anon, authenticated;
revoke all on function public.finish_email_job(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_email_jobs(integer), public.finish_email_job(uuid,uuid,text,text) to service_role;


create function public.purge_email_history() returns void language sql security definer
set search_path = public, pg_temp as $$
  delete from public.email_outbox where finished_at < now()-interval '30 days';
$$;
revoke all on function public.purge_email_history() from public, anon, authenticated;
grant execute on function public.purge_email_history() to service_role;


create function public.prepare_smtp_email_job(p_id uuid,p_lease uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.email_outbox set smtp_started_at=now() where id=p_id and lease_id=p_lease and state='processing' and lease_until>now() and smtp_started_at is null;
  return found;
end $$;
revoke all on function public.prepare_smtp_email_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_smtp_email_job(uuid,uuid) to service_role;
