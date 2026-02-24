import * as fs from 'node:fs';
import chalk from 'chalk';
import { getCwd } from '../core/context.js';
import { detectProject } from '../detectors/project.js';

/**
 * The `snapshot` command.
 * Saves a JSON snapshot of the current project state for later diffing.
 */
export async function snapshotCommand(): Promise<void> {
  const cwd = getCwd();

  console.log('');
  console.log(chalk.bold('  expo-ci-doctor snapshot') + chalk.dim(' · Project state capture'));

  const info = detectProject(cwd);

  const snapshot = {
    timestamp: new Date().toISOString(),
    cwd: info.cwd,
    expo: info.expoVersion ?? null,
    reactNative: info.reactNativeVersion ?? null,
    enginesNode: info.enginesNode ?? null,
    hasAppJson: info.hasAppJson,
    hasAppConfigJs: info.hasAppConfigJs,
    hasEasJson: info.hasEasJson,
    isMonorepo: info.isMonorepo,
    lockfile: {
      packageManager: info.deps.packageManager,
      files: info.deps.lockfiles,
    },
    eas: {
      profiles: info.eas.profiles,
    },
    ci: {
      hasWorkflow: info.ci.hasWorkflow,
      workflows: info.ci.workflows.map((w) => ({
        filename: w.filename,
        nodeVersion: w.nodeVersion ?? null,
        usesSetupNode: w.usesSetupNode,
        hasExpoToken: w.hasExpoToken,
      })),
    },
    dependencies: info.dependencies,
    devDependencies: info.devDependencies,
  };

  const filename = 'expo-doctor-snapshot.json';
  fs.writeFileSync(filename, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');

  console.log(`  ${chalk.green('✔')}  Snapshot saved: ${chalk.bold(filename)}`);
  console.log(chalk.dim(`     ${Object.keys(info.dependencies).length} deps, ` +
    `${info.eas.profiles.length} EAS profiles, ` +
    `${info.ci.workflows.length} CI workflows`));
  console.log('');
}
