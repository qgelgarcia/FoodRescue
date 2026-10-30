import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsPath = path.join(root, 'supabase', 'migrations');
let db;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema auth;
    create schema storage;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;

    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );

    create function auth.uid()
    returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role()
    returns text language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant execute on function auth.role() to anon, authenticated, service_role;

    create function storage.foldername(name text)
    returns text[] language sql immutable
    as $$ select string_to_array(name, '/') $$;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id),
      name text not null,
      owner uuid,
      created_at timestamptz not null default now()
    );
    grant select, insert, update, delete on storage.buckets, storage.objects
      to anon, authenticated, service_role;

    alter default privileges in schema public
      grant select, insert, update, delete on tables to anon, authenticated, service_role;
    alter default privileges in schema public
      grant usage, select, update on sequences to anon, authenticated, service_role;
  `);

  const migrations = (await readdir(migrationsPath))
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort();
  for (const migration of migrations) {
    try {
      await db.exec(await readFile(path.join(migrationsPath, migration), 'utf8'));
    } catch (error) {
      throw new Error(`Failed to apply repository migration ${migration}: ${error.message}`, { cause: error });
    }
  }
});

after(async () => db?.close());

async function asRole(role, userId, callback) {
  await db.exec(`set role ${role}`);
  try {
    await db.query(
      `select set_config('request.jwt.claim.sub', $1, false),
              set_config('request.jwt.claim.role', $2, false)`,
      [userId ?? '', role],
    );
    return await callback();
  } finally {
    await db.exec('reset role');
    await db.query(
      `select set_config('request.jwt.claim.sub', '', false),
              set_config('request.jwt.claim.role', '', false)`,
    );
  }
}

const asMember = (userId, callback) => asRole('authenticated', userId, callback);

async function createMember({ role = 'student', status = 'active' } = {}) {
  const id = randomUUID();
  await db.query(
    'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)',
    [id, `${id}@foodrescue.test`, JSON.stringify({ full_name: `${role} ${id.slice(0, 8)}`, role: 'student' })],
  );
  await db.query('update public.profiles set role = $2, status = $3 where id = $1', [id, role, status]);
  return id;
}

async function createPost(donorId, expiresInSeconds = 3600) {
  const id = randomUUID();
  await db.query(
    `insert into public.food_posts (
       id, donor_id, food_name, description, category,
       quantity_total, quantity_remaining, pickup_lat, pickup_lng,
       pickup_address, expires_at
     ) values ($1, $2, 'Test meal', 'Journey test', 'Meals', 1, 1,
               25.03, 121.56, 'Test pickup point',
               clock_timestamp() + $3::double precision * interval '1 second')`,
    [id, donorId, expiresInSeconds],
  );
  return id;
}

async function createAcceptedClaim(donorId, claimantId, expiresInSeconds = 3600) {
  const postId = await createPost(donorId, expiresInSeconds);
  const claimResult = await asMember(claimantId, () =>
    db.query('select * from public.claim_food($1, $2, 1)', [postId, claimantId]),
  );
  const claimId = claimResult.rows[0].claim_id;
  await asMember(donorId, () => db.query('select public.decide_food_claim($1, true, null)', [claimId]));
  return { postId, claimId };
}

async function sendOnMyWay(claimantId, claimId) {
  const result = await asMember(claimantId, () => db.query(
    'select public.claim_on_my_way($1) as sent', [claimId],
  ));
  return result.rows[0].sent;
}

async function startSharing(claimantId, claimId) {
  const result = await asMember(claimantId, () => db.query(
    'select public.start_claim_journey_sharing($1) as token', [claimId],
  ));
  return result.rows[0].token;
}

async function publish(claimantId, claimId, token, sequence, lat = 25.03, lng = 121.56) {
  const result = await asMember(claimantId, () => db.query(
    'select public.publish_claim_journey_location($1, $2, $3, $4, $5) as published',
    [claimId, token, sequence, lat, lng],
  ));
  return result.rows[0].published;
}

test('departure notices and latest-location sharing are claimant-controlled and terminal-safe', async () => {
  const donor = await createMember({ role: 'provider' });
  const otherDonor = await createMember({ role: 'provider' });
  const claimant = await createMember();
  const otherClaimant = await createMember();
  const admin = await createMember({ role: 'admin' });
  const { postId, claimId } = await createAcceptedClaim(donor, claimant);

  await assert.rejects(sendOnMyWay(otherClaimant, claimId), /Only the claimant/);
  assert.equal(await sendOnMyWay(claimant, claimId), true);
  assert.equal(await sendOnMyWay(claimant, claimId), false, 'a repeated tap must not create another notice');

  const departureTime = await asMember(claimant, () => db.query(
    'select on_my_way_at, pickup_lat, pickup_lng from public.get_my_food_claims() where id = $1', [claimId],
  ));
  assert.ok(departureTime.rows[0]?.on_my_way_at, 'claimant history exposes the server departure time');
  assert.equal(Number(departureTime.rows[0].pickup_lat), 25.03, 'claimant pickup history exposes the saved map pin');
  assert.equal(Number(departureTime.rows[0].pickup_lng), 121.56, 'claimant pickup history exposes the saved map pin');
  const donorClaim = await asMember(donor, () => db.query(
    'select on_my_way_at from public.get_donor_food_claims() where id = $1', [claimId],
  ));
  assert.ok(donorClaim.rows[0]?.on_my_way_at, 'donor history exposes the departure notice time');

  const donorNotice = await asMember(donor, () => db.query(
    `select count(*)::int as count from public.notifications
     where user_id = $1 and type = 'on_my_way' and related_post_id = $2`, [donor, postId],
  ));
  const otherNotice = await asMember(otherDonor, () => db.query(
    `select count(*)::int as count from public.notifications where type = 'on_my_way'`,
  ));
  assert.equal(donorNotice.rows[0].count, 1, 'only the listing donor receives one notice');
  assert.equal(otherNotice.rows[0].count, 0, 'other donors do not receive a notice');

  await assert.rejects(
    asMember(claimant, () => db.query(
      `insert into public.claim_journeys (claim_id, share_token) values ($1, gen_random_uuid())`, [claimId],
    )),
    /permission/i,
    'claimants cannot write coordinates directly without the consent-bound session RPC',
  );

  const token = await startSharing(claimant, claimId);
  assert.equal(await asMember(claimant, () => db.query(
    'select public.my_claim_journey_sharing_active($1) as active', [claimId],
  )).then((result) => result.rows[0].active), true);
  assert.equal(await publish(claimant, claimId, token, 1, 25.04, 121.57), true);
  assert.equal(await publish(claimant, claimId, token, 3, 25.05, 121.58), true);
  assert.equal(await publish(claimant, claimId, token, 2, 25.01, 121.51), false, 'an older async update cannot replace a newer point');
  await assert.rejects(publish(otherClaimant, claimId, token, 4), /Only the claimant/);

  const donorLocation = await asMember(donor, () => db.query(
    'select claim_id, lat, lng, updated_at from public.claim_journeys where claim_id = $1', [claimId],
  ));
  assert.equal(donorLocation.rows.length, 1);
  assert.equal(donorLocation.rows[0].lat, 25.05);
  assert.equal(donorLocation.rows[0].lng, 121.58);

  for (const reader of [claimant, otherClaimant, otherDonor, admin]) {
    const rows = await asMember(reader, () => db.query(
      'select claim_id, lat, lng, updated_at from public.claim_journeys where claim_id = $1', [claimId],
    ));
    assert.equal(rows.rows.length, 0, 'only this claim’s donor can read its coordinates');
  }
  await assert.rejects(
    asMember(claimant, () => db.query('select share_token from public.claim_journeys where claim_id = $1', [claimId])),
    /permission/i,
    'the claimant cannot read the table token or location directly',
  );

  const nextToken = await startSharing(claimant, claimId);
  assert.notEqual(nextToken, token, 'a new consent session invalidates old in-flight updates');
  const resetPoint = await asMember(donor, () => db.query(
    'select lat, lng, updated_at from public.claim_journeys where claim_id = $1', [claimId],
  ));
  assert.deepEqual(resetPoint.rows[0], { lat: null, lng: null, updated_at: null });
  assert.equal(await publish(claimant, claimId, token, 4), false, 'a prior session cannot update a resumed journey');
  assert.equal(await publish(claimant, claimId, nextToken, 1, 25.06, 121.59), true);

  await asMember(claimant, () => db.query('select public.stop_claim_journey_sharing($1)', [claimId]));
  const stopped = await asMember(donor, () => db.query(
    'select claim_id from public.claim_journeys where claim_id = $1', [claimId],
  ));
  assert.equal(stopped.rows.length, 0, 'manual stop deletes the latest coordinates and session');
  assert.equal(await publish(claimant, claimId, nextToken, 2), false, 'late updates cannot restore a manually stopped row');
  assert.equal(await asMember(claimant, () => db.query(
    'select public.my_claim_journey_sharing_active($1) as active', [claimId],
  )).then((result) => result.rows[0].active), false);

  const cancelToken = await startSharing(claimant, claimId);
  assert.equal(await publish(claimant, claimId, cancelToken, 1), true);
  await asMember(donor, () => db.query(
    'select public.cancel_food_post($1, $2)', [postId, 'Pickup arrangements changed'],
  ));
  assert.equal((await db.query('select 1 from public.claim_journeys where claim_id = $1', [claimId])).rows.length, 0,
    'donor cancellation deletes the current point');
  assert.equal(await publish(claimant, claimId, cancelToken, 2), false, 'a late update cannot restore a donor-cancelled journey');

  const { postId: adminPost, claimId: adminClaim } = await createAcceptedClaim(donor, claimant);
  await sendOnMyWay(claimant, adminClaim);
  const adminToken = await startSharing(claimant, adminClaim);
  await publish(claimant, adminClaim, adminToken, 1);
  await asMember(admin, () => db.query(
    'select public.admin_remove_food_post($1, $2)', [adminPost, 'Moderation removal fixture'],
  ));
  assert.equal((await db.query('select 1 from public.claim_journeys where claim_id = $1', [adminClaim])).rows.length, 0,
    'admin post removal deletes the current point');
  assert.equal(await publish(claimant, adminClaim, adminToken, 2), false);

  const { postId: expiringPost, claimId: expiringClaim } = await createAcceptedClaim(donor, claimant, 1);
  await sendOnMyWay(claimant, expiringClaim);
  const expiryToken = await startSharing(claimant, expiringClaim);
  await publish(claimant, expiringClaim, expiryToken, 1);
  await db.query("select pg_sleep(1.1)");
  const expiredCount = await asRole('service_role', null, () => db.query('select public.expire_food_posts() as count'));
  assert.equal(expiredCount.rows[0].count, 1, 'scheduled expiration closes due listings');
  assert.equal((await db.query('select 1 from public.claim_journeys where claim_id = $1', [expiringClaim])).rows.length, 0,
    'expiration deletes the current point');
  assert.equal(await publish(claimant, expiringClaim, expiryToken, 2), false, 'a late update cannot restore an expired journey');
  assert.equal((await db.query('select status from public.food_posts where id = $1', [expiringPost])).rows[0].status, 'expired');
});
