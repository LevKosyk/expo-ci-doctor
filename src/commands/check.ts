import * as fs from 'node:fs';
import * as path from 'node:path';
import ora from 'ora';
import chalk from 'chalk';
import { getCwd } from '../utils/context.js';
import { loadConfig } from '../utils/config-loader.js';
import { detectProject } from '../detectors/project.js';
import { runRules, exitCode, ruleCategory } from '../analyzers/index.js';
import { printResults, type OutputMode } from '../reporters/terminal-reporter.js';
import { renderMarkdown } from '../reporters/markdown-reporter.js';
import { computeSignalsFromRules, aggregateSignals } from '../analyzers/signals.js';
import { computeReadinessScore } from '../utils/score-calculator.js';
import { parseUpgradeTarget, generateUpgradeSafetyReport } from '../analyzers/upgrade.js';
import { emitGitHubAnnotations } from '../ci/github-actions.js';
import type { RulePack, RuleLevel } from '../utils/types.js';
import { printTitle, createSpinner, drawBox, icons, colors } from '../utils/logger.js';
import { recordRun } from '../analyzers/history.js';
import { finalLine, getRuntime, verboseLog } from '../utils/runtime.js';
import { sendWebhookNotification } from '../utils/webhook.js';
import { loadProjectTargets } from '../utils/project-scan.js';
import { resolveCommandThreshold, exitCodeForThreshold } from '../utils/severity.js';

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
  summary?: boolean;
  output?: string;
  verbose?: boolean;
  silent?: boolean;
  annotations?: boolean;
  webhook?: string;
  allWorkspaces?: boolean;
  failOn?: string;
} = {}): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);
  const runtime = getRuntime();

  const isJson = options.json || options.jsonFull;
  const isMarkdown = options.format === 'md';
  const isSummary = Boolean(options.summary);
  const isSilent = runtime.silent || Boolean(options.silent);
  const targets = loadProjectTargets(cwd, Boolean(options.allWorkspaces));

  // Determine output mode
  let outputMode: OutputMode = 'default';
  if (options.jsonFull) outputMode = 'json-full';
  else if (options.json) outputMode = 'json';
  else if (options.ciSummary) outputMode = 'ci-summary';
  else if (options.ci) outputMode = 'ci';

  if (!isJson && !isMarkdown && !isSilent) {
    printTitle('expo-ci-doctor check');
    console.log(colors.dim(`  ${cwd}`));
  }

  let spinner = null;
  if (!isJson && !isMarkdown && !isSilent) {
    spinner = createSpinner('Scanning project…').start();
  }

  verboseLog(`cwd=${cwd}`);

  const primaryTarget = targets[0];
  const info = primaryTarget.info;
  verboseLog(`detected packageJson=${info.hasPackageJson}, monorepo=${info.isMonorepo}, workflows=${info.ci.workflows.length}`);

  if (!info.hasPackageJson) {
    if (spinner) spinner.fail('No package.json found — is this a JS/TS project?');
    process.exit(2);
  }

  if (info.isMonorepo && spinner) {
    spinner.text = 'Monorepo detected — scanning root…';
  }

  if (spinner) {
    spinner.text = 'Running rules…';
  }

  const projectRuns = targets.map((target) => {
    const { results } = runRules(target.info, {
      pack: options.pack as RulePack | undefined,
      ciStrict: options.ciStrict,
      config: target.config,
    });
    const threshold = resolveCommandThreshold(target.config, 'check', options.failOn);
    const codeForProject = exitCodeForThreshold(results, threshold);
    return { target, results, threshold, code: codeForProject };
  });

  const results = projectRuns.flatMap(({ target, results: projectResults }) => (
    projectRuns.length > 1
      ? projectResults.map((result) => ({
          ...result,
          title: `[${target.label}] ${result.title}`,
        }))
      : projectResults
  ));
  const code = Math.max(...projectRuns.map((run) => run.code));
  verboseLog(`rules completed: ${results.length} result(s), exitCode=${code}`);

  if (spinner) spinner.stop();

  // ── Upgrade Safety Report ─────────────────────────────────────────
  if (options.upgrade && !isSilent) {
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

  const topError = results.find((r) => r.level === 'error');
  recordRun({
    timestamp: new Date().toISOString(),
    outcome: code === 0 ? 'pass' : 'fail',
    score: readiness.score,
    errorCount: results.filter((r) => r.level === 'error').length,
    warnCount: results.filter((r) => r.level === 'warn').length,
    primaryFailureCategory: topError ? ruleCategory(topError.id) : undefined,
  });

  // ── Markdown output ───────────────────────────────────────────────
  if (isMarkdown) {
    const md = renderMarkdown({
      results,
      readiness,
      projectPath: cwd,
    });
    if (options.output) {
      const outPath = path.resolve(cwd, options.output);
      fs.writeFileSync(outPath, md + '\n', 'utf-8');
      if (!isSilent) console.log(chalk.dim(`  Saved markdown output to ${outPath}`));
      else finalLine(outPath);
    } else {
      console.log(md);
    }
    process.exit(code);
  }

  // ── JSON output ───────────────────────────────────────────────────
  if (isJson) {
    const out = options.jsonFull
      ? { results, total: results.length, readiness }
      : results.map(r => ({ id: r.id, level: r.level, title: r.title }));
    const payload = JSON.stringify(out, null, 2);
    if (options.output) {
      const outPath = path.resolve(cwd, options.output);
      fs.writeFileSync(outPath, payload + '\n', 'utf-8');
      if (!isSilent) console.log(chalk.dim(`  Saved JSON output to ${outPath}`));
      else finalLine(outPath);
    } else {
      console.log(payload);
    }
    process.exit(code);
  }

  if (isSummary) {
    const errors = results.filter((r) => r.level === 'error');
    const warnings = results.filter((r) => r.level === 'warn');
    const top3 = [...errors, ...warnings].slice(0, 3);
    const firstFix = top3.find((r) => r.fix)?.fix?.split('\n')[0] ?? 'Run: expo-ci-doctor explain-error';

    const lines = [
      `Score: ${readiness.score}/100 (${readiness.risk})`,
      `Errors: ${errors.length}  Warnings: ${warnings.length}`,
      'Top issues:',
      ...top3.map((r, i) => `  ${i + 1}. [${r.level}] ${r.title}`),
      `Recommended first fix: ${firstFix}`,
    ];
    const summaryText = lines.join('\n');

    if (options.output) {
      const outPath = path.resolve(cwd, options.output);
      fs.writeFileSync(outPath, summaryText + '\n', 'utf-8');
      if (!isSilent) console.log(chalk.dim(`  Saved summary output to ${outPath}`));
      else finalLine(outPath);
    }

    if (isSilent) {
      finalLine(`CHECK ${code === 0 ? 'PASS' : 'FAIL'} score=${readiness.score} errors=${errors.length} warns=${warnings.length}`);
    } else {
      console.log('');
      console.log(chalk.bold('  Summary'));
      console.log(chalk.dim('  ─────────────────────────'));
      for (const line of lines) {
        console.log(`  ${line}`);
      }
      console.log('');
    }
    process.exit(code);
  }

  // ── Standard output ───────────────────────────────────────────────
  if (!isSilent) {
    printResults(results, {
      mode: outputMode,
      severity: options.severity as RuleLevel | undefined,
    });
  }

  // ── Readiness Score ───────────────────────────────────────────────
  if (!isSilent && (outputMode === 'default' || outputMode === 'ci')) {
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
  if (options.annotations || process.env.GITHUB_ACTIONS === 'true') {
    emitGitHubAnnotations(results, true);
  }

  if (options.webhook) {
    const topIssues = results.slice(0, 5).map((r) => ({ title: r.title, level: r.level, id: r.id }));
    await sendWebhookNotification(options.webhook, {
      title: 'expo-ci-doctor check result',
      text: `Check ${code === 0 ? 'passed' : 'failed'} with score ${readiness.score}/100 (${readiness.risk}). Errors: ${results.filter((r) => r.level === 'error').length}, warnings: ${results.filter((r) => r.level === 'warn').length}.`,
      severity: code === 0 ? 'info' : 'error',
      source: cwd,
      score: readiness.score,
      issues: topIssues,
    });
  }

  if (!isJson && info.isMonorepo) {
    if (!isSilent) {
    console.log(chalk.dim('  📦 Monorepo detected. Run from a workspace root for deeper analysis.'));
    console.log('');
    }
  }

  if (!isJson && !isSilent) {
    const overrideCount = Object.keys(config.rules).length;
    if (overrideCount > 0) {
      console.log(chalk.dim(`  ⚙  ${overrideCount} rule override${overrideCount > 1 ? 's' : ''} applied from config`));
      console.log('');
    }
  }

  if (isSilent) {
    const errors = results.filter((r) => r.level === 'error').length;
    const warns = results.filter((r) => r.level === 'warn').length;
    finalLine(`CHECK ${code === 0 ? 'PASS' : 'FAIL'} score=${readiness.score} errors=${errors} warns=${warns}`);
  }

  process.exit(code);
}
