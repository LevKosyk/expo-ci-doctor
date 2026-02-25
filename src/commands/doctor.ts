import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';
import { getCwd } from '../core/context.js';
import { getLicenseEntitlements } from '../core/license-entitlements.js';
import { loadConfig } from '../core/config.js';
import { detectProject } from '../detectors/project.js';
import { runRules, exitCode } from '../rules/rules.js';
import { matchPatterns } from '../analyzers/matcher.js';
import { printReport } from '../report/print.js';
import { EXIT_CODES, exitWithCode } from '../core/exit-codes.js';
import { computeSignalsFromRules, aggregateSignals } from '../analysis/signals.js';
import { computeReadinessScore } from '../analysis/readiness.js';
import { recordRun, computeTrend } from '../analysis/history.js';

// ─── Verdict scoring ────────────────────────────────────────────────

interface VerdictInfo {
  label: string;
  code: number;
  reasons: string[];
}

function computeVerdict(
  checkErrors: number,
  checkWarns: number,
  logErrors: number,
  logWarns: number,
  skippedPro: number,
): VerdictInfo {
  const reasons: string[] = [];
  const totalErrors = checkErrors + logErrors;
  const totalWarns = checkWarns + logWarns;

  if (totalErrors === 0 && totalWarns === 0) {
    if (skippedPro > 0) {
      reasons.push(`${skippedPro} Pro rules were skipped — unlock for deeper analysis`);
      return { label: 'SAFE', code: 0, reasons };
    }
    reasons.push('All rules passed, no issues in logs');
    return { label: 'SAFE', code: 0, reasons };
  }

  // Weighted scoring
  let score = 0;
  score += totalErrors * 10;
  score += totalWarns * 3;

  if (checkErrors > 0) reasons.push(`${checkErrors} config error${checkErrors > 1 ? 's' : ''} will block the build`);
  if (logErrors > 0)   reasons.push(`${logErrors} known failure pattern${logErrors > 1 ? 's' : ''} found in logs`);
  if (checkWarns > 0)  reasons.push(`${checkWarns} warning${checkWarns > 1 ? 's' : ''} may cause intermittent failures`);
  if (logWarns > 0)    reasons.push(`${logWarns} possible issue${logWarns > 1 ? 's' : ''} in logs`);

  if (score >= 10) return { label: 'WILL FAIL', code: 2, reasons };
  return { label: 'RISKY', code: 1, reasons };
}

/**
 * The `doctor` command.
 * Runs check + auto-discovers and analyzes logs → final verdict.
 */
export async function doctorCommand(options: {
  copy?: boolean;
  openDocs?: boolean;
  [key: string]: any;
} = {}): Promise<void> {
  const cwd = getCwd();
  const license = await getLicenseEntitlements();
  const isPro = license.canUseDoctor;

  console.log('');
  console.log(
    chalk.bold('  expo-ci-doctor doctor') +
    chalk.dim(' · Full diagnostic') +
    (isPro ? chalk.green(' PRO') : chalk.dim(' FREE'))
  );
  console.log(chalk.dim(`  ${cwd}`));

  // ── Phase 1: Check ──────────────────────────────────────────────
  const spinner = ora({ text: 'Phase 1: Scanning project…', color: 'cyan', indent: 2 }).start();
  await delay(300);

  const info = detectProject(cwd);

  if (!info.hasPackageJson) {
    spinner.fail('No package.json found — is this a JS/TS project?');
    process.exit(2);
  }

  spinner.text = 'Phase 1: Running rules…';
  await delay(200);

  const config = loadConfig(cwd);

  const { results: checkResults, skippedPro } = runRules(info, { isPro, config });
  const checkErrors = checkResults.filter((r) => r.level === 'error').length;
  const checkWarns = checkResults.filter((r) => r.level === 'warn').length;

  spinner.succeed(`Phase 1: ${checkResults.length} issue${checkResults.length !== 1 ? 's' : ''} found`);

  // ── Phase 2: Log analysis (Pro) ─────────────────────────────────
  let logErrors = 0;
  let logWarns = 0;
  let logTotal = 0;

  if (isPro) {
    spinner.start('Phase 2: Searching for build logs…');
    await delay(200);

    const logCandidates = [
      'build.log', 'eas-build.log', 'ci.log',
      'android-build.log', 'ios-build.log',
      'output.log', 'build-output.log',
    ];

    for (const name of logCandidates) {
      const logPath = `${cwd}/${name}`;
      if (fs.existsSync(logPath)) {
        const raw = fs.readFileSync(logPath, 'utf-8');
        const matches = matchPatterns(raw);
        logErrors += matches.filter((m) => m.level === 'error').length;
        logWarns += matches.filter((m) => m.level === 'warn').length;
        logTotal += matches.length;
        spinner.text = `Phase 2: Analyzed ${name} (${matches.length} issues)`;
      }
    }

    if (logTotal > 0) {
      spinner.succeed(`Phase 2: ${logTotal} issue${logTotal !== 1 ? 's' : ''} in logs`);
    } else {
      spinner.succeed('Phase 2: No build logs found');
    }
  }

  // ── Report ─────────────────────────────────────────────────────
  console.log('');

  printReport(checkResults);

  // ── Readiness Score ─────────────────────────────────────────────
  const signals = computeSignalsFromRules(checkResults);
  const signalSummary = aggregateSignals(signals);
  const readiness = computeReadinessScore(signalSummary);
  const riskColor = readiness.risk === 'High' ? chalk.red
    : readiness.risk === 'Medium' ? chalk.yellow : chalk.green;
  console.log('');
  console.log(
    `  Build readiness: ${riskColor.bold(String(readiness.score))} / 100` +
    chalk.dim(`  Risk: ${readiness.risk}`)
  );
  console.log(chalk.dim(`  ${readiness.summary}`));
  console.log('');

  if (skippedPro > 0) {
    console.log(chalk.dim(`  🔒 ${skippedPro} Pro rules skipped — unlock for deeper analysis`));
    console.log('');
  }

  // ── Verdict ────────────────────────────────────────────────────
  const verdict = computeVerdict(checkErrors, checkWarns, logErrors, logWarns, skippedPro);

  console.log(chalk.dim('  ═══════════════════════════════════'));
  console.log('');

  if (verdict.label === 'WILL FAIL') {
    console.log(`  ${chalk.red.bold('  🚨 VERDICT: WILL FAIL')}`);
  } else if (verdict.label === 'RISKY') {
    console.log(`  ${chalk.yellow.bold('  ⚡ VERDICT: RISKY')}`);
  } else {
    console.log(`  ${chalk.green.bold('  ✔  VERDICT: SAFE')}`);
  }

  console.log('');

  for (const reason of verdict.reasons) {
    const bullet = verdict.label === 'SAFE' ? chalk.green('  ✓') : chalk.dim('  →');
    console.log(`  ${bullet} ${chalk.dim(reason)}`);
  }

  console.log('');

  if (verdict.label === 'WILL FAIL') {
    console.log(chalk.red('  Fix all ERROR items before pushing to CI.'));
  } else if (verdict.label === 'RISKY') {
    console.log(chalk.yellow('  Review WARN items to reduce CI failure risk.'));
  } else {
    console.log(chalk.green('  Project is ready for CI. Happy building!'));
  }

  // ── Record run in history (Pro) ──────────────────────────────────
  if (isPro) {
    try {
      recordRun({
        timestamp: new Date().toISOString(),
        outcome: verdict.code === 0 ? 'pass' : 'fail',
        score: readiness.score,
        errorCount: checkErrors,
        warnCount: checkWarns,
        primaryFailureCategory: checkResults.find(r => r.level === 'error')?.id,
      });
    } catch { /* non-critical */ }

    // ── Stability Trend ────────────────────────────────────────────
    const trend = computeTrend();
    if (trend.entries.length >= 2) {
      const arrow = trend.direction === 'Improving' ? '↑'
        : trend.direction === 'Degrading' ? '↓' : '→';
      const trendColor = trend.direction === 'Improving' ? chalk.green
        : trend.direction === 'Degrading' ? chalk.red : chalk.dim;
      console.log('');
      console.log(`  CI stability trend: ${trendColor.bold(`${trend.direction} ${arrow}`)}`);
      if (trend.recentSymbols.length > 0) {
        const colored = trend.recentSymbols.map(s =>
          s === '✔' ? chalk.green(s) : chalk.red(s)
        ).join('  ');
        console.log(`  Last ${trend.recentSymbols.length} runs: ${colored}`);
      }
    }
  }

  console.log('');
  
  // ── Provide Fix Recipes for top error ────────────────────────────
  const topError = checkResults.find((r) => r.level === 'error');
  if (topError) {
    console.log(chalk.bold('  🛠  Top Priority Fix Recipe'));
    console.log(chalk.dim('  ───────────────────────────────────'));
    console.log(`  ${chalk.red('✖')} ${chalk.bold(topError.title)}`);
    console.log(`  ${chalk.dim('Details:')} ${topError.details}`);
    if (topError.fix) {
      console.log(`\n  ${chalk.green('Step-by-step fix:')}`);
      const fixSteps = topError.fix.split('\n');
      fixSteps.forEach((step, idx) => {
        console.log(`    ${chalk.green(idx + 1 + '.')} ${chalk.white(step.trim())}`);
      });
      console.log('');
      
      const snippetToCopy = typeof topError.fix === 'string' ? topError.fix : '';
      
      if (options.copy && isPro && snippetToCopy) {
        try {
          execSync(`echo "${snippetToCopy.replace(/"/g, '\\"')}" | pbcopy`);
          console.log(chalk.blue('  📋 Fix snippet copied to clipboard!'));
        } catch (e) {
          console.log(chalk.yellow('  ⚠️  Could not copy to clipboard.'));
        }
      } else if (!isPro && options.copy) {
        console.log(chalk.yellow('  🔒 --copy is a Pro feature. Run: expo-ci-doctor login <KEY>'));
      }
      
      if (options.openDocs && isPro) {
        try {
          execSync(`open https://docs.expo.dev/`);
          console.log(chalk.blue('  🌐 Opened Expo documentation.'));
        } catch (e) {
          console.log(chalk.yellow('  ⚠️  Could not open docs.'));
        }
      } else if (!isPro && options.openDocs) {
        console.log(chalk.yellow('  🔒 --open-docs is a Pro feature. Run: expo-ci-doctor login <KEY>'));
      }
    }
    console.log('');
  }

  process.exit(verdict.code);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
