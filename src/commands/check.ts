import ora from 'ora';
import chalk from 'chalk';
import { getCwd } from '../core/context.js';
import { getLicenseEntitlements } from '../core/license-entitlements.js';
import { loadConfig } from '../core/config.js';
import { detectProject } from '../detectors/project.js';
import { runRules, exitCode } from '../rules/rules.js';
import { printResults, type OutputMode } from '../output/formatter.js';
import { renderMarkdown } from '../output/markdown.js';
import { computeSignalsFromRules, aggregateSignals } from '../analysis/signals.js';
import { computeReadinessScore } from '../analysis/readiness.js';
import { parseUpgradeTarget, generateUpgradeSafetyReport } from '../analysis/upgrade.js';
import { emitGitHubAnnotations } from '../ci/github-actions.js';
import type { RulePack, RuleLevel } from '../core/types.js';

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
  const license = await getLicenseEntitlements();
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
    console.log('');
    console.log(
      chalk.bold('  expo-ci-doctor check') +
      chalk.dim(' · CI / EAS Build diagnostics') +
      (license.canUseProRules ? chalk.green(' PRO') : chalk.dim(' FREE'))
    );
    console.log(chalk.dim(`  ${cwd}`));
  }

  let spinner: ReturnType<typeof ora> | null = null;
  if (!isJson && !isMarkdown) {
    spinner = ora({ text: 'Scanning project…', color: 'cyan', indent: 2 }).start();
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

  const { results, skippedPro } = runRules(info, {
    isPro: license.canUseProRules,
    pack: options.pack as RulePack | undefined,
    ciStrict: options.ciStrict,
    config,
  });
  const code = exitCode(results);

  if (spinner) spinner.stop();

  // ── Upgrade Safety Report (Pro) ─────────────────────────────────
  if (options.upgrade) {
    if (!license.canUseProRules) {
      console.log(chalk.yellow('\n  [PRO FEATURE] --upgrade is a Pro-only feature. Run: expo-ci-doctor login <key>'));
    } else {
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
  }

  // ── Build Readiness Score (Starter + Pro) ─────────────────────────
  const signals = computeSignalsFromRules(results);
  const signalSummary = aggregateSignals(signals);
  const readiness = computeReadinessScore(signalSummary);

  // ── Markdown output ───────────────────────────────────────────────
  if (isMarkdown) {
    const md = renderMarkdown({
      results,
      readiness,
      projectPath: cwd,
      isPro: license.canUseProRules,
    });
    console.log(md);
    process.exit(code);
  }

  // ── JSON output ───────────────────────────────────────────────────
  if (isJson) {
    const out = options.jsonFull
      ? { results, skippedPro, total: results.length, readiness }
      : results.map(r => ({ id: r.id, level: r.level, title: r.title }));
    console.log(JSON.stringify(out, null, 2));
    process.exit(code);
  }

  // ── Standard output ───────────────────────────────────────────────
  printResults(results, {
    mode: outputMode,
    severity: options.severity as RuleLevel | undefined,
    skippedPro,
  });

  // ── Readiness Score ───────────────────────────────────────────────
  if (outputMode === 'default' || outputMode === 'ci') {
    console.log('');
    const riskColor = readiness.risk === 'High' ? chalk.red
      : readiness.risk === 'Medium' ? chalk.yellow : chalk.green;
    console.log(
      `  Build readiness: ${riskColor.bold(String(readiness.score))} / 100` +
      chalk.dim(`  Risk: ${readiness.risk}`)
    );
    if (outputMode === 'default' && readiness.breakdown.length > 0) {
      console.log(chalk.dim(`  ${readiness.summary}`));
    }
    console.log('');
  }

  // ── GitHub Actions annotations ────────────────────────────────────
  emitGitHubAnnotations(results);

  if (!isJson && skippedPro > 0) {
    console.log(chalk.dim(`  🔒 ${skippedPro} Pro rule${skippedPro > 1 ? 's' : ''} skipped. Run: expo-ci-doctor login <KEY> to unlock.`));
    console.log('');
  }

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
