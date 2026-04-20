import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCwd } from '../utils/context.js';
import { loadConfig } from '../utils/config-loader.js';
import { detectProject } from '../detectors/project.js';
import { runRules } from '../analyzers/index.js';
import { renderMarkdown } from '../reporters/markdown-reporter.js';
import { computeSignalsFromRules, aggregateSignals } from '../analyzers/signals.js';
import { computeReadinessScore } from '../utils/score-calculator.js';
import { printTitle, createSpinner, icons, colors } from '../utils/logger.js';
import { recordRun } from '../analyzers/history.js';
import { ruleCategory } from '../analyzers/index.js';

export async function reportCommand(): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);
  
  printTitle('expo-ci-doctor report');
  const spinner = createSpinner('Scanning project and generating report...').start();

  const info = detectProject(cwd);

  if (!info.hasPackageJson) {
    spinner.fail('No package.json found');
    process.exit(2);
  }

  const { results } = runRules(info, { config });
  
  const signals = computeSignalsFromRules(results);
  const signalSummary = aggregateSignals(signals);
  const readiness = computeReadinessScore(signalSummary);
  const topError = results.find((r) => r.level === 'error');

  recordRun({
    timestamp: new Date().toISOString(),
    outcome: results.some((r) => r.level === 'error') ? 'fail' : 'pass',
    score: readiness.score,
    errorCount: results.filter((r) => r.level === 'error').length,
    warnCount: results.filter((r) => r.level === 'warn').length,
    primaryFailureCategory: topError ? ruleCategory(topError.id) : undefined,
  }, cwd);

  const md = renderMarkdown({
    results,
    readiness,
    projectPath: cwd,
  });

  const outputPath = path.join(cwd, 'expo-ci-report.md');
  
  try {
    fs.writeFileSync(outputPath, md, 'utf-8');
    spinner.succeed(`Report generated successfully!`);
    console.log(`\n  ${icons.success} Saved to: ${colors.bold(outputPath)}\n`);
  } catch (err: any) {
    spinner.fail(`Failed to write report: ${err.message}`);
    process.exit(1);
  }
}
