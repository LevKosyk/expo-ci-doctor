import * as semver from 'semver';
import chalk from 'chalk';
import { getCwd } from '../utils/context.js';
import { detectProject } from '../detectors/project.js';
import { getExpoSdkCompat, getSupportedExpoSdks, generateUpgradeSafetyReport, parseUpgradeTarget } from '../analyzers/upgrade.js';
import { printTitle } from '../utils/logger.js';

export async function upgradePlanCommand(options: {
  expo?: string;
  reactNative?: string;
  node?: string;
  easCli?: string;
} = {}): Promise<void> {
  const cwd = getCwd();
  const info = detectProject(cwd);

  printTitle('expo-ci-doctor upgrade-plan');

  const currentExpo = info.expoVersion ?? null;
  const currentExpoMajor = currentExpo ? semver.coerce(currentExpo)?.major ?? null : null;
  const supportedSdks = getSupportedExpoSdks();
  const latestSupported = supportedSdks[supportedSdks.length - 1] ?? currentExpoMajor ?? 52;
  const targetExpo = normalizeExpoTarget(options.expo) ?? (currentExpoMajor && currentExpoMajor < latestSupported ? `${currentExpoMajor + 1}` : `${latestSupported}`);
  const expoTarget = `expo@${targetExpo}`;
  const expoReport = generateUpgradeSafetyReport(parseUpgradeTarget(expoTarget, { ...info.dependencies, ...info.devDependencies }), { ...info.dependencies, ...info.devDependencies }, info.enginesNode);

  const expoCompatTarget = semver.coerce(targetExpo)?.major ?? currentExpoMajor ?? null;
  const compat = expoCompatTarget ? getExpoSdkCompat(expoCompatTarget) : null;
  const targetRN = options.reactNative ?? compat?.reactNative ?? info.reactNativeVersion ?? 'latest';
  const targetNode = options.node ?? compat?.nodeMin ?? info.enginesNode ?? '>=18.0.0';
  const targetEas = options.easCli ?? 'latest';

  printSection('Expo SDK', [
    `Current: ${currentExpo ?? 'not installed'}`,
    `Target:  ${targetExpo}`,
    `Command: npx expo install ${expoTarget}`,
    ...expoReport.items.map((item) => `${item.risk === 'breaking' ? '✖' : item.risk === 'risky' ? '⚠' : '✔'} ${item.item} — ${item.reason}`),
  ]);

  printSection('React Native', [
    `Current: ${info.reactNativeVersion ?? 'not installed'}`,
    `Target:  ${targetRN}`,
    `Command: npx expo install react-native${targetRN === 'latest' ? '' : `@${targetRN}`}`,
  ]);

  printSection('Node', [
    `Current: ${info.enginesNode ?? 'not specified'}`,
    `Target:  ${targetNode}`,
    `Command: set engines.node to "${targetNode}" and match CI setup-node`,
  ]);

  printSection('EAS CLI', [
    `Current: ${info.dependencies['eas-cli'] ?? info.devDependencies['eas-cli'] ?? 'not installed'}`,
    `Target:  ${targetEas}`,
    `Command: npm install -g eas-cli@${targetEas}`,
  ]);

  printChecklist([
    {
      title: 'Review breaking items before changing versions',
      detail: expoReport.breaking.length > 0
        ? `${expoReport.breaking.length} breaking item(s) were detected for the Expo upgrade path.`
        : 'No breaking Expo upgrade items were detected in the current safety report.',
    },
    {
      title: `Upgrade Expo SDK to ${targetExpo}`,
      detail: 'Start with the Expo SDK so the rest of the dependency graph can be aligned to it.',
      command: `npx expo install ${expoTarget}`,
    },
    {
      title: 'Realign Expo-managed packages',
      detail: 'Reinstall Expo packages after the SDK bump to keep native and JS dependencies in sync.',
      command: 'npx expo install --fix',
    },
    {
      title: 'Update Node and CI runtime settings',
      detail: `Set engines.node to ${targetNode} and mirror the same runtime in GitHub Actions or your CI provider.`,
      command: `Update package.json engines.node and CI setup-node to ${targetNode}`,
    },
    {
      title: 'Upgrade EAS CLI when needed',
      detail: 'Keep the EAS CLI version aligned with the project and CI environment.',
      command: `npm install -g eas-cli@${targetEas}`,
    },
    {
      title: 'Run a clean verification pass',
      detail: 'Finish with a local check, your test suite, and one clean CI/EAS build.',
      command: 'expo-ci-doctor check && npm test && eas build',
    },
  ]);

  console.log(chalk.dim('  Suggested order: Expo SDK → React Native → Node → EAS CLI'));
  console.log('');
}

function normalizeExpoTarget(target?: string): string | null {
  if (!target) return null;
  const value = target.includes('@') ? target.split('@').pop() ?? target : target;
  if (value === 'latest') return null;
  return value;
}

function printSection(title: string, lines: string[]): void {
  console.log('');
  console.log(chalk.bold(`  ${title}`));
  console.log(chalk.dim('  ─────────────────────────'));
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}

function printChecklist(steps: Array<{ title: string; detail: string; command?: string }>): void {
  console.log('');
  console.log(chalk.bold('  Upgrade checklist'));
  console.log(chalk.dim('  ─────────────────────────'));

  for (const [index, step] of steps.entries()) {
    console.log(`  ${chalk.cyan(`${index + 1}.`)} ${step.title}`);
    console.log(`     ${chalk.dim(step.detail)}`);
    if (step.command) {
      console.log(`     ${chalk.bold('Command:')} ${step.command}`);
    }
  }

  console.log('');
}
