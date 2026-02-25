import * as fs from 'node:fs';
import chalk from 'chalk';
import { getCwd } from '../core/context.js';
import { detectProject } from '../detectors/project.js';
import { requireProFeature } from '../core/license-entitlements.js';

interface Snapshot {
  timestamp: string;
  expo: string | null;
  reactNative: string | null;
  enginesNode: string | null;
  hasAppJson: boolean;
  hasAppConfigJs: boolean;
  hasEasJson: boolean;
  isMonorepo: boolean;
  lockfile: { packageManager: string; files: string[] };
  eas: { profiles: string[] };
  ci: {
    hasWorkflow: boolean;
    workflows: Array<{
      filename: string;
      nodeVersion: string | null;
      usesSetupNode: boolean;
      hasExpoToken: boolean;
    }>;
  };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface DiffItem {
  field: string;
  was: unknown;
  now: unknown;
  risk: 'info' | 'warn' | 'error';
  note: string;
}

/**
 * The `diff` command.
 * Compares the current project state against a saved snapshot.
 */
export async function diffCommand(snapshotFile: string): Promise<void> {
  await requireProFeature('diff');

  if (!fs.existsSync(snapshotFile)) {
    console.error(chalk.red(`\n  ✖  Snapshot not found: ${snapshotFile}\n`));
    process.exit(2);
  }

  const cwd = getCwd();
  const old: Snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf-8'));
  const info = detectProject(cwd);

  console.log('');
  console.log(chalk.bold('  expo-ci-doctor diff') + chalk.dim(' · Snapshot comparison') + chalk.green(' PRO'));
  console.log(chalk.dim(`  Snapshot: ${snapshotFile} (${old.timestamp})`));
  console.log('');

  const diffs: DiffItem[] = [];

  // Expo version
  if ((info.expoVersion ?? null) !== old.expo) {
    diffs.push({
      field: 'expo',
      was: old.expo,
      now: info.expoVersion ?? null,
      risk: 'warn',
      note: 'Expo SDK change. Verify react-native compatibility.',
    });
  }

  // React Native version
  if ((info.reactNativeVersion ?? null) !== old.reactNative) {
    diffs.push({
      field: 'react-native',
      was: old.reactNative,
      now: info.reactNativeVersion ?? null,
      risk: 'warn',
      note: 'RN version change can break native modules in CI.',
    });
  }

  // engines.node
  if ((info.enginesNode ?? null) !== old.enginesNode) {
    diffs.push({
      field: 'engines.node',
      was: old.enginesNode,
      now: info.enginesNode ?? null,
      risk: 'warn',
      note: 'Node version constraint changed. Update CI accordingly.',
    });
  }

  // EAS profiles
  const oldProfiles = (old.eas?.profiles ?? []).sort().join(',');
  const newProfiles = info.eas.profiles.sort().join(',');
  if (oldProfiles !== newProfiles) {
    diffs.push({
      field: 'eas.profiles',
      was: old.eas?.profiles ?? [],
      now: info.eas.profiles,
      risk: 'error',
      note: 'EAS profiles changed. Verify CI --profile flags match.',
    });
  }

  // Package manager
  if (old.lockfile?.packageManager !== info.deps.packageManager) {
    diffs.push({
      field: 'packageManager',
      was: old.lockfile?.packageManager,
      now: info.deps.packageManager,
      risk: 'error',
      note: 'Package manager changed. CI may use wrong install command.',
    });
  }

  // Dependency changes
  const allOld = { ...old.dependencies, ...old.devDependencies };
  const allNew = { ...info.dependencies, ...info.devDependencies };

  const added = Object.keys(allNew).filter((k) => !(k in allOld));
  const removed = Object.keys(allOld).filter((k) => !(k in allNew));
  const changed = Object.keys(allNew).filter((k) => k in allOld && allNew[k] !== allOld[k]);

  if (added.length > 0) {
    diffs.push({
      field: 'dependencies (added)',
      was: '—',
      now: added.join(', '),
      risk: 'info',
      note: `${added.length} new dependencies.`,
    });
  }
  if (removed.length > 0) {
    diffs.push({
      field: 'dependencies (removed)',
      was: removed.join(', '),
      now: '—',
      risk: 'info',
      note: `${removed.length} dependencies removed.`,
    });
  }
  if (changed.length > 0) {
    diffs.push({
      field: 'dependencies (changed)',
      was: changed.map((k) => `${k}@${allOld[k]}`).join(', '),
      now: changed.map((k) => `${k}@${allNew[k]}`).join(', '),
      risk: 'warn',
      note: `${changed.length} dependencies changed versions.`,
    });
  }

  // ── Print ─────────────────────────────────────────────────────────
  if (diffs.length === 0) {
    console.log(chalk.green('  ✔  No changes detected since snapshot.\n'));
    process.exit(0);
  }

  for (const d of diffs) {
    const icon = d.risk === 'error' ? chalk.red('✖') : d.risk === 'warn' ? chalk.yellow('⚠') : chalk.blue('ℹ');
    const label = d.risk === 'error' ? chalk.red.bold('CI BREAK') : d.risk === 'warn' ? chalk.yellow.bold('RISK') : chalk.blue.bold('INFO');

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

  if (errors > 0) process.exit(2);
  if (warns > 0) process.exit(1);
  process.exit(0);
}
