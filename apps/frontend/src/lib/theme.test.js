import test from 'node:test';
import assert from 'node:assert/strict';
import { revealCircle, applyTheme, transitionTheme } from './theme.js';

test('theme reveal starts at the icon center and reaches all viewport corners', () => {
  for (const bounds of [{ left: 20, top: 600, width: 34, height: 34 }, { left: 1000, top: 20, width: 34, height: 34 }]) {
    const [start, end] = revealCircle(bounds, 1280, 720);
    const x = bounds.left + 17, y = bounds.top + 17;
    assert.equal(start, `circle(0px at ${x}px ${y}px)`);
    const radius = Number(end.match(/circle\((\d+)/)[1]);
    for (const [cx, cy] of [[0, 0], [1280, 0], [0, 720], [1280, 720]]) assert.ok(radius >= Math.hypot(cx - x, cy - y));
  }
});
test('applying appearance survives blocked storage and updates browser surfaces', () => {
  const originalDocument = globalThis.document, originalStorage = globalThis.localStorage;
  const meta = {};
  globalThis.document = { documentElement: { dataset: {}, style: {} }, querySelector: () => ({ setAttribute: (key, value) => { meta[key] = value; } }) };
  globalThis.localStorage = { setItem: () => { throw new Error('blocked'); } };
  try {
    applyTheme('dark');
    assert.equal(document.documentElement.dataset.theme, 'dark');
    assert.equal(document.documentElement.style.colorScheme, 'dark');
    assert.equal(meta.content, '#101b15');
    applyTheme('light');
    assert.equal(document.documentElement.dataset.theme, 'light');
  } finally { globalThis.document = originalDocument; globalThis.localStorage = originalStorage; }
});

test('theme reveal releases snapshots after its own animation without waiting for unrelated animation', async () => {
  const previous = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage };
  const classes = new Set();
  let release, skipped = false, updates = 0, options;
  const finished = new Promise(resolve => { release = resolve; });
  const root = { dataset: {}, style: {}, classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    animate: (_frames, config) => { options = config; return { finished: Promise.resolve(), cancel() {} }; } };
  globalThis.window = { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) };
  globalThis.document = { documentElement: root, querySelector: () => null,
    startViewTransition: change => { change(); return { ready: Promise.resolve(), finished, skipTransition: () => { skipped = true; release(); } }; } };
  globalThis.localStorage = { setItem() {} };
  try {
    await Promise.race([
      transitionTheme('dark', { left: 30, top: 40, width: 34, height: 34 }, () => { updates++; }),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Reveal is still waiting on unrelated animations')), 100); timer.unref(); }),
    ]);
    assert.equal(skipped, true);
    assert.equal(updates, 1);
    assert.equal(options.duration, 550);
    assert.equal(options.pseudoElement, '::view-transition-new(root)');
    assert.equal(classes.has('theme-reveal'), false);
  } finally {
    release();
    globalThis.document = previous.document; globalThis.window = previous.window; globalThis.localStorage = previous.localStorage;
  }
});

test('repeated theme reveals cancel every finished animation so no filled frames survive', async () => {
  const previous = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage };
  let activeAnimations = 0, cancelled = 0;
  const classes = new Set();
  const root = { dataset: {}, style: {}, classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    animate: () => {
      activeAnimations++;
      return { finished: Promise.resolve(), cancel: () => { activeAnimations--; cancelled++; } };
    } };
  globalThis.document = { documentElement: root, querySelector: () => null,
    startViewTransition: change => { change(); return { ready: Promise.resolve(), finished: Promise.resolve(), skipTransition() {} }; } };
  globalThis.window = { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) };
  globalThis.localStorage = { setItem() {} };
  try {
    for (const theme of ['dark', 'light', 'dark', 'light', 'dark', 'light']) {
      await transitionTheme(theme, { left: 40, top: 50, width: 34, height: 34 }, () => {});
      assert.equal(activeAnimations, 0);
      assert.equal(root.dataset.theme, theme);
      assert.equal(classes.has('theme-reveal'), false);
    }
    assert.equal(cancelled, 6);
  } finally { globalThis.document = previous.document; globalThis.window = previous.window; globalThis.localStorage = previous.localStorage; }
});
