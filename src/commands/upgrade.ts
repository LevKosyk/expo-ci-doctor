import { getCwd } from '../utils/context.js';
import { detectProject } from '../detectors/project.js';
import { printTitle, icons, colors } from '../utils/logger.js';
import { parseUpgradeTarget, generateUpgradeSafetyReport } from '../analyzers/upgrade.js';
import inquirer from 'inquirer';

export async function upgradeCommand(targetVersion?: string): Promise<void> {
  const cwd = getCwd();
  printTitle('expo-ci-doctor upgrade');

  const info = detectProject(cwd);
  
  if (!info.hasPackageJson) {
    console.log(colors.error(`  ${icons.error} No package.json found.`));
    process.exit(1);
  }

  let finalTarget = targetVersion;

  if (!finalTarget) {
    const { version } = await inquirer.prompt([
      {
         type: 'input',
         name: 'version',
         message: 'Which Expo SDK version do you want to upgrade to? (e.g., 51, 52)',
         default: '52',
      }
    ]);
    finalTarget = `expo@${version}`;
  } else if (!finalTarget.startsWith('expo@')) {
    finalTarget = `expo@${finalTarget}`;
  }

  const allDeps = {
    ...info.dependencies,
    ...info.devDependencies,
  };

  const target = parseUpgradeTarget(finalTarget, allDeps);
  const report = generateUpgradeSafetyReport(target, allDeps, info.enginesNode);

  const from = target.fromVersion ?? 'unknown';
  const to   = target.toVersion;
  
  console.log(colors.dim(`\n  Simulating upgrade to SDK ${to}... (from ${from})\n`));

  if (report.safe.length > 0) {
    console.log(colors.success('  Safe:'));
    for (const i of report.safe) {
      console.log(`    ${icons.success} ${i.item}`);
      console.log(`      ${colors.dim(i.reason)}`);
    }
  }
  
  if (report.risky.length > 0) {
    console.log(colors.warning('\n  Risky:'));
    for (const i of report.risky) {
      console.log(`    ${icons.warning} ${i.item}`);
      console.log(`      ${colors.dim(i.reason)}`);
    }
  }
  
  if (report.breaking.length > 0) {
    console.log(colors.error('\n  Potential breaking changes:'));
    for (const i of report.breaking) {
      console.log(`    ${icons.error} ${i.item}`);
      console.log(`      ${colors.dim(i.reason)}`);
    }
  }

  console.log('');
  const summaryColor = report.breaking.length > 0 ? colors.error
    : report.risky.length > 0 ? colors.warning : colors.success;
  console.log(summaryColor(`  ${report.summary}`));
  console.log('');
}
