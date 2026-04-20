import { printTitle, createSpinner, icons, colors } from '../utils/logger.js';
import { getCwd } from '../utils/context.js';
import { loadConfig } from '../utils/config-loader.js';
import { detectProject } from '../detectors/project.js';
import { runRules } from '../analyzers/index.js';
import { EXIT_CODES, exitWithCode } from '../utils/exit-codes.js';
import { resolveCommandThreshold } from '../utils/severity.js';
import { finalLine, getRuntime, verboseLog } from '../utils/runtime.js';

/**
 * The `preflight` command.
 * Ultra-fast checks for CI-breaking issues. No deep log analysis.
 */
export async function preflightCommand(options: { failOn?: string } = {}): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);
  const runtime = getRuntime();
  
  if (!runtime.silent) printTitle('✈️  expo-ci-doctor preflight');
  
  const spinner = runtime.silent ? null : createSpinner('Quick scan…').start();
  verboseLog(`preflight cwd=${cwd}`);
  
  const info = detectProject(cwd);
  
  if (!info.hasPackageJson) {
    if (spinner) spinner.fail('No package.json found');
    else finalLine('PREFLIGHT FAIL no package.json found');
    exitWithCode(EXIT_CODES.DEPENDENCY_ISSUE);
  }

  const { results } = runRules(info, {
    ciStrict: true,
    config,
  });

  const threshold = resolveCommandThreshold(config, 'preflight', options.failOn);
  const levelRank: Record<'info' | 'warn' | 'error', number> = { info: 0, warn: 1, error: 2 };
  const blockingResults = results.filter((r) => levelRank[r.level] >= levelRank[threshold]);
  verboseLog(`preflight blocking=${blockingResults.length} threshold=${threshold}`);
  
  if (spinner) spinner.stop();

  if (blockingResults.length === 0) {
    if (!runtime.silent) {
      console.log(colors.success(`\n  ${icons.success} Preflight passing. No CI-breaking issues detected.`));
    } else {
      finalLine('PREFLIGHT PASS errors=0');
    }
    exitWithCode(EXIT_CODES.SUCCESS);
  }

  if (!runtime.silent) {
    console.log(colors.error(`\n  ${icons.error} Preflight failed. Found ${blockingResults.length} blocking issue(s):`));
  }
  
  for (const err of blockingResults) {
    if (runtime.silent) continue;
    const where = err.hints?.where || err.filePointer || '';
    console.log(`\n    ${icons.error} ${colors.bold(err.title)}`);
    console.log(`      ${err.details}`);
    if (where) {
      console.log(`      ${colors.dim(`Location: ${where}`)}`);
    }
    if (err.fix) {
      console.log(`      ${colors.success(`Fix: ${err.fix.split('\n').join('\n           ')}`)}`);
      const nextStep = err.fix.split('\n').find((line) => /^(npx|npm|pnpm|yarn)\s+/i.test(line.trim()));
      if (nextStep) {
        console.log(`      ${colors.bold('Next step:')} Run ${nextStep.trim()}`);
      }
    } else {
      console.log(`      ${colors.bold('Next step:')} Run expo-ci-doctor explain ${err.id}`);
    }
  }

  if (!runtime.silent) console.log('');
  else finalLine(`PREFLIGHT FAIL errors=${blockingResults.length}`);
  exitWithCode(EXIT_CODES.CONFIG_ERROR);
}
