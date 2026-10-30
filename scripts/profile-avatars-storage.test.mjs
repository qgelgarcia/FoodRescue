import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = path.join(root, 'supabase', 'migrations', '20261030020000_profile_avatars.sql');
const alice = '2f424182-1c77-4dd3-920e-bc90fa8955ad';
const bob = 'b3077e80-f66e-4ef4-b2aa-b03408e7e413';
const ownPhoto = '52d81f3c-3136-42e0-8a96-987a9f359edb.webp';
let db;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create schema storage;
    grant usage on schema auth, storage to anon, authenticated;
    create function auth.uid()
    returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
    create function storage.foldername(name text)
    returns text[] language sql immutable
    as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
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
      owner uuid
    );
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
  await db.exec(await readFile(migrationPath, 'utf8'));
});

after(async () => db?.close());

async function asRole(role, userId, callback) {
  await db.exec(`set role ${role}`);
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId || '']);
    return await callback();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

const asMember = (id, callback) => asRole('authenticated', id, callback);

test('avatar bucket is private and enforces the agreed size and image types', async () => {
  const { rows } = await db.query(
    `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'profile-avatars'`,
  );
  assert.deepEqual(rows[0], {
    public: false,
    file_size_limit: 5242880,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
  });
});

test('Storage policies limit listing, upload and delete to the authenticated path owner', async () => {
  await asMember(alice, () => db.query(
    'insert into storage.objects (bucket_id, name) values ($1, $2)',
    ['profile-avatars', `${alice}/${ownPhoto}`],
  ));
  await assert.rejects(asMember(alice, () => db.query(
    'insert into storage.objects (bucket_id, name) values ($1, $2)',
    ['profile-avatars', `${bob}/${ownPhoto}`],
  )), /row-level security/i, 'a member cannot upload under another owner path');

  const aliceRows = await asMember(alice, () => db.query(
    `select name from storage.objects where bucket_id = 'profile-avatars'`,
  ));
  assert.deepEqual(aliceRows.rows.map((row) => row.name), [`${alice}/${ownPhoto}`]);

  const bobRows = await asMember(bob, () => db.query(
    `select name from storage.objects where bucket_id = 'profile-avatars'`,
  ));
  assert.deepEqual(bobRows.rows, [], 'another member cannot read the private file row');

  const changed = await asMember(bob, () => db.query(
    `update storage.objects set name = $1 where bucket_id = 'profile-avatars' returning name`,
    [`${bob}/${ownPhoto}`],
  ));
  assert.equal(changed.rows.length, 0, 'there is no cross-owner or same-owner overwrite policy');

  const deletedByBob = await asMember(bob, () => db.query(
    `delete from storage.objects where bucket_id = 'profile-avatars' returning name`,
  ));
  assert.equal(deletedByBob.rows.length, 0, 'another member cannot delete the private file');

  const deletedByAlice = await asMember(alice, () => db.query(
    `delete from storage.objects where bucket_id = 'profile-avatars' returning name`,
  ));
  assert.deepEqual(deletedByAlice.rows.map((row) => row.name), [`${alice}/${ownPhoto}`]);
});

test('anonymous clients cannot read or write profile avatars', async () => {
  const visible = await asRole('anon', null, () => db.query("select * from storage.objects where bucket_id = 'profile-avatars'"));
  assert.deepEqual(visible.rows, []);
  await assert.rejects(asRole('anon', null, () => db.query(
    'insert into storage.objects (bucket_id, name) values ($1, $2)',
    ['profile-avatars', `${alice}/${ownPhoto}`],
  )), /row-level security/i);
});
