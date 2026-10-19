import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = dotenv.parse(await readFile(path.join(root, 'apps/backend/.env')));
const databaseUrl = new URL((await readFile(path.join(root, 'supabase/.temp/pooler-url'), 'utf8')).trim());
databaseUrl.password = env.DB_PASSWORD || '';
if (!databaseUrl.password) throw new Error('DB_PASSWORD is required in apps/backend/.env.');
const ca = await readFile(env.DB_SSL_CA || path.join(root, 'supabase/.temp/prod-ca-2021.crt'), 'utf8');
const client = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: true, ca }, connectionTimeoutMillis: 10000, query_timeout: 30000 });

try {
  await client.connect();
  const { rows } = await client.query('select version from supabase_migrations.schema_migrations order by version');
  const applied = new Set(rows.map((row) => row.version));
  const files = (await readdir(path.join(root, 'supabase/migrations'))).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  const missing = files.filter((name) => !applied.has(name.split('_')[0]));
  console.log('Pending repository migrations:', missing.length ? missing.join(', ') : 'none');
  if (process.argv.includes('--apply')) {
    // Explicit allow-list: do not silently apply unrelated future migrations.
    const allowed = new Set(['20261021000000_add_donor_listing_archive.sql', '20261022000000_claim_decisions_and_pickup.sql']);
    if (missing.some((name) => !allowed.has(name))) throw new Error('Other pending migrations need review before applying the claim workflow.');
    await client.query('begin');
    try {
      await client.query("set local lock_timeout = '10s'");
      for (const name of missing) {
        const sql = await readFile(path.join(root, 'supabase/migrations', name), 'utf8');
        await client.query(sql);
        await client.query('insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)', [name.split('_')[0], name.replace(/^\d+_/, '').replace(/\.sql$/, ''), [sql]]);
        console.log('Applied:', name);
      }
      await client.query("notify pgrst, 'reload schema'");
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
  const result = await client.query("select to_regprocedure('public.verify_food_pickup(text)') is not null as donor_pickup, to_regprocedure('public.decide_food_claim(uuid,boolean,text)') is not null as donor_decisions, to_regprocedure('public.request_claim_cancellation(uuid,text)') is not null as cancellation_requests");
  console.log('Installed workflow:', JSON.stringify(result.rows[0]));
} catch (error) {
  // Connection strings and secrets must never be included in logs.
  console.error('Migration operation failed:', error.code || error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
