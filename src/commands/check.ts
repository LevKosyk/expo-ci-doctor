import ora from 'ora';
import chalk from 'chalk';
import { getCwd } from '../utils/context.js';
import { loadConfig } from '../utils/config-loader.js';
import { detectProject } from '../detectors/project.js';
import { runRules, exitCode } from '../analyzers/index.js';
import { printResults, type OutputMode } from '../reporters/terminal-reporter.js';
import { renderMarkdown } from '../reporters/markdown-reporter.js';
import { computeSignalsFromRules, aggregateSignals } from '../analyzers/signals.js';
import { computeReadinessScore } from '../utils/score-calculator.js';
import { parseUpgradeTarget, generateUpgradeSafetyReport } from '../analyzers/upgrade.js';
import { emitGitHubAnnotations } from '../ci/github-actions.js';
import type { RulePack, RuleLevel } from '../utils/types.js';
import { printTitle, createSpinner, drawBox, icons, colors } from '../utils/logger.js';

/**
 * The `check` command.
 * Scans the current directory, runs all rules, prints the report.
 */
export async function checkCommand(options: {
  ciStrict?: boolean;
  pack?: string;
  ci?: boolean;
  ciSummary?: boolean;
  json?: boolean;
  jsonFull?: boolean;
  severity?: string;
  format?: string;
  upgrade?: string;
} = {}): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);

  const isJson = options.json || options.jsonFull;
  const isMarkdown = options.format === 'md';

  // Determine output mode
  let outputMode: OutputMode = 'default';
  if (options.jsonFull) outputMode = 'json-full';
  else if (options.json) outputMode = 'json';
  else if (options.ciSummary) outputMode = 'ci-summary';
  else if (options.ci) outputMode = 'ci';

  if (!isJson && !isMarkdown) {
    printTitle('expo-ci-doctor check');
    console.log(colors.dim(`  ${cwd}`));
  }

  let spinner = null;
  if (!isJson && !isMarkdown) {
    spinner = createSpinner('Scanning project…').start();
    await delay(300);
  }

  const info = detectProject(cwd);

  if (!info.hasPackageJson) {
    if (spinner) spinner.fail('No package.json found — is this a JS/TS project?');
    process.exit(2);
  }

  if (info.isMonorepo && spinner) {
    spinner.text = 'Monorepo detected — scanning root…';
    await delay(150);
  }

  if (spinner) {
    spinner.text = 'Running rules…';
    await delay(200);
  }

  const { results } = runRules(info, {
    pack: options.pack as RulePack | undefined,
    ciStrict: options.ciStrict,
    config,
  });
  const code = exitCode(results);

  if (spinner) spinner.stop();

  // ── Upgrade Safety Report ─────────────────────────────────────────
  if (options.upgrade) {
    const target = parseUpgradeTarget(options.upgrade, {
      ...info.dependencies,
      ...info.devDependencies,
    });
    const report = generateUpgradeSafetyReport(target, {
      ...info.dependencies,
      ...info.devDependencies,
    }, info.enginesNode);

    const from = target.fromVersion ?? 'unknown';
    const to   = target.toVersion;
    console.log('');
    console.log(chalk.bold(`  Upgrade safety report: ${target.package} ${from} → ${to}`));
    console.log(chalk.dim('  ────────────────────────────────────────────'));

      if (report.safe.length > 0) {
        console.log(chalk.green('\n  Safe:'));
        for (const i of report.safe) {
          console.log(`    ${chalk.green('✔')} ${i.item}`);
          console.log(`      ${chalk.dim(i.reason)}`);
        }
      }
      if (report.risky.length > 0) {
        console.log(chalk.yellow('\n  Risky:'));
        for (const i of report.risky) {
          console.log(`    ${chalk.yellow('⚠')} ${i.item}`);
          console.log(`      ${chalk.dim(i.reason)}`);
        }
      }
      if (report.breaking.length > 0) {
        console.log(chalk.red('\n  Breaking:'));
        for (const i of report.breaking) {
          console.log(`    ${chalk.red('✖')} ${i.item}`);
          console.log(`      ${chalk.dim(i.reason)}`);
        }
      }

      console.log('');
      const summaryColor = report.breaking.length > 0 ? chalk.red
        : report.risky.length > 0 ? chalk.yellow : chalk.green;
      console.log(summaryColor(`  ${report.summary}`));
      console.log('');
  }

  // ── Build Readiness Score ─────────────────────────────────────────
  const signals = computeSignalsFromRules(results);
  const signalSummary = aggregateSignals(signals);
  const readiness = computeReadinessScore(signalSummary);

  // ── Markdown output ───────────────────────────────────────────────
  if (isMarkdown) {
    const md = renderMarkdown({
      results,
      readiness,
      projectPath: cwd,
    });
    console.log(md);
    process.exit(code);
  }

  // ── JSON output ───────────────────────────────────────────────────
  if (isJson) {
    const out = options.jsonFull
      ? { results, total: results.length, readiness }
      : results.map(r => ({ id: r.id, level: r.level, title: r.title }));
    console.log(JSON.stringify(out, null, 2));
    process.exit(code);
  }

  // ── Standard output ───────────────────────────────────────────────
  printResults(results, {
    mode: outputMode,
    severity: options.severity as RuleLevel | undefined,
  });

  // ── Readiness Score ───────────────────────────────────────────────
  if (outputMode === 'default' || outputMode === 'ci') {
    const riskColor = readiness.risk === 'High' ? colors.error
      : readiness.risk === 'Medium' ? colors.warning : colors.success;
      
    const scoreColor = (score: number) => 
      score >= 80 ? colors.success(score) : 
      score >= 50 ? colors.warning(score) : 
      colors.error(score);
      
    if (outputMode === 'default') {
      let content = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      const detailsCount = readiness.breakdown.length;
      if (detailsCount > 0) {
        readiness.breakdown.forEach(b => {
           content += ` ${b}\n`;
        });
        content += `\n`;
      }
      
      content += ` Score: ${scoreColor(readiness.score)} / 100\n`;
      content += ` Risk:  ${riskColor(readiness.risk)}\n`;
      content += `\n ${colors.dim(readiness.summary)}`;
      
      const boxStyle = readiness.risk === 'High' ? 'error' : readiness.risk === 'Medium' ? 'warning' : 'success';
      console.log('\n' + drawBox('Project Health Score', content, boxStyle));
    } else {
      console.log(`\n  Project Health Score: ${readiness.score}/100 (Risk: ${readiness.risk})\n`);
    }
  }

  // ── GitHub Actions annotations ────────────────────────────────────
  emitGitHubAnnotations(results);

  if (!isJson && info.isMonorepo) {
    console.log(chalk.dim('  📦 Monorepo detected. Run from a workspace root for deeper analysis.'));
    console.log('');
  }

  if (!isJson) {
    const overrideCount = Object.keys(config.rules).length;
    if (overrideCount > 0) {
      console.log(chalk.dim(`  ⚙  ${overrideCount} rule override${overrideCount > 1 ? 's' : ''} applied from config`));
      console.log('');
    }
  }

  process.exit(code);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
