import { printTitle, createSpinner, icons, colors } from '../utils/logger.js';
import { getCwd } from '../utils/context.js';
import { loadConfig } from '../utils/config-loader.js';
import { detectProject } from '../detectors/project.js';
import { runRules } from '../analyzers/index.js';
import { EXIT_CODES, exitWithCode } from '../utils/exit-codes.js';

/**
 * The `preflight` command.
 * Ultra-fast checks for CI-breaking issues. No deep log analysis.
 */
export async function preflightCommand(): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);
  
  printTitle('✈️  expo-ci-doctor preflight');
  
  const spinner = createSpinner('Quick scan…').start();
  
  const info = detectProject(cwd);
  
  if (!info.hasPackageJson) {
    spinner.fail('No package.json found');
    exitWithCode(EXIT_CODES.DEPENDENCY_ISSUE);
  }

  const { results } = runRules(info, {
    ciStrict: true,
    config,
  });

  // Filter only blocking issues
  const errors = results.filter(r => r.level === 'error');
  
  spinner.stop();

  if (errors.length === 0) {
    console.log(colors.success(`\n  ${icons.success} Preflight passing. No CI-breaking issues detected.`));
    exitWithCode(EXIT_CODES.SUCCESS);
  }

  console.log(colors.error(`\n  ${icons.error} Preflight failed. Found ${errors.length} breaking issue(s):`));
  
  for (const err of errors) {
    const where = err.hints?.where || err.filePointer || '';
    console.log(`\n    ${icons.error} ${colors.bold(err.title)}`);
    console.log(`      ${err.details}`);
    if (where) {
      console.log(`      ${colors.dim(`Location: ${where}`)}`);
    }
    if (err.fix) {
      console.log(`      ${colors.success(`Fix: ${err.fix.split('\n').join('\n           ')}`)}`);
    }
  }

  console.log('');
  exitWithCode(EXIT_CODES.CONFIG_ERROR);
}
