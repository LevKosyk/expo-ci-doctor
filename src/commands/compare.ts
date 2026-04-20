import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { getCwd } from '../utils/context.js';

interface SnapshotLike {
  timestamp?: string;
  cwd?: string;
  expo?: string | null;
  reactNative?: string | null;
  enginesNode?: string | null;
  hasAppJson?: boolean;
  hasAppConfigJs?: boolean;
  hasAppConfigTs?: boolean;
  hasEasJson?: boolean;
  isMonorepo?: boolean;
  lockfile?: { packageManager?: string; files?: string[] };
  eas?: { profiles?: string[] };
  ci?: {
    hasWorkflow?: boolean;
    workflows?: Array<{ filename: string; nodeVersion?: string | null; usesSetupNode?: boolean; hasExpoToken?: boolean }>;
  };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface DiffItem {
  field: string;
  was: unknown;
  now: unknown;
  risk: 'info' | 'warn' | 'error';
  note: string;
}

export async function compareCommand(leftTarget: string, rightTarget: string): Promise<void> {
  const cwd = getCwd();
  const left = await loadTarget(leftTarget, cwd);
  const right = await loadTarget(rightTarget, cwd);

  console.log('');
  console.log(chalk.bold('  expo-ci-doctor compare') + chalk.dim(' · Target comparison'));
  console.log(chalk.dim(`  Left:  ${leftTarget}`));
  console.log(chalk.dim(`  Right: ${rightTarget}`));
  console.log('');

  const diffs = diffSnapshots(left, right);

  if (diffs.length === 0) {
    console.log(chalk.green('  ✔  No differences detected.\n'));
    process.exit(0);
  }

  for (const d of diffs) {
    const icon = d.risk === 'error' ? chalk.red('✖') : d.risk === 'warn' ? chalk.yellow('⚠') : chalk.blue('ℹ');
    const label = d.risk === 'error' ? chalk.red.bold('BLOCKER') : d.risk === 'warn' ? chalk.yellow.bold('RISK') : chalk.blue.bold('INFO');
    console.log(`  ${icon}  ${label}  ${chalk.bold(d.field)}`);
    console.log(`     was: ${chalk.dim(String(d.was))}`);
    console.log(`     now: ${chalk.white(String(d.now))}`);
    console.log(`     ${chalk.dim(d.note)}`);
    console.log('');
  }

  const errors = diffs.filter((d) => d.risk === 'error').length;
  const warns = diffs.filter((d) => d.risk === 'warn').length;

  console.log(chalk.dim('  ───────────────────────────────────'));
  console.log(chalk.dim(`  ${diffs.length} change${diffs.length > 1 ? 's' : ''} detected`));
  console.log('');

  process.exit(errors > 0 ? 2 : warns > 0 ? 1 : 0);
}

async function loadTarget(target: string, cwd: string): Promise<SnapshotLike> {
  if (fs.existsSync(target) && target.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(target, 'utf-8')) as SnapshotLike;
  }

  const resolved = await resolveGitRef(target, cwd);
  if (resolved) return resolved;

  throw new Error(`Could not resolve target: ${target}`);
}

async function resolveGitRef(ref: string, cwd: string): Promise<SnapshotLike | null> {
  try {
    execSync(`git rev-parse --verify --quiet ${escapeShell(ref)}`, { cwd, stdio: 'ignore' });
  } catch {
    return null;
  }

  const snapshot: SnapshotLike = {
    timestamp: new Date().toISOString(),
    cwd: `${ref} (git ref)`,
    dependencies: {},
    devDependencies: {},
    lockfile: { packageManager: 'unknown', files: [] },
    eas: { profiles: [] },
    ci: { hasWorkflow: false, workflows: [] },
  };

  const packageJson = readGitFile(cwd, ref, 'package.json');
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson) as Record<string, unknown>;
      const deps = (pkg.dependencies ?? {}) as Record<string, string>;
      const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
      const engines = pkg.engines as { node?: string } | undefined;
      snapshot.dependencies = deps;
      snapshot.devDependencies = devDeps;
      snapshot.expo = { ...deps, ...devDeps }['expo'] ?? null;
      snapshot.reactNative = { ...deps, ...devDeps }['react-native'] ?? null;
      snapshot.enginesNode = engines?.node ?? null;
    } catch {
      // keep defaults
    }
  }

  snapshot.hasAppJson = Boolean(readGitFile(cwd, ref, 'app.json'));
  snapshot.hasAppConfigJs = Boolean(readGitFile(cwd, ref, 'app.config.js'));
  snapshot.hasAppConfigTs = Boolean(readGitFile(cwd, ref, 'app.config.ts'));
  snapshot.hasEasJson = Boolean(readGitFile(cwd, ref, 'eas.json'));
  snapshot.isMonorepo = Boolean(readGitFile(cwd, ref, 'pnpm-workspace.yaml'))
    || Boolean(readGitFile(cwd, ref, 'lerna.json'))
    || Boolean(readGitFile(cwd, ref, 'package.json') && readGitFile(cwd, ref, 'package.json')?.includes('workspaces'));

  const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].filter((file) => Boolean(readGitFile(cwd, ref, file)));
  snapshot.lockfile = {
    packageManager: lockfiles.includes('package-lock.json') ? 'npm' : lockfiles.includes('yarn.lock') ? 'yarn' : lockfiles.includes('pnpm-lock.yaml') ? 'pnpm' : 'unknown',
    files: lockfiles,
  };

  const easJson = readGitFile(cwd, ref, 'eas.json');
  if (easJson) {
    try {
      const raw = JSON.parse(easJson) as { build?: Record<string, unknown> };
      snapshot.eas = { profiles: Object.keys(raw.build ?? {}) };
    } catch {
      snapshot.eas = { profiles: [] };
    }
  }

  const workflowFiles = listGitFiles(cwd, ref, ['.github/workflows', '.gitlab-ci.yml', '.circleci/config.yml']);
  const workflows = workflowFiles.map((filename) => {
    const content = readGitFile(cwd, ref, filename) ?? '';
    return {
      filename,
      nodeVersion: detectNodeVersion(content),
      usesSetupNode: /setup-node|image:\s*node:/i.test(content),
      hasExpoToken: content.includes('EXPO_TOKEN'),
    };
  });
  snapshot.ci = { hasWorkflow: workflows.length > 0, workflows };

  return snapshot;
}

function diffSnapshots(left: SnapshotLike, right: SnapshotLike): DiffItem[] {
  const diffs: DiffItem[] = [];

  if ((left.expo ?? null) !== (right.expo ?? null)) {
    diffs.push({ field: 'expo', was: left.expo ?? null, now: right.expo ?? null, risk: 'warn', note: 'Expo SDK changed. Verify react-native compatibility.' });
  }
  if ((left.reactNative ?? null) !== (right.reactNative ?? null)) {
    diffs.push({ field: 'react-native', was: left.reactNative ?? null, now: right.reactNative ?? null, risk: 'warn', note: 'RN version change can break native modules.' });
  }
  if ((left.enginesNode ?? null) !== (right.enginesNode ?? null)) {
    diffs.push({ field: 'engines.node', was: left.enginesNode ?? null, now: right.enginesNode ?? null, risk: 'warn', note: 'Node version constraint changed.' });
  }

  const leftProfiles = (left.eas?.profiles ?? []).slice().sort().join(',');
  const rightProfiles = (right.eas?.profiles ?? []).slice().sort().join(',');
  if (leftProfiles !== rightProfiles) {
    diffs.push({ field: 'eas.profiles', was: left.eas?.profiles ?? [], now: right.eas?.profiles ?? [], risk: 'error', note: 'EAS profiles changed.' });
  }

  if ((left.lockfile?.packageManager ?? 'unknown') !== (right.lockfile?.packageManager ?? 'unknown')) {
    diffs.push({ field: 'packageManager', was: left.lockfile?.packageManager ?? 'unknown', now: right.lockfile?.packageManager ?? 'unknown', risk: 'error', note: 'Package manager changed; CI may use a different install command.' });
  }

  const allLeft = { ...(left.dependencies ?? {}), ...(left.devDependencies ?? {}) };
  const allRight = { ...(right.dependencies ?? {}), ...(right.devDependencies ?? {}) };
  const added = Object.keys(allRight).filter((k) => !(k in allLeft));
  const removed = Object.keys(allLeft).filter((k) => !(k in allRight));
  const changed = Object.keys(allRight).filter((k) => k in allLeft && allRight[k] !== allLeft[k]);

  if (added.length > 0) diffs.push({ field: 'dependencies (added)', was: '—', now: added.join(', '), risk: 'info', note: `${added.length} new dependencies.` });
  if (removed.length > 0) diffs.push({ field: 'dependencies (removed)', was: removed.join(', '), now: '—', risk: 'info', note: `${removed.length} dependencies removed.` });
  if (changed.length > 0) diffs.push({ field: 'dependencies (changed)', was: changed.map((k) => `${k}@${allLeft[k]}`).join(', '), now: changed.map((k) => `${k}@${allRight[k]}`).join(', '), risk: 'warn', note: `${changed.length} dependencies changed versions.` });

  return diffs;
}

function readGitFile(cwd: string, ref: string, filePath: string): string | null {
  try {
    return execSync(`git show ${escapeShell(ref)}:${escapeGitPath(filePath)}`, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function listGitFiles(cwd: string, ref: string, prefixes: string[]): string[] {
  try {
    const output = execSync(`git ls-tree -r --name-only ${escapeShell(ref)}`, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }) as string;
    const files = output.split('\n').filter(Boolean);
    return files.filter((file) => prefixes.some((prefix) => file === prefix || file.startsWith(`${prefix}/`)));
  } catch {
    return [];
  }
}

function detectNodeVersion(content: string): string | null {
  const m = content.match(/node-version['":\s]*['"]?([\d.]+x?|\d+)/i)
    ?? content.match(/node:\s*['"]?([\d.]+x?|\d+)/i)
    ?? content.match(/image:\s*node:([\d.]+)/i);
  return m?.[1] ?? null;
}

function escapeShell(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function escapeGitPath(value: string): string {
  return value.replace(/:/g, '\\:');
}
