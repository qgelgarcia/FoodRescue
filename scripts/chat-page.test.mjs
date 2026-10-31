import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';

const outputRoot = path.resolve('output');
await mkdir(outputRoot, { recursive: true });
const directory = await mkdtemp(path.join(outputRoot, 'chat-page-test-'));
const output = path.join(directory, 'page.mjs');
await build({ entryPoints: ['apps/frontend/src/modules/chat/ChatPage.jsx'], outfile: output,
  bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, logLevel: 'silent',
  plugins: [{ name: 'chat-fixtures', setup(builder) {
    builder.onResolve({ filter: /^react$/, namespace: 'fixture' }, () => ({ path: 'react', external: true }));
    builder.onResolve({ filter: /services\/chat\.js$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    builder.onResolve({ filter: /layout\/PageShell$/ }, () => ({ path: 'shell', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ contents: name === 'shell'
      ? 'import React from "react"; export default function Shell({children}) { return React.createElement("div",null,children); }'
      : ['getChatConversations', 'getChatConversation', 'createChatConversation', 'deleteChatConversation', 'sendChatMessage']
        .map(name => `export const ${name}=(...args)=>globalThis.chatFixture.${name}(...args);`).join('\n'), loader: 'js' }));
  } }],
});
const { default: ChatPage } = await import(pathToFileURL(output));
after(async () => {
  delete globalThis.chatFixture;
  if (path.dirname(directory) !== outputRoot) throw new Error('Unexpected cleanup path');
  await rm(directory, { recursive: true, force: true });
});

const conversation = { id: '2f424182-1c77-4dd3-920e-bc90fa8955ad', title: 'Pickup help', updated_at: '2026-10-30T00:00:00Z' };
const account = { id: 'alice' };
function fixture(overrides = {}) {
  return { getChatConversations: async () => [], getChatConversation: async () => ({ conversation, messages: [] }),
    createChatConversation: async () => conversation, deleteChatConversation: async () => {}, sendChatMessage: async () => ({ conversation, messages: [] }), ...overrides };
}
async function mount() {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(ChatPage, { userProfile: account }), {
    createNodeMock: () => ({ style: {}, scrollHeight: 40, scrollTop: 0, focus() {}, isConnected: true }),
  }); });
  return renderer;
}

test('failed messages preserve draft and reuse the same request ID on retry', async () => {
  const sends = [];
  globalThis.chatFixture = fixture({ sendChatMessage: async (...args) => {
    sends.push(args);
    if (sends.length === 1) throw new Error('Connection lost');
    return { conversation, messages: [
      { id: 'u1', role: 'user', content: args[1] }, { id: 'a1', role: 'assistant', content: 'Open Claim history.' },
    ] };
  } });
  const renderer = await mount();
  try {
    act(() => renderer.root.findByType('textarea').props.onChange({ target: { value: 'How do I pick up food?' } }));
    await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    assert.equal(renderer.root.findByType('textarea').props.value, 'How do I pick up food?');
    const retry = renderer.root.findAllByType('button').find(node => node.children.includes('Retry message'));
    assert.ok(retry);
    await act(async () => retry.props.onClick());
    assert.equal(sends.length, 2);
    assert.equal(sends[0][2], sends[1][2]);
    assert.equal(renderer.root.findByType('textarea').props.value, '');
    assert.match(JSON.stringify(renderer.toJSON()), /Open Claim history/);
  } finally { act(() => renderer.unmount()); }
});

test('changing accounts clears the previous account conversation from the view', async () => {
  let listCall = 0;
  globalThis.chatFixture = fixture({ getChatConversations: async () => ++listCall === 1 ? [conversation] : [] });
  const renderer = await mount();
  try {
    assert.match(JSON.stringify(renderer.toJSON()), /Pickup help/);
    await act(async () => renderer.update(React.createElement(ChatPage, { userProfile: { id: 'bob' } })));
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Pickup help/);
  } finally { act(() => renderer.unmount()); }
});
