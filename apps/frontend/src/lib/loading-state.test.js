import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadingStage } from './loading-state.js';

test('loading progresses at the documented thresholds', () => {
  for (const [elapsed, expected] of [[0, 'normal'], [2999, 'normal'], [3000, 'slow'], [9999, 'slow'], [10000, 'reassurance'], [29999, 'reassurance'], [30000, 'recovery']]) {
    assert.equal(loadingStage(elapsed), expected);
  }
});
test('confirmed failure takes priority over elapsed time', () => {
  assert.equal(loadingStage(0, true), 'failed');
  assert.equal(loadingStage(10000, true), 'failed');
  assert.equal(loadingStage(30000, true), 'failed');
});
