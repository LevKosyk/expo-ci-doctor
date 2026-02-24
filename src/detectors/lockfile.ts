import { fileExists, resolve } from '../core/context.js';

// ─── Output shape ───────────────────────────────────────────────────

export interface DepsInfo {
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  lockfiles: string[];
}

// ─── Detector ───────────────────────────────────────────────────────

const LOCKFILE_MAP: Array<{ file: string; pm: 'npm' | 'yarn' | 'pnpm' }> = [
  { file: 'package-lock.json', pm: 'npm' },
  { file: 'yarn.lock', pm: 'yarn' },
  { file: 'pnpm-lock.yaml', pm: 'pnpm' },
];

export function detectLockfile(cwd: string): DepsInfo {
  const found: string[] = [];
  let pm: 'npm' | 'yarn' | 'pnpm' | 'unknown' = 'unknown';

  for (const entry of LOCKFILE_MAP) {
    if (fileExists(resolve(cwd, entry.file))) {
      found.push(entry.file);
      if (pm === 'unknown') pm = entry.pm;
    }
  }

  return { packageManager: pm, lockfiles: found };
}
