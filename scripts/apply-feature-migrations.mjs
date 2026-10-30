import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowed = new Set([
  '20261029010000_post_photos_and_pickup_constraints.sql',
  '20261029020000_post_cancellation_and_expiration.sql',
  '20261029030000_claimant_journey_sharing.sql',
  '20261030010000_enable_notification_realtime.sql',
  '20261030020000_profile_avatars.sql',
  '20261030030000_notification_destinations.sql',
]);
const env = dotenv.parse(await readFile(path.join(root, 'apps/backend/.env')));
const databaseUrl = new URL((await readFile(path.join(root, 'supabase/.temp/pooler-url'), 'utf8')).trim());
databaseUrl.password = env.DB_PASSWORD || '';
if (!databaseUrl.password) throw new Error('Missing DB_PASSWORD in the ignored backend environment.');
const ca = await readFile(env.DB_SSL_CA || path.join(root, 'supabase/.temp/prod-ca-2021.crt'), 'utf8');
const client = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: true, ca }, connectionTimeoutMillis: 10000, query_timeout: 30000 });
let phase = 'connect';
let transaction = false;
try {
  await client.connect();
  const projectRef = (await readFile(path.join(root, 'supabase/.temp/project-ref'), 'utf8')).trim();
  console.log('Linked Supabase project:', projectRef);
  const { rows: versions } = await client.query('select version from supabase_migrations.schema_migrations order by version');
  const applied = new Set(versions.map(row => row.version));
  const files = (await readdir(path.join(root, 'supabase/migrations'))).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  const pending = files.filter(name => !applied.has(name.split('_')[0]));
  if (pending.some(name => !allowed.has(name))) throw new Error('Unreviewed migrations are pending; refusing this feature deployment.');
  console.log('Pending feature migrations:', pending.length ? pending.join(', ') : 'none');
  phase = 'constraint preflight';
  const { rows: checks } = await client.query(`
    select
      (select count(*)::integer from public.food_posts where
        pickup_lat not between -90 and 90 or pickup_lng not between -180 and 180 or
        (status in ('active','fully_claimed') and (pickup_lat is null or pickup_lng is null))) as invalid_locations,
      (select count(*)::integer from public.notifications where type not in (
        'new_post_nearby','claim_received','claim_accepted','claim_rejected',
        'pickup_reminder','broadcast','moderation_update','on_my_way')) as invalid_notification_types,
      exists(select 1 from pg_available_extensions where name='pg_cron') as cron_available,
      exists(select 1 from pg_extension where extname='pg_cron') as cron_installed,
      exists(select 1 from pg_publication where pubname='supabase_realtime') as realtime_publication
  `);
  console.log('Preflight:', JSON.stringify(checks[0]));
  if (checks[0].invalid_locations || checks[0].invalid_notification_types) throw new Error('Existing data fails the new constraints. No changes applied.');
  if (process.argv.includes('--apply')) {
    phase = 'transaction';
    await client.query('begin'); transaction = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("select pg_advisory_xact_lock(hashtext('foodrescue-feature-deployment'))");
    if (!checks[0].cron_installed) {
      if (!checks[0].cron_available) throw new Error('Supabase Cron is unavailable.');
      await client.query('create extension if not exists pg_cron with schema pg_catalog');
    }
    for (const name of pending) {
      phase = name;
      const sql = await readFile(path.join(root, 'supabase/migrations', name), 'utf8');
      await client.query(sql);
      await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)', [name.split('_')[0], name.replace(/^\d+_/, '').replace(/\.sql$/, ''), [sql]]);
    }
    // Also handles an environment where the lifecycle migration preceded enabling Cron.
    await client.query("select cron.schedule('foodrescue-expire-posts','* * * * *','select public.expire_food_posts();')");
    if (!checks[0].realtime_publication) throw new Error('Expected Supabase Realtime publication is missing.');
    await client.query("notify pgrst, 'reload schema'");
    await client.query('commit'); transaction = false;
    console.log('Committed migrations:', pending.length);
  }
  phase = 'verification';
  const { rows: state } = await client.query(`select
    to_regprocedure('public.cancel_food_post(uuid,text)') is not null as donor_cancellation,
    to_regprocedure('public.expire_food_posts()') is not null as expiration,
    to_regprocedure('public.claim_on_my_way(uuid)') is not null as departure,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='related_claim_id')
      and exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='related_report_id') as notification_destinations,
    case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='related_claim_id')
      then not has_column_privilege('authenticated','public.notifications','related_claim_id','update')
        and not has_column_privilege('authenticated','public.notifications','related_report_id','update')
        and has_column_privilege('authenticated','public.notifications','is_read','update')
      else false end as notification_targets_protected,
    to_regprocedure('public.publish_claim_journey_location(uuid,uuid,bigint,double precision,double precision)') is not null as journey,
    exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') as notification_realtime,
    (select file_size_limit=5242880 and allowed_mime_types @> array['image/jpeg','image/png','image/webp'] from storage.buckets where id='food-photos') as photo_limits,
    (select public=false and file_size_limit=5242880 and allowed_mime_types @> array['image/jpeg','image/png','image/webp'] from storage.buckets where id='profile-avatars') as private_avatar_limits
  `);
  console.log('Installed features:', JSON.stringify(state[0]));
  if (process.argv.includes('--apply') && Object.values(state[0]).some(value => value !== true)) throw new Error('Feature verification failed after migration commit.');
  if ((await client.query("select to_regclass('cron.job') is not null as installed")).rows[0].installed) {
    console.log('Expiration job:', JSON.stringify((await client.query("select jobname,schedule,active from cron.job where jobname='foodrescue-expire-posts'")).rows));
    console.log('Latest expiration run:', JSON.stringify((await client.query("select r.status,r.start_time,r.end_time from cron.job_run_details r join cron.job j using(jobid) where j.jobname='foodrescue-expire-posts' order by r.start_time desc limit 1")).rows));
  }
} catch (error) {
  if (transaction) await client.query('rollback').catch(() => {});
  console.error(`Feature deployment failed (${phase}):`, error.code || error.message);
  process.exitCode = 1;
} finally { await client.end(); }
