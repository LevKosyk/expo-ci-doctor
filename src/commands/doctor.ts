import chalk from 'chalk';
import inquirer from 'inquirer';
import { getCwd } from '../utils/context.js';
import { loadConfig } from '../utils/config-loader.js';
import { detectProject } from '../detectors/project.js';
import { runRules, exitCode as getExitCode, ruleCategory } from '../analyzers/index.js';
import { printTitle, icons, colors } from '../utils/logger.js';
import { computeSignalsFromRules, aggregateSignals } from '../analyzers/signals.js';
import { computeReadinessScore } from '../utils/score-calculator.js';
import type { RuleResult } from '../utils/types.js';
import { fixCommand } from './fix.js';
import { finalLine, getRuntime, verboseLog } from '../utils/runtime.js';
import { resolveCommandThreshold } from '../utils/severity.js';

export async function doctorCommand(options: { fix?: boolean; failOn?: string } = {}): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);
  const runtime = getRuntime();
  
  if (!runtime.silent) {
    printTitle('Expo CI Doctor');
    console.log(colors.dim(`  ${cwd}\n`));
    console.log('Running project audit...\n');
  }

  verboseLog(`doctor cwd=${cwd}`);

  const info = detectProject(cwd);

  if (!info.hasPackageJson) {
    if (!runtime.silent) console.log(colors.error('  ✖ No package.json found.'));
    else finalLine('DOCTOR FAIL no package.json found');
    process.exit(2);
  }

  const { results } = runRules(info, { config });
  verboseLog(`doctor results=${results.length}`);
  
  // Categorize for the check summary
  const checks = [
    { name: 'Expo SDK compatibility', types: ['Expo'] },
    { name: 'Dependency alignment', types: ['Dependencies'] },
    { name: 'Native modules', types: ['Native'] },
    { name: 'Expo plugins', types: ['Plugins'] },
    { name: 'app.json / app.config', types: ['Config'] },
    { name: 'EAS config', types: ['EAS'] },
    { name: 'Metro config', types: ['Metro'] },
    { name: 'CI readiness', types: ['CI'] },
  ];

  for (const check of checks) {
    const relevantResults = results.filter(r => check.types.includes(ruleCategory(r.id)));
    
    // Check if error, then warn. Otherwise pass. Note: if no rules exist for a category (e.g. Metro), it defaults to Pass.
    const hasError = relevantResults.some(r => r.level === 'error');
    const hasWarn = relevantResults.some(r => r.level === 'warn');
    
    if (!runtime.silent) {
      if (hasError) console.log(`  ${icons.error} ${check.name} mismatch`);
      else if (hasWarn) console.log(`  ${icons.warning} ${check.name} issues`);
      else console.log(`  ${icons.success} ${check.name}`);
    }
  }

  if (!runtime.silent) console.log('\n━━━━━━━━━━━━━━━━━━━━━━\n');

  const errors = results.filter(r => r.level === 'error');
  const warnings = results.filter(r => r.level === 'warn');

  if (!runtime.silent) {
    console.log(`Issues detected: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log('');
  }

  const signals = computeSignalsFromRules(results);
  const signalSummary = aggregateSignals(signals);
  const readiness = computeReadinessScore(signalSummary);

  if (!runtime.silent) {
    console.log(`Health Score: ${readiness.score} / 100`);
    console.log(`Risk Level: ${readiness.risk}`);
    console.log('');
  }

  if (!runtime.silent && (errors.length > 0 || warnings.length > 0)) {
    console.log('Suggested fixes:\n');
    let fixCounter = 1;
    for (const r of [...errors, ...warnings]) {
      if (r.fix) {
        // use only the first line of the fix suggestion to keep it concise like the example
        const shortFix = typeof r.fix === 'string' ? r.fix.split('\n')[0] : r.fix;
        console.log(`  ${fixCounter}) ${shortFix}`);
        fixCounter++;
      } else {
        console.log(`  ${fixCounter}) Review ${r.title}`);
        fixCounter++;
      }
    }
    console.log('');
  }

  if (runtime.silent) {
    finalLine(`DOCTOR ${errors.length === 0 ? 'PASS' : 'FAIL'} score=${readiness.score} errors=${errors.length} warns=${warnings.length}`);
  }

  if (options.fix) {
    const { applyFixes } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'applyFixes',
        message: 'Apply automatic fixes?',
        default: true
      }
    ]);

    if (applyFixes) {
      console.log('');
      // We leverage the existing fixCommand logic which parses configs and runs shell commands
      await fixCommand();
      return; 
    }
  }

  process.exit(getExitCode(results, resolveCommandThreshold(config, 'doctor', options.failOn)));
}
