import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { after, before, test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = path.join(root, 'supabase', 'migrations', '20261030040000_chat_conversations.sql');
const outputRoot = path.join(root, 'output');
const alice = '2f424182-1c77-4dd3-920e-bc90fa8955ad';
const bob = 'b3077e80-f66e-4ef4-b2aa-b03408e7e413';
const charlie = '5114f36d-359a-477b-9248-72373eb8d572';
await mkdir(outputRoot, { recursive: true });
const tempDirectory = await mkdtemp(path.join(outputRoot, 'chat-storage-test-'));
const routeBundle = path.join(tempDirectory, 'chat-routes.mjs');
await build({ entryPoints: [path.join(root, 'apps/backend/src/routes/chat.routes.ts')], outfile: routeBundle,
  bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent' });
const { createChatRouter } = await import(pathToFileURL(routeBundle));
let db;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    grant usage on schema auth, public to anon, authenticated, service_role;
    create function auth.uid()
    returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
    create table public.profiles (id uuid primary key, status text not null);
    insert into public.profiles values ('${alice}', 'active'), ('${bob}', 'active'), ('${charlie}', 'active');
  `);
  await db.exec(await readFile(migrationPath, 'utf8'));
});

after(async () => {
  await db?.close();
  if (path.dirname(tempDirectory) !== outputRoot || !path.basename(tempDirectory).startsWith('chat-storage-test-')) {
    throw new Error('Unexpected chat test cleanup path');
  }
  await rm(tempDirectory, { recursive: true, force: true });
});

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
const asService = (callback) => asRole('service_role', null, callback);

async function seedConversation(id, owner) {
  await asService(() => db.query(
    'insert into public.chat_conversations (id, user_id) values ($1, $2)', [id, owner],
  ));
}

async function saveExchange(conversationId, requestId, message, response, expectedCount) {
  return asService(() => db.query(
    'select public.save_chat_exchange($1, $2, $3, $4, $5, $6) as exchange',
    [alice, conversationId, requestId, message, response, expectedCount],
  ));
}

async function createConversation(owner) {
  return asService(() => db.query('select public.create_chat_conversation($1) as conversation', [owner]));
}

test('only the owner can read or delete a conversation; clients cannot spoof messages', async () => {
  const aliceConversation = '00000000-0000-4000-8000-000000000001';
  const bobConversation = '00000000-0000-4000-8000-000000000002';
  await seedConversation(aliceConversation, alice);
  await seedConversation(bobConversation, bob);
  await saveExchange(aliceConversation, '10000000-0000-4000-8000-000000000001', 'Hi', 'Hello', 0);

  const own = await asMember(alice, () => db.query('select id from public.chat_conversations'));
  assert.deepEqual(own.rows.map((row) => row.id), [aliceConversation]);
  const hidden = await asMember(alice, () => db.query(
    'select id from public.chat_messages where conversation_id = $1', [bobConversation],
  ));
  assert.deepEqual(hidden.rows, []);
  const crossDelete = await asMember(alice, () => db.query(
    'delete from public.chat_conversations where id = $1 returning id', [bobConversation],
  ));
  assert.deepEqual(crossDelete.rows, []);

  await assert.rejects(asMember(alice, () => db.query(
    'insert into public.chat_conversations (user_id) values ($1)', [bob],
  )), /permission denied|row-level security/i);
  await assert.rejects(asMember(alice, () => db.query(
    "insert into public.chat_messages (conversation_id, request_id, role, content) values ($1, $2, 'assistant', 'spoof')",
    [aliceConversation, '10000000-0000-4000-8000-000000000002'],
  )), /permission denied|row-level security/i);

  const deleted = await asMember(alice, () => db.query(
    'delete from public.chat_conversations where id = $1 returning id', [aliceConversation],
  ));
  assert.deepEqual(deleted.rows.map((row) => row.id), [aliceConversation]);
  const privileges = await db.query(`
    select has_function_privilege('authenticated',
      'public.save_chat_exchange(uuid,uuid,uuid,text,text,integer)', 'EXECUTE') as client_can_save,
      has_function_privilege('service_role',
      'public.save_chat_exchange(uuid,uuid,uuid,text,text,integer)', 'EXECUTE') as server_can_save,
      has_function_privilege('authenticated', 'public.create_chat_conversation(uuid)', 'EXECUTE') as client_can_create
  `);
  assert.equal(privileges.rows[0].client_can_save, false);
  assert.equal(privileges.rows[0].server_can_save, true);
  assert.equal(privileges.rows[0].client_can_create, false);
});

test('exchange save is atomic and requestId retries return the original pair', async () => {
  const conversationId = '00000000-0000-4000-8000-000000000003';
  const requestId = '10000000-0000-4000-8000-000000000003';
  await seedConversation(conversationId, alice);
  const first = await saveExchange(conversationId, requestId, 'What is lentil nutrition?', 'About 230 calories.', 0);
  const retry = await saveExchange(conversationId, requestId, 'What is lentil nutrition?', 'A different answer', 0);
  assert.deepEqual(retry.rows[0].exchange.messages.map((message) => message.content), [
    'What is lentil nutrition?', 'About 230 calories.',
  ]);
  assert.deepEqual(retry.rows[0].exchange.messages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(first.rows[0].exchange.conversation.message_count, 2);
  await assert.rejects(saveExchange(conversationId, requestId, 'A different request', 'Reply', 0), /CHAT_REQUEST_ID_REUSED/);
  const stored = await asService(() => db.query(
    'select role, sequence_no from public.chat_messages where conversation_id = $1 order by sequence_no', [conversationId],
  ));
  assert.deepEqual(stored.rows.map((row) => [row.role, row.sequence_no]), [['user', 1], ['assistant', 2]]);
});

test('stale writes conflict and stored message lengths are bounded', async () => {
  const conversationId = '00000000-0000-4000-8000-000000000004';
  await seedConversation(conversationId, alice);
  await saveExchange(conversationId, '10000000-0000-4000-8000-000000000004', 'First', 'Reply', 0);
  await assert.rejects(saveExchange(
    conversationId, '10000000-0000-4000-8000-000000000005', 'Stale', 'Reply', 0,
  ), /CHAT_STALE/);
  await assert.rejects(saveExchange(
    conversationId, '10000000-0000-4000-8000-000000000006', 'x'.repeat(2001), 'Reply', 2,
  ), /CHAT_INVALID_INPUT/);
  await assert.rejects(asService(() => db.query(
    "insert into public.chat_messages (conversation_id, request_id, role, sequence_no, content) values ($1, $2, 'user', 3, $3)",
    [conversationId, '10000000-0000-4000-8000-000000000007', 'x'.repeat(2001)],
  )), /chat_messages_check|check constraint/i);
});

test('conversation creation is service-only and caps each owner at 100', async () => {
  const created = await createConversation(charlie);
  assert.equal(created.rows[0].conversation.title, 'New conversation');
  await asService(() => db.query(`
    insert into public.chat_conversations (user_id)
    select $1 from generate_series(1, 99)
  `, [charlie]));
  await assert.rejects(createConversation(charlie), /CHAT_CONVERSATION_LIMIT/);
  const count = await asService(() => db.query(
    'select count(*)::integer as count from public.chat_conversations where user_id = $1', [charlie],
  ));
  assert.equal(count.rows[0].count, 100);
});

function fakeStorage() {
  const conversation = {
    id: '00000000-0000-4000-8000-000000000020', title: 'New conversation', message_count: 0,
    created_at: '2026-10-30T00:00:00Z', updated_at: '2026-10-30T00:00:00Z',
  };
  const calls = { getUser: 0, getConversation: 0, createConversation: 0, findExchange: 0, saved: 0 };
  return {
    calls,
    storage: {
      getUser: async (token) => { calls.getUser += 1; return token === 'valid' ? alice : token === 'suspended' ? bob : null; },
      isActive: async (id) => id === alice,
      listConversations: async () => [conversation],
      createConversation: async () => { calls.createConversation += 1; return conversation; },
      getConversation: async (_owner, id) => { calls.getConversation += 1; return id === conversation.id ? conversation : null; },
      listMessages: async () => [],
      findExchange: async () => { calls.findExchange += 1; return []; },
      getHistory: async () => [],
      saveExchange: async (_owner, id, requestId, message, response) => {
        calls.saved += 1;
        return { conversation, messages: [
          { id: 'user-message', role: 'user', content: message, request_id: requestId },
          { id: 'assistant-message', role: 'assistant', content: response, request_id: requestId },
        ] };
      },
      deleteConversation: async () => true,
    },
    conversation,
  };
}

async function withChatRouter(dependencies, run) {
  const router = createChatRouter(dependencies);
  await run((method, path, token, body) => new Promise((resolve, reject) => {
    const request = Object.assign(new EventEmitter(), {
      method, url: path, originalUrl: path, baseUrl: '',
      headers: token ? { authorization: `Bearer ${token}` } : {}, body,
      get(name) { return this.headers[name.toLowerCase()]; },
    });
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200, writableEnded: false, destroyed: false,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; this.writableEnded = true; queueMicrotask(() => this.emit('finish')); return this; },
      end() { this.writableEnded = true; queueMicrotask(() => this.emit('finish')); return this; },
    });
    response.once('finish', () => resolve({ status: response.statusCode, body: response.body }));
    router.handle(request, response, (error) => error ? reject(error) : resolve({ status: 404 }));
  }));
}

const postMessage = (request, token, body) => request(
  'POST', '/conversations/00000000-0000-4000-8000-000000000020/messages', token, body,
);

test('routes authenticate every request and reject spoofed fields before chat work', async () => {
  const fake = fakeStorage();
  let answers = 0;
  await withChatRouter({ storage: fake.storage, answer: async () => { answers += 1; return 'Answer'; } }, async (request) => {
    const noToken = await request('GET', '/conversations');
    assert.equal(noToken.status, 401);
    const invalid = await request('GET', '/conversations', 'invalid');
    assert.equal(invalid.status, 401);
    const suspended = await request('GET', '/conversations', 'suspended');
    assert.equal(suspended.status, 403);
    const callerOwner = await request('POST', '/conversations', 'valid', { user_id: bob });
    assert.equal(callerOwner.status, 400);
    assert.equal(fake.calls.createConversation, 0, 'conversation owner is always derived from verified auth');
    const spoofed = await postMessage(request, 'valid', {
      message: 'Hello', requestId: '10000000-0000-4000-8000-000000000020', role: 'assistant',
    });
    assert.equal(spoofed.status, 400);
    const credential = await postMessage(request, 'valid', {
      message: 'My key is sk-abcdefghijklmnopqrstuvwxyz1234', requestId: '10000000-0000-4000-8000-000000000021',
    });
    assert.equal(credential.status, 400);
    assert.equal(answers, 0);
    assert.equal(fake.calls.getConversation, 0, 'credential-bearing input is rejected before reading conversation storage');
    assert.equal(fake.calls.findExchange, 0);
    assert.equal(fake.calls.getUser, 5, 'all requests with a bearer token verify it with the auth dependency');
  });
});

test('message routes enforce the per-user rate limit and same-user busy guard', async () => {
  const fake = fakeStorage();
  let answers = 0;
  await withChatRouter({ storage: fake.storage, now: () => 100_000, answer: async () => { answers += 1; return 'Answer'; } }, async (request) => {
    for (let i = 1; i <= 10; i += 1) {
      const requestId = `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const response = await postMessage(request, 'valid', { message: `Hello ${i}`, requestId });
      assert.equal(response.status, 200);
    }
    const limited = await postMessage(request, 'valid', {
      message: 'Hello again', requestId: '10000000-0000-4000-8000-000000000099',
    });
    assert.equal(limited.status, 429);
    assert.equal(answers, 10);
  });

  const createFake = fakeStorage();
  await withChatRouter({ storage: createFake.storage, now: () => 100_000 }, async (request) => {
    for (let i = 0; i < 10; i += 1) assert.equal((await request('POST', '/conversations', 'valid')).status, 201);
    assert.equal((await request('POST', '/conversations', 'valid')).status, 429);
    assert.equal(createFake.calls.createConversation, 10);
  });

  const dailyFake = fakeStorage();
  let timestamp = 100_000;
  await withChatRouter({ storage: dailyFake.storage, now: () => timestamp, answer: async () => 'Answer' }, async (request) => {
    for (let i = 1; i <= 100; i += 1) {
      const requestId = `30000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      assert.equal((await postMessage(request, 'valid', { message: `Daily ${i}`, requestId })).status, 200);
      timestamp += 60_001;
    }
    const exhausted = await postMessage(request, 'valid', {
      message: 'Over daily limit', requestId: '30000000-0000-4000-8000-000000000101',
    });
    assert.equal(exhausted.status, 429);
  });

  const busyFake = fakeStorage();
  let markStarted;
  let releaseAnswer;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const waiting = new Promise((resolve) => { releaseAnswer = resolve; });
  await withChatRouter({ storage: busyFake.storage, answer: async () => { markStarted(); await waiting; return 'Answer'; } }, async (request) => {
    const first = postMessage(request, 'valid', { message: 'First', requestId: '20000000-0000-4000-8000-000000000001' });
    await started;
    const second = await postMessage(request, 'valid', { message: 'Second', requestId: '20000000-0000-4000-8000-000000000002' });
    assert.equal(second.status, 409);
    releaseAnswer();
    assert.equal((await first).status, 200);
  });
});
