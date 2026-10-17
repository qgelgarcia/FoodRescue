import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const conflictMarkerPattern = /^(?:<{7,}(?: .*)?|\|{7,}(?: .*)?|={7,}|>{7,}(?: .*)?)\r?$/m;

export function checkConflicts() {
  const unmerged = execFileSync('git', ['ls-files', '--unmerged'], { encoding: 'utf8' });
  if (unmerged.trim()) {
    console.error('Unresolved merge conflicts remain in the Git index. Resolve and stage them before continuing.');
    return 1;
  }
  // Search tracked text only; binaries, ignored dependencies and submodules are excluded by Git.
  const result = spawnSync('git', ['grep', '--line-number', '-I', '-E', '^(<{7,}( .*)?|[|]{7,}( .*)?|={7,}|>{7,}( .*)?)[[:space:]]*$', '--', '.'], { encoding: 'utf8' });
  if (result.status === 0) {
    // Print locations only, since conflict contents can contain private data.
    console.error('Leftover merge-conflict markers found:');
    for (const match of result.stdout.trim().split('\n')) console.error(match.split(':').slice(0, 2).join(':'));
    return 1;
  }
  if (result.status !== 1) {
    console.error('Unable to inspect Git files for merge conflicts.');
    return 1;
  }
  console.log('No unresolved merge conflicts or leftover conflict markers.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = checkConflicts();
