import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';

test('loader advances, retries once while pending, and cleans timers on unmount', async () => {
  const outputRoot = path.resolve('output');
  await mkdir(outputRoot, { recursive: true });
  const directory = await mkdtemp(path.join(outputRoot, 'loading-state-test-'));
  let renderer;
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  const timers = new Map();
  let timerId = 0;
  try {
    const output = path.join(directory, 'loader.mjs');
    await build({ entryPoints: ['apps/frontend/src/components/feedback/LoadingState.jsx'], outfile: output,
      bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent',
      plugins: [{ name: 'styles', setup(builder) {
        builder.onResolve({ filter: /\.css$/ }, () => ({ path: 'css', namespace: 'empty' }));
        builder.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
      } }],
    });
    const { default: LoadingState } = await import(pathToFileURL(output));
    globalThis.setTimeout = (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; };
    globalThis.clearTimeout = id => timers.delete(id);
    let calls = 0;
    let finish;
    const retry = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
    const stage = () => renderer.root.findByProps({ className: 'system-loading' }).props['data-stage'];
    act(() => { renderer = TestRenderer.create(React.createElement(LoadingState, { onRetry: retry })); });
    assert.equal(stage(), 'normal');
    for (const [delay, expected] of [[3000, 'slow'], [10000, 'reassurance'], [30000, 'recovery']]) {
      act(() => [...timers.values()].find(timer => timer.delay === delay).fn());
      assert.equal(stage(), expected);
    }
    assert.equal(renderer.root.findByType('button').children.at(-1), 'Refresh');
    let pending;
    act(() => { pending = renderer.root.findByType('button').props.onClick(); });
    assert.equal(calls, 1);
    // The retry starts a fresh loading cycle; it does not fire on its own.
    assert.equal(stage(), 'normal');
    await act(async () => { finish(); await pending; });
    act(() => renderer.update(React.createElement(LoadingState, { error: 'Connection unavailable', onRetry: retry })));
    assert.equal(stage(), 'failed');
    assert.equal(renderer.root.findByProps({ role: 'alert' }).props['aria-live'], 'polite');
    act(() => renderer.unmount()); renderer = null;
    assert.equal(timers.size, 0);
  } finally {
    if (renderer) act(() => renderer.unmount());
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
    if (path.dirname(directory) !== outputRoot) throw new Error('Unexpected cleanup path');
    await rm(directory, { recursive: true, force: true });
  }
});
