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
const directory = await mkdtemp(path.join(outputRoot, 'claims-page-test-'));
const output = path.join(directory, 'page.mjs');
await build({ entryPoints: ['apps/frontend/src/modules/history/HistoryPage.jsx'], outfile: output,
  bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, logLevel: 'silent',
  plugins: [{ name: 'claims-fixtures', setup(builder) {
    builder.onResolve({ filter: /^react$/, namespace: 'fixture' }, () => ({ path: 'react', external: true }));
    builder.onResolve({ filter: /services\/claims$/ }, () => ({ path: 'claims', namespace: 'fixture' }));
    builder.onResolve({ filter: /services\/journey$/ }, () => ({ path: 'journey', namespace: 'fixture' }));
    builder.onResolve({ filter: /layout\/PageShell$/ }, () => ({ path: 'shell', namespace: 'fixture' }));
    builder.onResolve({ filter: /claims\/(ClaimCard|PickupVerificationPanel)$/ }, () => ({ path: 'cards', namespace: 'fixture' }));
    builder.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'router', namespace: 'fixture' }));
    builder.onResolve({ filter: /^motion\/react$/ }, () => ({ path: 'motion', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ contents:
      name === 'shell' ? 'import React from "react"; export default function Shell({children}){return React.createElement("div",null,children);}'
        : name === 'cards' ? 'import React from "react"; export function MyClaimCard({claim}){return React.createElement("div",null,claim.id)} export const DonorClaimCard=MyClaimCard; export default function Verification(){return null}'
          : name === 'router' ? 'export const useLocation=()=>({state:null});'
            : name === 'motion' ? 'import React from "react"; export const useReducedMotion=()=>true; export const useIsPresent=()=>true; export const AnimatePresence=({children})=>children; export const motion=new Proxy({}, {get:(_,tag)=>({children,initial,animate,exit,transition,layoutId,layout,custom,...props})=>React.createElement(tag,props,children)});'
              : name === 'journey' ? 'export const getDonorJourneyLocations=async()=>[]; export const notifyDonorOnMyWay=async()=>{};'
                : ['getMyClaims','getDonorClaims','decideClaim','decideCancellation','requestCancellation','verifyPickup'].map(method => `export const ${method}=(...args)=>globalThis.claimsFixture.${method}(...args);`).join('\n'), loader: 'js' }));
  } }],
});
const { default: HistoryPage } = await import(pathToFileURL(output));
const events = new EventTarget();
globalThis.window = { addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
  setInterval, clearInterval, requestAnimationFrame: () => 1, cancelAnimationFrame() {} };
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById: () => null };
after(async () => {
  delete globalThis.claimsFixture; delete globalThis.window; delete globalThis.document;
  if (path.dirname(directory) !== outputRoot) throw new Error('Unexpected cleanup path');
  await rm(directory, { recursive: true, force: true });
});

const requests = [{ id: 'claim-a', status: 'pending' }, { id: 'claim-b', status: 'pending' }];
const defaults = () => ({ getMyClaims: async () => [], getDonorClaims: async () => requests,
  decideClaim: async () => {}, decideCancellation: async () => {}, requestCancellation: async () => {}, verifyPickup: async () => {} });
const badge = (renderer, id) => renderer.root.findByProps({ id }).findByType('span').children.join('');

test('donor count loads while My Claims is selected, rather than showing an unloaded zero', async () => {
  globalThis.claimsFixture = defaults();
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(HistoryPage, { userProfile: { id: 'alice' } })); });
    assert.match(badge(renderer, 'donor-requests-tab'), /2/);
    assert.equal(renderer.root.findByProps({ id: 'my-claims-tab' }).props['aria-selected'], true);
  } finally { if (renderer) act(() => renderer.unmount()); }
});

test('tab switching and a failed background refresh keep the last confirmed donor count', async () => {
  globalThis.claimsFixture = defaults();
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(HistoryPage, { userProfile: { id: 'alice' } })); });
    await act(async () => renderer.root.findByProps({ id: 'donor-requests-tab' }).props.onClick());
    assert.match(badge(renderer, 'donor-requests-tab'), /2/);
    await act(async () => renderer.root.findByProps({ id: 'my-claims-tab' }).props.onClick());
    globalThis.claimsFixture.getDonorClaims = async () => { throw new Error('network'); };
    await act(async () => events.dispatchEvent(new Event('focus')));
    assert.match(badge(renderer, 'donor-requests-tab'), /2/);
  } finally { if (renderer) act(() => renderer.unmount()); }
});

test('an outstanding donor request shows loading rather than a zero count', async () => {
  let resolve;
  globalThis.claimsFixture = { ...defaults(), getDonorClaims: () => new Promise(done => { resolve = done; }) };
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(HistoryPage, { userProfile: { id: 'alice' } })); });
    assert.doesNotMatch(badge(renderer, 'donor-requests-tab'), /0/);
    await act(async () => resolve(requests));
    assert.match(badge(renderer, 'donor-requests-tab'), /2/);
  } finally { if (renderer) act(() => renderer.unmount()); }
});

test('late responses for a previous account cannot overwrite the new account count', async () => {
  let resolveOld;
  let calls = 0;
  globalThis.claimsFixture = { ...defaults(), getDonorClaims: () => ++calls === 1 ? new Promise(done => { resolveOld = done; }) : Promise.resolve([]) };
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(HistoryPage, { userProfile: { id: 'alice' } })); });
    await act(async () => renderer.update(React.createElement(HistoryPage, { userProfile: { id: 'bob' } })));
    await act(async () => resolveOld(requests));
    assert.match(badge(renderer, 'donor-requests-tab'), /0/);
  } finally { if (renderer) act(() => renderer.unmount()); }
});
