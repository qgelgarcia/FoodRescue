import test from 'node:test';
import assert from 'node:assert/strict';
import { conflictMarkerPattern } from './check-conflicts.mjs';

test('rejects all merge marker styles including diff3 and CRLF', () => {
  for (const [character, suffix] of [['<', ' HEAD'], ['|', ' base'], ['=', ''], ['>', ' feature']]) {
    for (const length of [7, 9]) {
      const marker = character.repeat(length) + suffix;
      assert.ok(conflictMarkerPattern.test(`before\n${marker}\nafter`));
      assert.ok(conflictMarkerPattern.test(`before\r\n${marker}\r\nafter`));
    }
  }
});
test('allows normal code, prose and inline marker examples', () => {
  for (const value of ['if (a === b) {}', '# Heading', 'text ' + '<'.repeat(7) + ' HEAD', 'const pattern = /={7,}/;', '='.repeat(6)]) assert.equal(conflictMarkerPattern.test(value), false);
});

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

test('actual Git scanner rejects tracked markers and allows clean tracked files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'foodrescue-ci-'));
  const scanner = fileURLToPath(new URL('./check-conflicts.mjs', import.meta.url));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    const fixture = join(directory, 'fixture.txt');
    writeFileSync(fixture, 'clean source\n');
    execFileSync('git', ['add', 'fixture.txt'], { cwd: directory });
    assert.equal(spawnSync(process.execPath, [scanner], { cwd: directory }).status, 0);
    for (const marker of ['<'.repeat(7) + ' HEAD', '='.repeat(7), '|'.repeat(7) + ' base', '>'.repeat(7) + ' feature']) {
      writeFileSync(fixture, `source\r\n${marker}\r\nsource\r\n`);
      const result = spawnSync(process.execPath, [scanner], { cwd: directory, encoding: 'utf8' });
      assert.equal(result.status, 1, `Marker should fail: ${marker}`);
      assert.match(result.stderr, /fixture.txt:2/);
    }
  } finally {
    if (dirname(resolve(directory)) !== resolve(tmpdir())) throw new Error('Unexpected test cleanup path');
    rmSync(directory, { recursive: true, force: true });
  }
});
