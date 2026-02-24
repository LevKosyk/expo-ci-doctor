import ora from 'ora';
import chalk from 'chalk';
import { getCwd } from '../core/context.js';
import { getLicenseState } from '../core/license.js';
import { loadConfig } from '../core/config.js';
import { detectProject } from '../detectors/project.js';
import { runRules, exitCode } from '../rules/rules.js';
import { printReport } from '../report/print.js';
import type { RulePack } from '../core/types.js';

/**
 * The `check` command.
 * Scans the current directory, runs all rules, prints the report.
 */
export async function checkCommand(options: {
  ciStrict?: boolean;
  pack?: string;
} = {}): Promise<void> {
  const cwd = getCwd();
  const license = getLicenseState();
  const config = loadConfig(cwd);

  console.log('');
  console.log(
    chalk.bold('  expo-ci-doctor') +
    chalk.dim(' · CI / EAS Build diagnostics') +
    (license.mode === 'pro' ? chalk.green(' PRO') : chalk.dim(' FREE'))
  );
  console.log(chalk.dim(`  ${cwd}`));

  const spinner = ora({ text: 'Scanning project…', color: 'cyan', indent: 2 }).start();
  await delay(300);

  const info = detectProject(cwd);

  if (!info.hasPackageJson) {
    spinner.fail('No package.json found — is this a JS/TS project?');
    process.exit(2);
  }

  if (info.isMonorepo) {
    spinner.text = 'Monorepo detected — scanning root…';
    await delay(150);
  }

  spinner.text = 'Running rules…';
  await delay(200);

  const { results, skippedPro } = runRules(info, {
    isPro: license.mode === 'pro',
    pack: options.pack as RulePack | undefined,
    ciStrict: options.ciStrict,
    config,
  });
  const code = exitCode(results);

  spinner.stop();

  printReport(results);

  if (skippedPro > 0) {
    console.log(chalk.dim(`  🔒 ${skippedPro} Pro rule${skippedPro > 1 ? 's' : ''} skipped. Run: expo-ci-doctor login <KEY> to unlock.`));
    console.log('');
  }

  if (info.isMonorepo) {
    console.log(chalk.dim('  📦 Monorepo detected. Run from a workspace root for deeper analysis.'));
    console.log('');
  }

  // Show config info if rules were overridden
  const overrideCount = Object.keys(config.rules).length;
  if (overrideCount > 0) {
    console.log(chalk.dim(`  ⚙  ${overrideCount} rule override${overrideCount > 1 ? 's' : ''} applied from config`));
    console.log('');
  }

  process.exit(code);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
