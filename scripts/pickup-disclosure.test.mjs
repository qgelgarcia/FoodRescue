import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { build } from 'esbuild';

test('pickup disclosure creates, cleans and recreates its map across open/close transitions', async () => {
  const outputRoot = path.resolve('output');
  await mkdir(outputRoot, { recursive: true });
  const directory = await mkdtemp(path.join(outputRoot, 'pickup-disclosure-test-'));
  let renderer;
  globalThis.pickupMapFixture = { created: 0, removed: 0 };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.window = { dispatchEvent() {} };
  try {
    const output = path.join(directory, 'disclosure.mjs');
    await build({ entryPoints: ['apps/frontend/src/components/claims/PickupLocationMap.jsx'], outfile: output,
      bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent',
      plugins: [{ name: 'map-fixture', setup(builder) {
        builder.onResolve({ filter: /^react$/, namespace: 'fixture' }, () => ({ path: 'react', external: true }));
        builder.onResolve({ filter: /\.css$/ }, () => ({ path: 'css', namespace: 'fixture' }));
        builder.onResolve({ filter: /^leaflet$/ }, () => ({ path: 'map', namespace: 'fixture' }));
        builder.onResolve({ filter: /^motion\/react$/ }, () => ({ path: 'motion', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ contents: name === 'css' ? ''
          : name === 'motion' ? 'import React from "react"; export const useReducedMotion=()=>true; export const AnimatePresence=({children})=>children; export const motion={div:React.forwardRef(({children,initial,animate,exit,transition,onAnimationComplete,...props},ref)=>React.createElement("div",{...props,ref},children))};'
            : 'export default {map(){globalThis.pickupMapFixture.created++; return {setView(){return this},invalidateSize(){},remove(){globalThis.pickupMapFixture.removed++}}},tileLayer(){return {on(){return this},addTo(){return this}}},circleMarker(){return {addTo(){return this},bindTooltip(){return this}}}};', loader: 'js' }));
      } }],
    });
    const { default: Disclosure } = await import(pathToFileURL(output));
    act(() => { renderer = TestRenderer.create(React.createElement(Disclosure, { claim: { pickup_lat: 25.03, pickup_lng: 121.56, location: 'Test pickup' } }), { createNodeMock: () => ({}) }); });
    assert.equal(globalThis.pickupMapFixture.created, 0);
    act(() => renderer.root.findByType('button').props.onClick());
    assert.equal(globalThis.pickupMapFixture.created, 1, 'opening must initialize the newly mounted map');
    act(() => renderer.root.findByType('button').props.onClick());
    assert.equal(globalThis.pickupMapFixture.removed, 1);
    act(() => renderer.root.findByType('button').props.onClick());
    assert.equal(globalThis.pickupMapFixture.created, 2, 'reopening must create a fresh map');
    act(() => renderer.unmount()); renderer = null;
    assert.equal(globalThis.pickupMapFixture.removed, 2);
  } finally {
    if (renderer) act(() => renderer.unmount());
    delete globalThis.pickupMapFixture; delete globalThis.ResizeObserver; delete globalThis.window;
    if (path.dirname(directory) !== outputRoot) throw new Error('Unexpected cleanup path');
    await rm(directory, { recursive: true, force: true });
  }
});
