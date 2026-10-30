import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import dotenv from 'dotenv';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsPath = path.join(root, 'supabase', 'migrations');
const workflowMigration = '20261022000000_claim_decisions_and_pickup.sql';
const remoteMode = process.env.CLAIM_WORKFLOW_REMOTE === '1';

let db;
let remoteClient;
let remoteTransactionOpen = false;

class SavepointDatabase {
  #client;
  #savepointId = 0;

  constructor(client) {
    this.#client = client;
  }

  exec(sql) {
    return this.query(sql);
  }

  async query(sql, values) {
    const savepoint = `claim_workflow_sp_${++this.#savepointId}`;
    await this.#client.query(`savepoint ${savepoint}`);
    let result;
    try {
      result = await this.#client.query(sql, values);
    } catch (error) {
      try {
        await this.#client.query(`rollback to savepoint ${savepoint}`);
        await this.#client.query(`release savepoint ${savepoint}`);
      } catch {
        // Keep the original database error; the after hook still attempts the full rollback.
      }
      throw error;
    }
    await this.#client.query(`release savepoint ${savepoint}`);
    return result;
  }
}

before(async () => {
  if (remoteMode) {
    await connectRemoteDatabase();
    return;
  }

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
    returns uuid
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

    create function auth.role()
    returns text
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;

    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant execute on function auth.role() to anon, authenticated, service_role;

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
    create function storage.foldername(name text)
    returns text[] language sql immutable
    as $$ select string_to_array(name, '/') $$;
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
    const sql = await readFile(path.join(migrationsPath, migration), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Failed to apply repository migration ${migration}: ${error.message}`, {
        cause: error,
      });
    }
  }

  assert.ok(
    migrations.includes(workflowMigration),
    `Expected ${workflowMigration} so this harness exercises the claim workflow migration`,
  );
});

after(async () => {
  if (remoteClient) {
    try {
      if (remoteTransactionOpen) await remoteClient.query('rollback');
    } finally {
      await remoteClient.end();
    }
  } else {
    await db?.close();
  }
});

async function connectRemoteDatabase() {
  const env = dotenv.parse(await readFile(path.join(root, 'apps', 'backend', '.env')));
  const databaseUrl = new URL(
    (await readFile(path.join(root, 'supabase', '.temp', 'pooler-url'), 'utf8')).trim(),
  );
  databaseUrl.password = env.DB_PASSWORD || '';
  if (!databaseUrl.password) throw new Error('DB_PASSWORD is required in apps/backend/.env.');
  const caPath = env.DB_SSL_CA || path.join(root, 'supabase', '.temp', 'prod-ca-2021.crt');
  const ca = await readFile(caPath, 'utf8');
  remoteClient = new pg.Client({
    connectionString: databaseUrl.toString(),
    ssl: { rejectUnauthorized: true, ca },
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
  });

  await remoteClient.connect();
  await remoteClient.query('begin');
  remoteTransactionOpen = true;
  db = new SavepointDatabase(remoteClient);

  const result = await db.query(`
    select exists (
             select 1 from supabase_migrations.schema_migrations
             where version = '20261022000000'
           ) as workflow_migration_applied,
           to_regprocedure('public.claim_food(uuid,uuid,integer)') is not null as claim_food,
           to_regprocedure('public.get_my_food_claims()') is not null as member_claims,
           to_regprocedure('public.get_donor_food_claims()') is not null as donor_claims,
           to_regprocedure('public.decide_food_claim(uuid,boolean,text)') is not null as decide_claim,
           to_regprocedure('public.request_claim_cancellation(uuid,text)') is not null as request_cancellation,
           to_regprocedure('public.decide_claim_cancellation(uuid,boolean,text)') is not null as decide_cancellation,
           to_regprocedure('public.verify_food_pickup(text)') is not null as verify_pickup,
           to_regprocedure('public.complete_food_claim(uuid,text)') is not null as complete_claim,
           to_regprocedure('public.admin_remove_food_post(uuid,text)') is not null as admin_remove,
           exists (
             select 1 from supabase_migrations.schema_migrations
             where version = '20261029020000'
           ) as lifecycle_migration_applied,
           to_regprocedure('public.cancel_food_post(uuid,text)') is not null as cancel_post,
           to_regprocedure('public.expire_food_posts()') is not null as expire_posts
  `);
  const missing = Object.entries(result.rows[0])
    .filter(([, installed]) => installed !== true)
    .map(([name]) => name);
  assert.deepEqual(
    missing,
    [],
    'Remote DB is missing the claim workflow or lifecycle migration/RPCs; apply the migrations before remote verification.',
  );

  const requiredColumns = await db.query(`
    select attname
    from pg_attribute
    where attrelid = 'auth.users'::regclass
      and attnum > 0
      and not attisdropped
      and attnotnull
      and atthasdef = false
      and attname not in ('id', 'email', 'raw_user_meta_data')
    order by attname
  `);
  assert.deepEqual(
    requiredColumns.rows.map((row) => row.attname),
    [],
    'Remote auth.users requires fields this rollback fixture does not supply; inspect the listed column names before adapting it.',
  );
}

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
  const id = crypto.randomUUID();
  const metadata = JSON.stringify({ full_name: `${role} ${id.slice(0, 8)}`, role: 'student' });
  await db.query(
    'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)',
    [id, `${id}@foodrescue.test`, metadata],
  );
  await db.query('update public.profiles set role = $2, status = $3 where id = $1', [
    id,
    role,
    status,
  ]);
  return id;
}

async function createPost(
  donorId,
  { quantity = 1, expiresAt = '2099-01-01T00:00:00Z', expiresInSeconds } = {},
) {
  const id = crypto.randomUUID();
  const expiresAtExpression =
    expiresInSeconds === undefined
      ? '$4::timestamptz'
      : "clock_timestamp() + $4::double precision * interval '1 second'";
  await db.query(
    `insert into public.food_posts (
       id, donor_id, food_name, description, category,
       quantity_total, quantity_remaining, pickup_lat, pickup_lng,
       pickup_address, expires_at
     ) values ($1, $2, 'Test meal', 'Integration fixture', 'Meals', $3, $3,
               25.03, 121.56, 'Test pickup point', ${expiresAtExpression})`,
    [id, donorId, quantity, expiresInSeconds ?? expiresAt],
  );
  return id;
}

async function startClaim(postId, claimantId, quantity = 1, signedInAs = claimantId) {
  const result = await asMember(signedInAs, () =>
    db.query('select * from public.claim_food($1, $2, $3)', [postId, claimantId, quantity]),
  );
  assert.equal(result.rows.length, 1, 'claim_food should create exactly one claim');
  return result.rows[0];
}

async function decideClaim(donorId, claimId, accept, reason = null) {
  return asMember(donorId, () =>
    db.query('select public.decide_food_claim($1, $2, $3)', [claimId, accept, reason]),
  );
}

async function requestCancellation(claimantId, claimId, reason = 'The pickup is no longer needed') {
  return asMember(claimantId, () =>
    db.query('select public.request_claim_cancellation($1, $2)', [claimId, reason]),
  );
}

async function decideCancellation(donorId, requestId, approve, reason = null) {
  return asMember(donorId, () =>
    db.query('select public.decide_claim_cancellation($1, $2, $3)', [requestId, approve, reason]),
  );
}

async function cancelPost(donorId, postId, reason = 'The food is no longer available') {
  return asMember(donorId, () =>
    db.query('select public.cancel_food_post($1, $2)', [postId, reason]),
  );
}

async function claimState(claimId) {
  const result = await db.query(
    `select c.status as claim_status, c.quantity_claimed,
            p.status as post_status, p.quantity_remaining,
            p.cancellation_reason,
            pa.pickup_code, pa.invalidated_at, pa.invalidation_reason
     from public.claims c
     join public.food_posts p on p.id = c.post_id
     left join public.pickup_authorizations pa on pa.claim_id = c.id
     where c.id = $1`,
    [claimId],
  );
  assert.equal(result.rows.length, 1, `expected claim ${claimId} to exist`);
  return result.rows[0];
}

async function pendingCancellationId(claimId) {
  const result = await db.query(
    `select id from public.claim_cancellation_requests
     where claim_id = $1 and status = 'pending'`,
    [claimId],
  );
  assert.equal(result.rows.length, 1, 'expected one pending cancellation request');
  return result.rows[0].id;
}

async function waitForPostDeadline(postId) {
  await db.query(
    `select pg_sleep(
       greatest(0::double precision,
         extract(epoch from (expires_at - clock_timestamp()))::double precision + 0.05)
     )
     from public.food_posts where id = $1`,
    [postId],
  );
}

test('claim_food enforces ownership, active membership, deadlines, and available quantity', async () => {
  const donor = await createMember({ role: 'provider' });
  const claimant = await createMember();
  const otherClaimant = await createMember();
  const suspended = await createMember({ status: 'suspended' });
  const expiredPost = await createPost(donor, {
    expiresAt: '2000-01-01T00:00:00Z',
  });
  const limitedPost = await createPost(donor, { quantity: 1 });

  await assert.rejects(startClaim(limitedPost, otherClaimant, 1, claimant));
  await assert.rejects(startClaim(limitedPost, suspended));
  await assert.rejects(startClaim(limitedPost, donor), 'a donor cannot claim their own listing');
  await assert.rejects(startClaim(expiredPost, claimant));
  await assert.rejects(startClaim(limitedPost, claimant, 0));
  await assert.rejects(startClaim(limitedPost, claimant, 2));

  const beforeSuccess = await db.query(
    `select quantity_remaining, status from public.food_posts where id = $1`,
    [limitedPost],
  );
  assert.deepEqual(beforeSuccess.rows[0], { quantity_remaining: 1, status: 'active' });

  const created = await startClaim(limitedPost, claimant, 1);
  const state = await claimState(created.claim_id);
  assert.equal(state.claim_status, 'pending');
  assert.equal(state.quantity_remaining, 0);
  assert.equal(state.post_status, 'fully_claimed');
  assert.equal(created.claim_code, null, 'a pending claim must not receive a usable pickup pass');

  const ownRows = await asMember(claimant, () =>
    db.query('select id from public.claims where id = $1', [created.claim_id]),
  );
  const otherRows = await asMember(otherClaimant, () =>
    db.query('select id from public.claims where id = $1', [created.claim_id]),
  );
  const donorRows = await asMember(donor, () =>
    db.query('select id from public.claims where id = $1', [created.claim_id]),
  );
  assert.equal(ownRows.rows.length, 1, 'claimant RLS should expose their claim');
  assert.equal(otherRows.rows.length, 0, 'claimant RLS should hide another member’s claim');
  assert.equal(donorRows.rows.length, 1, 'donor RLS should expose claims on their own listing');

  const ownHistory = await asMember(claimant, () =>
    db.query('select * from public.get_my_food_claims()'),
  );
  const otherHistory = await asMember(otherClaimant, () =>
    db.query('select * from public.get_my_food_claims()'),
  );
  assert.equal(ownHistory.rows.length, 1, 'claimant history should include their new claim');
  assert.equal(otherHistory.rows.length, 0, 'claimant history should be scoped to the caller');

  await assert.rejects(
    asRole('anon', null, () =>
      db.query('select * from public.claim_food($1, $2, 1)', [limitedPost, claimant]),
    ),
    /permission/i,
    'anonymous sessions must not call claim_food',
  );
});

test('donor acceptance holds stock and rejection releases it exactly once', async () => {
  const donor = await createMember({ role: 'provider' });
  const firstClaimant = await createMember();
  const secondClaimant = await createMember();
  const postId = await createPost(donor, { quantity: 2 });

  const accepted = await startClaim(postId, firstClaimant);
  const unrelatedDonor = await createMember({ role: 'provider' });
  await assert.rejects(
    decideClaim(unrelatedDonor, accepted.claim_id, true),
    'a different donor cannot accept this claim',
  );
  await decideClaim(donor, accepted.claim_id, true);
  const acceptedState = await claimState(accepted.claim_id);
  assert.equal(acceptedState.claim_status, 'accepted');
  assert.equal(acceptedState.quantity_remaining, 1, 'acceptance keeps the reservation held');
  assert.equal(acceptedState.post_status, 'active');
  assert.ok(acceptedState.pickup_code, 'an accepted claim receives a pickup pass');

  const rejected = await startClaim(postId, secondClaimant);
  await decideClaim(donor, rejected.claim_id, false, 'This pickup time is unavailable');
  const rejectedState = await claimState(rejected.claim_id);
  assert.equal(rejectedState.claim_status, 'rejected');
  assert.equal(
    rejectedState.quantity_remaining,
    1,
    'rejection returns its portion while the accepted claim stays reserved',
  );
  assert.equal(rejectedState.post_status, 'active', 'released stock reopens the listing');
  assert.equal(rejectedState.pickup_code, null, 'a rejected claim must not retain a pickup pass');

  await decideClaim(donor, rejected.claim_id, false, 'Repeated decision').catch(() => {});
  const afterReplay = await claimState(rejected.claim_id);
  assert.equal(afterReplay.quantity_remaining, 1, 'replaying rejection must not release stock twice');
  assert.equal(afterReplay.post_status, 'active');

  const donorClaims = await asMember(donor, () =>
    db.query('select * from public.get_donor_food_claims()'),
  );
  const unrelatedClaims = await asMember(await createMember({ role: 'provider' }), () =>
    db.query('select * from public.get_donor_food_claims()'),
  );
  assert.ok(donorClaims.rows.length >= 1, 'donor view should include claims on the donor’s listing');
  assert.equal(unrelatedClaims.rows.length, 0, 'donor history should not expose other listings');
});

test('only the owning donor can verify an accepted pass, and one pass can complete once', async () => {
  const donor = await createMember({ role: 'provider' });
  const otherDonor = await createMember({ role: 'provider' });
  const claimant = await createMember();
  const postId = await createPost(donor);
  const created = await startClaim(postId, claimant);
  const pendingState = await claimState(created.claim_id);

  if (pendingState.pickup_code) {
    await assert.rejects(
      asMember(donor, () =>
        db.query('select public.verify_food_pickup($1)', [pendingState.pickup_code]),
      ),
      'a pending claim cannot be picked up',
    );
  } else {
    assert.equal(pendingState.pickup_code, null, 'pending claims must not expose a pickup pass');
  }

  await decideClaim(donor, created.claim_id, true);
  const accepted = await claimState(created.claim_id);
  const code = accepted.pickup_code;
  assert.ok(code);

  await assert.rejects(
    asMember(otherDonor, () => db.query('select public.verify_food_pickup($1)', [code])),
    'a different donor cannot verify the pass',
  );
  await assert.rejects(
    asMember(claimant, () => db.query('select public.verify_food_pickup($1)', [code])),
    'the claimant cannot verify their own pass',
  );
  await assert.rejects(
    asMember(claimant, () =>
      db.query('select public.complete_food_claim($1, $2)', [created.claim_id, code]),
    ),
    'the compatibility completion RPC must not let a claimant self-confirm pickup',
  );

  await asMember(donor, () => db.query('select public.verify_food_pickup($1)', [code]));
  await assert.rejects(
    asMember(donor, () =>
      db.query('select public.complete_food_claim($1, $2)', [created.claim_id, code]),
    ),
    'the same pass cannot be replayed through the compatibility RPC',
  );
  const completed = await claimState(created.claim_id);
  assert.equal(completed.claim_status, 'picked_up');
  assert.ok(completed.invalidated_at);
  const pickupNotices = await db.query(
    `select message from public.notifications
     where user_id = $1 and related_post_id = $2 and message like '%confirmed pickup%'`,
    [claimant, postId],
  );
  assert.equal(pickupNotices.rows.length, 1, 'confirmed pickup is persisted once for the claimant');
});

test('a pending cancellation keeps stock reserved; denial preserves the pass and approval reopens once', async () => {
  const donor = await createMember({ role: 'provider' });
  const claimant = await createMember();
  const postId = await createPost(donor);
  const created = await startClaim(postId, claimant);
  await decideClaim(donor, created.claim_id, true);
  const accepted = await claimState(created.claim_id);
  const originalCode = accepted.pickup_code;

  await requestCancellation(claimant, created.claim_id);
  const requestId = await pendingCancellationId(created.claim_id);
  const unrelatedDonor = await createMember({ role: 'provider' });
  const unrelatedClaimant = await createMember();
  await assert.rejects(
    requestCancellation(unrelatedClaimant, created.claim_id),
    'a different claimant cannot request cancellation for this claim',
  );
  await assert.rejects(
    decideCancellation(unrelatedDonor, requestId, false, 'Unauthorized decision'),
    'a different donor cannot decide this cancellation request',
  );
  const duringRequest = await claimState(created.claim_id);
  assert.equal(duringRequest.claim_status, 'accepted');
  assert.equal(duringRequest.quantity_remaining, 0, 'a cancellation request holds the reservation');
  assert.equal(duringRequest.pickup_code, originalCode);
  await assert.rejects(
    asMember(donor, () => db.query('select public.verify_food_pickup($1)', [originalCode])),
    'pickup must pause while cancellation is pending',
  );

  await decideCancellation(donor, requestId, false, 'The pickup remains confirmed');
  const denied = await claimState(created.claim_id);
  assert.equal(denied.claim_status, 'accepted');
  assert.equal(denied.quantity_remaining, 0);
  assert.equal(denied.pickup_code, originalCode, 'denial preserves the accepted pass');
  assert.equal(denied.invalidated_at, null);

  const approvedPost = await createPost(donor);
  const approvedClaim = await startClaim(approvedPost, claimant);
  await decideClaim(donor, approvedClaim.claim_id, true);
  const approvalCode = (await claimState(approvedClaim.claim_id)).pickup_code;
  await requestCancellation(claimant, approvedClaim.claim_id);
  const approvalRequestId = await pendingCancellationId(approvedClaim.claim_id);
  await decideCancellation(donor, approvalRequestId, true, 'The claimant cancelled this pickup');
  const approved = await claimState(approvedClaim.claim_id);
  assert.equal(approved.claim_status, 'cancelled');
  assert.equal(approved.quantity_remaining, 1);
  assert.equal(approved.post_status, 'active', 'approved cancellation reopens the listing');
  assert.ok(approved.invalidated_at, 'approved cancellation invalidates the old pass');

  await assert.rejects(
    asMember(donor, () => db.query('select public.verify_food_pickup($1)', [approvalCode])),
    'a cancelled claim’s pass must be unusable',
  );
  await decideCancellation(donor, approvalRequestId, true, 'Repeated approval').catch(() => {});
  const afterReplay = await claimState(approvedClaim.claim_id);
  assert.equal(afterReplay.quantity_remaining, 1);
  assert.equal(afterReplay.post_status, 'active');
});

test('expired accepted passes and admin-removed listings cannot be picked up', async () => {
  const donor = await createMember({ role: 'provider' });
  const claimant = await createMember();
  const admin = await createMember({ role: 'admin' });

  const expiredPost = await createPost(donor, { expiresInSeconds: remoteMode ? 15 : 2 });
  const expiredClaim = await startClaim(expiredPost, claimant);
  await decideClaim(donor, expiredClaim.claim_id, true);
  const expiredCode = (await claimState(expiredClaim.claim_id)).pickup_code;
  await waitForPostDeadline(expiredPost);
  await assert.rejects(
    asMember(donor, () => db.query('select public.verify_food_pickup($1)', [expiredCode])),
    'a pass cannot be verified after its listing deadline',
  );

  const removedPost = await createPost(donor);
  const removedClaim = await startClaim(removedPost, claimant);
  await decideClaim(donor, removedClaim.claim_id, true);
  const removedCode = (await claimState(removedClaim.claim_id)).pickup_code;
  await asMember(admin, () =>
    db.query('select public.admin_remove_food_post($1, $2)', [
      removedPost,
      'Listing removed during moderation review',
    ]),
  );
  const removed = await claimState(removedClaim.claim_id);
  assert.equal(removed.post_status, 'removed_by_admin');
  assert.ok(removed.invalidated_at, 'admin removal invalidates outstanding pickup passes');
  await assert.rejects(
    asMember(donor, () => db.query('select public.verify_food_pickup($1)', [removedCode])),
    'a pass for an admin-removed listing must be unusable',
  );
});

test('donor cancellation closes active claims once and preserves completed pickups', async () => {
  const donor = await createMember({ role: 'provider' });
  const otherDonor = await createMember({ role: 'provider' });
  const completedClaimant = await createMember();
  const acceptedClaimant = await createMember();
  const pendingClaimant = await createMember();
  const postId = await createPost(donor, { quantity: 3 });

  const completed = await startClaim(postId, completedClaimant);
  await decideClaim(donor, completed.claim_id, true);
  const completedCode = (await claimState(completed.claim_id)).pickup_code;
  await asMember(donor, () => db.query('select public.verify_food_pickup($1)', [completedCode]));

  const accepted = await startClaim(postId, acceptedClaimant);
  await decideClaim(donor, accepted.claim_id, true);
  const acceptedCode = (await claimState(accepted.claim_id)).pickup_code;
  await requestCancellation(acceptedClaimant, accepted.claim_id);
  const acceptedRequestId = await pendingCancellationId(accepted.claim_id);

  const pending = await startClaim(postId, pendingClaimant);
  await requestCancellation(pendingClaimant, pending.claim_id);
  const pendingRequestId = await pendingCancellationId(pending.claim_id);

  const reason = 'The kitchen needs to keep this food for a campus event.';
  await assert.rejects(cancelPost(otherDonor, postId, reason), /Only the listing donor/);
  await assert.rejects(cancelPost(donor, postId, 'too short'), /10 to 2,000/);
  await cancelPost(donor, postId, reason);

  const post = await db.query(
    'select status, quantity_remaining, cancellation_reason from public.food_posts where id = $1',
    [postId],
  );
  assert.deepEqual(post.rows[0], {
    status: 'removed_by_donor',
    quantity_remaining: 0,
    cancellation_reason: reason,
  });
  assert.equal((await claimState(completed.claim_id)).claim_status, 'picked_up');
  const acceptedState = await claimState(accepted.claim_id);
  assert.equal(acceptedState.claim_status, 'cancelled');
  assert.ok(acceptedState.invalidated_at);
  assert.equal(acceptedState.invalidation_reason, 'claim_cancelled');
  const pendingState = await claimState(pending.claim_id);
  assert.equal(pendingState.claim_status, 'rejected');
  assert.equal(pendingState.quantity_remaining, 0, 'closed posts never release reservations');

  const requests = await db.query(
    `select id, status from public.claim_cancellation_requests
     where id = any($1::uuid[]) order by id`,
    [[acceptedRequestId, pendingRequestId]],
  );
  assert.equal(requests.rows.length, 2);
  assert.ok(requests.rows.every((request) => request.status === 'obsolete'));

  const noticesBeforeRetry = await db.query(
    `select user_id, message from public.notifications
     where related_post_id = $1 and message like '%' || $2 || '%' order by user_id`,
    [postId, reason],
  );
  assert.deepEqual(
    noticesBeforeRetry.rows.map((notice) => notice.user_id).sort(),
    [acceptedClaimant, pendingClaimant].sort(),
  );
  assert.ok(noticesBeforeRetry.rows.every((notice) => notice.message.includes(reason)));
  await assert.rejects(
    asMember(donor, () =>
      db.query('update public.food_posts set cancellation_reason = $2 where id = $1', [postId, 'tampered']),
    ),
    /Cancellation reasons are managed/,
  );
  await cancelPost(donor, postId, 'A later retry with a different explanation');
  const noticesAfterRetry = await db.query(
    `select count(*)::integer as count from public.notifications
     where related_post_id = $1 and message like '%' || $2 || '%'`,
    [postId, reason],
  );
  assert.equal(noticesAfterRetry.rows[0].count, 2, 'cancellation retries must not repeat notifications');
  await assert.rejects(
    asMember(donor, () => db.query('select public.verify_food_pickup($1)', [acceptedCode])),
    'donor cancellation invalidates the accepted claim pass',
  );
});

test('scheduled expiry closes active and fully reserved posts idempotently', async () => {
  const donor = await createMember({ role: 'provider' });
  const pickedUpMember = await createMember();
  const pendingMember = await createMember();
  const acceptedMember = await createMember();
  const fullyReservedMember = await createMember();
  const expiresInSeconds = remoteMode ? 30 : 2;
  const activePost = await createPost(donor, { quantity: 5, expiresInSeconds });
  const fullyReservedPost = await createPost(donor, { quantity: 1, expiresInSeconds });

  const pickedUp = await startClaim(activePost, pickedUpMember);
  await decideClaim(donor, pickedUp.claim_id, true);
  const pickedUpCode = (await claimState(pickedUp.claim_id)).pickup_code;
  await asMember(donor, () => db.query('select public.verify_food_pickup($1)', [pickedUpCode]));

  const pending = await startClaim(activePost, pendingMember);
  const accepted = await startClaim(activePost, acceptedMember);
  await decideClaim(donor, accepted.claim_id, true);
  const acceptedCode = (await claimState(accepted.claim_id)).pickup_code;
  await requestCancellation(acceptedMember, accepted.claim_id);
  const requestId = await pendingCancellationId(accepted.claim_id);

  const fullyReserved = await startClaim(fullyReservedPost, fullyReservedMember);
  await decideClaim(donor, fullyReserved.claim_id, true);
  const fullyReservedCode = (await claimState(fullyReserved.claim_id)).pickup_code;

  await assert.rejects(
    asMember(donor, () => db.query('select public.expire_food_posts()')),
    /permission/i,
    'members cannot invoke the scheduled cleanup RPC',
  );
  await waitForPostDeadline(activePost);
  await assert.rejects(
    cancelPost(donor, activePost, 'The deadline passed before manual cancellation.'),
    /pickup deadline has passed/,
    'server time prevents cancellation from masking expiration before the job runs',
  );
  const expired = await db.query('select public.expire_food_posts() as count');
  assert.ok(expired.rows[0].count >= 2, 'both active and fully reserved posts are expired');

  const postStates = await db.query(
    `select id, status, quantity_remaining from public.food_posts
     where id = any($1::uuid[]) order by id`,
    [[activePost, fullyReservedPost]],
  );
  assert.equal(postStates.rows.length, 2);
  assert.ok(postStates.rows.every((post) => post.status === 'expired'));
  assert.equal(postStates.rows.find((post) => post.id === activePost).quantity_remaining, 2);
  assert.equal(postStates.rows.find((post) => post.id === fullyReservedPost).quantity_remaining, 0);
  assert.equal((await claimState(pickedUp.claim_id)).claim_status, 'picked_up');
  assert.equal((await claimState(pending.claim_id)).claim_status, 'rejected');
  const acceptedState = await claimState(accepted.claim_id);
  assert.equal(acceptedState.claim_status, 'expired');
  assert.equal(acceptedState.invalidation_reason, 'pickup_expired');
  assert.equal((await claimState(fullyReserved.claim_id)).claim_status, 'expired');

  const request = await db.query(
    'select status from public.claim_cancellation_requests where id = $1',
    [requestId],
  );
  assert.equal(request.rows[0].status, 'obsolete');
  const expiryNotices = await db.query(
    `select user_id, message from public.notifications
     where related_post_id = any($1::uuid[]) and message like '%pickup deadline passed%'`,
    [[activePost, fullyReservedPost]],
  );
  assert.deepEqual(
    [...new Set(expiryNotices.rows.map((notice) => notice.user_id))].sort(),
    [donor, pendingMember, acceptedMember, fullyReservedMember].sort(),
    'expiry informs the donor and affected claimants while preserving completed history',
  );
  assert.equal(expiryNotices.rows.length, 5);
  const noticeCountBeforeRetry = await db.query(
    `select count(*)::integer as count from public.notifications
     where related_post_id = any($1::uuid[])`,
    [[activePost, fullyReservedPost]],
  );
  assert.ok(noticeCountBeforeRetry.rows[0].count > 0);

  await assert.rejects(
    asMember(donor, () => db.query('select public.verify_food_pickup($1)', [acceptedCode])),
    'expiry invalidates accepted pickup passes',
  );
  await assert.rejects(
    asMember(donor, () => db.query('select public.verify_food_pickup($1)', [fullyReservedCode])),
    'fully reserved post expiry invalidates pickup passes',
  );
  await assert.rejects(startClaim(activePost, await createMember()));
  await assert.rejects(
    asMember(donor, () => db.query('select public.decide_claim_cancellation($1, true, null)', [requestId])),
    'expired claims cannot release inventory after cleanup',
  );

  const retry = await db.query('select public.expire_food_posts() as count');
  assert.equal(retry.rows[0].count, 0, 'a second cleanup makes no repeated transitions');
  const noticeCountAfterRetry = await db.query(
    `select count(*)::integer as count from public.notifications
     where related_post_id = any($1::uuid[])`,
    [[activePost, fullyReservedPost]],
  );
  assert.equal(noticeCountAfterRetry.rows[0].count, noticeCountBeforeRetry.rows[0].count);
});
