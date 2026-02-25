import chalk from 'chalk';
import ora from 'ora';
import { getCwd } from '../core/context.js';
import { requireProFeature } from '../core/license-entitlements.js';
import { loadConfig } from '../core/config.js';
import { detectProject } from '../detectors/project.js';
import { runRules } from '../rules/rules.js';
import { EXIT_CODES, exitWithCode } from '../core/exit-codes.js';

/**
 * The `preflight` command.
 * Ultra-fast checks for CI-breaking issues. No deep log analysis.
 */
export async function preflightCommand(): Promise<void> {
  await requireProFeature('preflight');

  const cwd = getCwd();
  const config = loadConfig(cwd);
  
  // Fast, minimal output
  console.log(chalk.bold('✈️  expo-ci-doctor preflight') + chalk.green(' PRO'));
  
  const spinner = ora({ text: 'Quick scan…', color: 'cyan', indent: 2 }).start();
  
  const info = detectProject(cwd);
  
  if (!info.hasPackageJson) {
    spinner.fail('No package.json found');
    exitWithCode(EXIT_CODES.DEPENDENCY_ISSUE);
  }

  const { results } = runRules(info, {
    isPro: true, // Pro feature is verified above
    ciStrict: true, // Promotes all warnings to errors
    config,
  });

  // Filter only blocking issues
  const errors = results.filter(r => r.level === 'error');
  
  spinner.stop();

  if (errors.length === 0) {
    console.log(chalk.green('\n  ✔ Preflight passing. No CI-breaking issues detected.'));
    exitWithCode(EXIT_CODES.SUCCESS);
  }

  console.log(chalk.red(`\n  ✖ Preflight failed. Found ${errors.length} breaking issue(s):`));
  
  for (const err of errors) {
    const where = err.hints?.where || err.filePointer || '';
    console.log(`\n    ${chalk.red('✖')} ${chalk.bold(err.title)}`);
    console.log(`      ${err.details}`);
    if (where) {
      console.log(`      ${chalk.dim(`Location: ${where}`)}`);
    }
    if (err.fix) {
      console.log(`      ${chalk.green(`Fix: ${err.fix.split('\n').join('\n           ')}`)}`);
    }
  }

  console.log('');
  exitWithCode(EXIT_CODES.CONFIG_ERROR);
}
