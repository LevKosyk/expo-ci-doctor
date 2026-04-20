import chalk from 'chalk';
import { getCwd } from '../utils/context.js';
import { loadProjectTargets } from '../utils/project-scan.js';
import { runRules } from '../analyzers/index.js';
import { computeSignalsFromRules, aggregateSignals } from '../analyzers/signals.js';
import { computeReadinessScore } from '../utils/score-calculator.js';
import { createTable, printTitle, icons, colors } from '../utils/logger.js';

export async function dashboardCommand(): Promise<void> {
  const cwd = getCwd();
  const targets = loadProjectTargets(cwd, true);

  printTitle('expo-ci-doctor dashboard');

  const table = createTable(['Workspace', 'Score', 'Risk', 'Errors', 'Warnings', 'Expo', 'RN', 'PM', 'Lockfiles', 'CI']);
  const summaries = targets.map((target) => {
    const { results } = runRules(target.info, { config: target.config });
    const signals = computeSignalsFromRules(results);
    const readiness = computeReadinessScore(aggregateSignals(signals));
    const errors = results.filter((result) => result.level === 'error').length;
    const warnings = results.filter((result) => result.level === 'warn').length;

    table.push([
      target.label,
      `${readiness.score}`,
      readiness.risk,
      `${errors}`,
      `${warnings}`,
      target.info.expoVersion ?? 'missing',
      target.info.reactNativeVersion ?? 'missing',
      target.info.deps.packageManager,
      target.info.deps.lockfiles.length > 0 ? target.info.deps.lockfiles.join(', ') : 'none',
      target.info.ci.hasWorkflow ? 'yes' : 'no',
    ]);

    return {
      label: target.label,
      errors,
      warnings,
      readiness,
      results,
    };
  });

  console.log(colors.dim(`  Workspace scan: ${summaries.length} target(s)`));
  console.log('');
  console.log(table.toString());
  console.log('');

  const blockers = summaries.flatMap((summary) => summary.results.filter((result) => result.level === 'error').slice(0, 2));
  if (blockers.length > 0) {
    console.log(chalk.bold('  Top blockers'));
    console.log(chalk.dim('  ─────────────────────────'));
    for (const blocker of blockers.slice(0, 5)) {
      console.log(`  ${icons.error} ${blocker.title}`);
      console.log(`    ${chalk.dim(blocker.details)}`);
    }
    console.log('');
  }

  const worstExit = summaries.some((summary) => summary.errors > 0) ? 2
    : summaries.some((summary) => summary.warnings > 0) ? 1
    : 0;

  if (worstExit === 0) {
    console.log(colors.success(`  ${icons.success} All scanned workspaces are healthy.`));
  }

  process.exit(worstExit);
}