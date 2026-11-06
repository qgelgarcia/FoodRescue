import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

test('chat uses the Android HTTP bridge on native and fetch on the web', async (t) => {
  const calls = [];
  const fixture = { native: true, bridge: async (request) => {
    calls.push(request);
    return request.method === 'DELETE'
      ? { status: 204, data: '' }
      : { status: 200, data: { conversation: { id: 'chat-1' }, messages: [] } };
  } };
  const browserFetch = t.mock.method(globalThis, 'fetch', () => {
    if (fixture.native) throw new Error('WebView preflight denied');
    return Response.json({ conversation: { id: 'chat-1' }, messages: [] });
  });
  globalThis.foodRescueChatHttpFixture = fixture;
  t.after(() => { delete globalThis.foodRescueChatHttpFixture; });

  const stubs = {
    '@capacitor/core': `
      const fixture = globalThis.foodRescueChatHttpFixture;
      export const Capacitor = { isNativePlatform: () => fixture.native };
      export const CapacitorHttp = { request: fixture.bridge };`,
    './supabase.js': `
      export const isSupabaseConfigured = () => true;
      export const supabase = { auth: { getSession: async () =>
        ({ data: { session: { access_token: 'test-token' } } }) } };`,
  };
  const result = await build({
    entryPoints: ['apps/frontend/src/services/chat.js'],
    bundle: true,
    format: 'esm',
    write: false,
    define: { 'import.meta.env.VITE_API_BASE_URL': '"https://api.example.test"' },
    plugins: [{
      name: 'native-chat-fixture',
      setup(builder) {
        builder.onResolve({ filter: /^(?:@capacitor\/core|\.\/supabase\.js)$/ },
          ({ path }) => ({ path, namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: stubs[path] }));
      },
    }],
  });
  const chat = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  await chat.sendChatMessage('chat-1', 'Where are my claims?', 'request-1');
  await chat.deleteChatConversation('chat-1');

  assert.equal(browserFetch.mock.callCount(), 0);
  assert.equal(calls[0].url, 'https://api.example.test/api/chat/conversations/chat-1/messages');
  assert.equal(calls[0].headers.Authorization, 'Bearer test-token');
  assert.equal(calls[0].headers['Content-Type'], 'application/json');
  assert.equal(calls[0].headers['Cache-Control'], 'no-store');
  assert.deepEqual(calls[0].data, { message: 'Where are my claims?', requestId: 'request-1' });
  assert.equal(calls[0].disableRedirects, true);
  assert.equal(calls[1].method, 'DELETE');

  fixture.native = false;
  await chat.sendChatMessage('chat-1', 'Where are my claims?', 'request-2');
  assert.equal(calls.length, 2);
  const [url, options] = browserFetch.mock.calls[0].arguments;
  assert.equal(url, calls[0].url);
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(options.body), { message: 'Where are my claims?', requestId: 'request-2' });
});
