import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';
import { ESLint } from 'eslint';

test('page boundary preserves surrounding navigation, retries, and resets on navigation', async () => {
  const outputRoot = path.resolve('output');
  await mkdir(outputRoot, { recursive: true });
  const directory = await mkdtemp(path.join(outputRoot, 'page-recovery-test-'));
  const output = path.join(directory, 'boundary.mjs');
  try {
    await build({ entryPoints: ['apps/frontend/src/components/layout/PageErrorBoundary.jsx'], outfile: output,
      bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, logLevel: 'silent' });
    const { default: Boundary } = await import(pathToFileURL(output));
    let fail = true;
    function Page() { if (fail) throw new Error('private stack data'); return React.createElement('p', null, 'Restored page'); }
    const layout = (key) => React.createElement('main', null,
      React.createElement('header', null, 'Navigation stays available'),
      React.createElement(Boundary, { key, onGoHome() {} }, React.createElement(Page)));
    const originalError = console.error;
    let renderer;
    console.error = () => {}; // React intentionally reports the fixture error to stderr.
    try {
      act(() => { renderer = TestRenderer.create(layout('/app/profile')); });
      assert.equal(renderer.root.findByType('header').children[0], 'Navigation stays available');
      assert.equal(renderer.root.findByProps({ role: 'alert' }).findByType('h1').children[0], 'This page couldn’t load');
      assert.ok(!JSON.stringify(renderer.toJSON()).includes('private stack data'));
      fail = false;
      act(() => renderer.root.findAllByType('button')[0].props.onClick());
      assert.equal(renderer.root.findByType('p').children[0], 'Restored page');
      fail = true;
      act(() => renderer.update(layout('/app/broken')));
      fail = false;
      act(() => renderer.update(layout('/app/home-feed')));
      assert.equal(renderer.root.findByType('p').children[0], 'Restored page');
    } finally { console.error = originalError; renderer?.unmount(); }
  } finally {
    if (path.dirname(directory) !== outputRoot) throw new Error('Unexpected test cleanup path');
    await rm(directory, { recursive: true, force: true });
  }
});

test('JSX lint catches the omitted-icon import that can pass a Vite build', async () => {
  const eslint = new ESLint();
  const [broken] = await eslint.lintText('export default function Page() { return <LogOut />; }', { filePath: 'apps/frontend/src/modules/profile/Fixture.jsx' });
  assert.ok(broken.messages.some(message => message.ruleId === 'no-undef'));
  const [valid] = await eslint.lintText('import { LogOut } from "lucide-react"; export default function Page() { return <LogOut />; }', { filePath: 'apps/frontend/src/modules/profile/Fixture.jsx' });
  assert.equal(valid.errorCount, 0);
});
