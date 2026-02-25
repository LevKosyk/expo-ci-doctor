import * as fs from 'node:fs';
import chalk from 'chalk';
import ora from 'ora';
import { getLicenseEntitlements } from '../core/license-entitlements.js';
import { matchPatterns, type MatchResult } from '../analyzers/matcher.js';
import { filterByNoise, noiseFilterNote, type NoiseMode } from '../analysis/noise.js';
import { computeSignalsFromMatches, computeSignalsFromRules, aggregateSignals } from '../analysis/signals.js';
import { computeReadinessScore } from '../analysis/readiness.js';
import { predictFailure } from '../analysis/prediction.js';
import { renderMarkdown } from '../output/markdown.js';

const CONF_LABEL = {
  high:     chalk.red('●'),
  likely:   chalk.yellow('◐'),
  possible: chalk.dim('○'),
} as const;

const CONF_TEXT = {
  high:     chalk.red.bold('High confidence'),
  likely:   chalk.yellow('Likely cause'),
  possible: chalk.dim('Possible cause'),
} as const;

const STAGE_ICON: Record<string, string> = {
  'Auth':              '🔑',
  'Install':           '📦',
  'Prebuild':          '⚙️',
  'iOS':               '🍎',
  'Android':           '🤖',
  'Metro / JS':        '📜',
  'CI / Environment':  '💻',
};

const STAGE_ORDER = ['Auth', 'CI / Environment', 'Install', 'Prebuild', 'iOS', 'Android', 'Metro / JS'];

/**
 * The `analyze` command.
 * Reads a build log, matches known error patterns, prints a human report.
 * Pro: adds failure prediction, noise filtering, readiness score.
 */
export async function analyzeCommand(logFile: string, options: {
  noise?: string;
  format?: string;
} = {}): Promise<void> {
  const license = await getLicenseEntitlements();

  // ── Pro gate ──────────────────────────────────────────────────────
  if (!license.canUseAnalyze) {
    console.log('');
    console.log(chalk.yellow('  [PRO FEATURE] Log analysis requires a Pro or Starter license.'));
    console.log(chalk.dim('     Run: expo-ci-doctor login <KEY> to unlock.'));
    console.log(chalk.dim('     Or set EXPO_CI_DOCTOR_KEY in CI.'));
    console.log('');
    process.exit(1);
  }

  // ── Validate file ─────────────────────────────────────────────────
  if (!fs.existsSync(logFile)) {
    console.error(chalk.red(`\n  ✖  File not found: ${logFile}\n`));
    process.exit(2);
  }

  const isMarkdown = options.format === 'md';
  const noiseMode = (options.noise ?? 'full') as NoiseMode;

  if (!isMarkdown) {
    console.log('');
    console.log(
      chalk.bold('  expo-ci-doctor analyze') +
      chalk.dim(' · Build failure analysis') +
      chalk.green(license.canUseProRules ? ' PRO' : ' STARTER')
    );
    console.log(chalk.dim(`  Log: ${logFile}`));
    if (noiseMode !== 'full') {
      console.log(chalk.dim(`  Noise filter: ${noiseMode}`));
    }
  }

  const spinner = ora({ text: 'Scanning log…', color: 'cyan', indent: 2 }).start();
  await delay(300);

  const raw = fs.readFileSync(logFile, 'utf-8');
  const lineCount = raw.split('\n').length;

  spinner.text = `Matching ${lineCount} lines against known patterns…`;
  await delay(200);

  const allResults = matchPatterns(raw);

  // ── Noise filter (Pro) ────────────────────────────────────────────
  let displayResults: MatchResult[];
  if (license.canUseProRules && noiseMode !== 'full') {
    displayResults = filterByNoise(allResults, noiseMode);
  } else {
    displayResults = allResults;
    if (noiseMode !== 'full' && !license.canUseProRules) {
      console.log(chalk.yellow('\n  [PRO FEATURE] --noise filtering requires Pro. Showing all results.'));
    }
  }

  spinner.stop();

  // ── Signals and Scoring ───────────────────────────────────────────
  const matchSignals = computeSignalsFromMatches(allResults);
  const signalSummary = aggregateSignals(matchSignals);
  const readiness = computeReadinessScore(signalSummary);

  // ── Failure prediction (Pro) ──────────────────────────────────────
  const prediction = license.canUseProRules ? predictFailure(signalSummary) : null;

  // ── Markdown output ───────────────────────────────────────────────
  if (isMarkdown) {
    // Convert MatchResult to RuleResult format for markdown renderer
    const asRuleResults = displayResults.map(m => ({
      id: m.id,
      level: m.level,
      title: m.title,
      details: m.explanation,
      fix: m.fix,
    }));
    const md = renderMarkdown({
      results: asRuleResults,
      readiness,
      prediction: prediction ?? undefined,
      isPro: license.canUseProRules,
    });
    console.log(md);
    process.exit(displayResults.some(r => r.level === 'error') ? 2 : displayResults.length > 0 ? 1 : 0);
  }

  console.log(chalk.dim(`  ${lineCount} lines · ${allResults.length} pattern${allResults.length !== 1 ? 's' : ''} matched`));

  // ── Noise filter note ─────────────────────────────────────────────
  const filterNote = noiseFilterNote(noiseMode, allResults.length, displayResults.length);
  if (filterNote) console.log(chalk.dim(`  ${filterNote}`));

  // ── Readiness Score ───────────────────────────────────────────────
  const riskColor = readiness.risk === 'High' ? chalk.red
    : readiness.risk === 'Medium' ? chalk.yellow : chalk.green;
  console.log(`\n  Build readiness: ${riskColor.bold(String(readiness.score))} / 100  ${chalk.dim(`Risk: ${readiness.risk}`)}`);
  console.log(chalk.dim(`  ${readiness.summary}`));

  // ── Failure prediction (Pro) ──────────────────────────────────────
  if (prediction && prediction.confidence > 5) {
    console.log('');
    const predColor = prediction.likelihood === 'High' ? chalk.red
      : prediction.likelihood === 'Medium' ? chalk.yellow : chalk.green;
    console.log(chalk.bold('  Failure prediction:'));
    console.log(`  Confidence: ${predColor.bold(`${prediction.confidence}%`)}  Likelihood: ${predColor(prediction.likelihood)}`);
    if (prediction.primarySignals.length > 0) {
      console.log(chalk.dim('  Primary signals:'));
      for (const sig of prediction.primarySignals) {
        console.log(chalk.dim(`    • ${sig}`));
      }
    }
    console.log(chalk.dim(`  ${prediction.explanation}`));
    console.log(chalk.dim('  Note: this is a heuristic estimate, not a guarantee.'));
  } else if (!license.canUseProRules) {
    console.log(chalk.dim('\n  [PRO] Failure prediction available with a Pro license.'));
  }

  // ── No matches ─────────────────────────────────────────────────────
  if (displayResults.length === 0) {
    console.log(chalk.green('\n  No known Expo/EAS failure patterns detected.'));
    console.log(chalk.dim('  If the build still fails, the error may be project-specific.'));
    console.log('');
    process.exit(0);
  }

  // ── Root-cause indicator ────────────────────────────────────────────
  const rootCause = displayResults[0];
  console.log('');
  console.log(chalk.red.bold('  Most likely root cause:'));
  console.log(chalk.red(`     ${rootCause.title}`));
  console.log('');

  // ── Group by stage ─────────────────────────────────────────────────
  const groups = new Map<string, MatchResult[]>();
  for (const r of displayResults) {
    if (!groups.has(r.stage)) groups.set(r.stage, []);
    groups.get(r.stage)!.push(r);
  }

  const orderedStages = STAGE_ORDER.filter((s) => groups.has(s));
  const otherStages = [...groups.keys()].filter((s) => !STAGE_ORDER.includes(s));
  const allStages = [...orderedStages, ...otherStages];

  for (const stage of allStages) {
    const items = groups.get(stage)!;
    const icon = STAGE_ICON[stage] ?? '📋';

    console.log(chalk.dim(`  ${icon} ${stage}`));
    console.log('');

    for (let idx = 0; idx < items.length; idx++) {
      const r = items[idx];
      const isRootCause = r === rootCause;
      const icon = r.level === 'error' ? chalk.red('✖') : chalk.yellow('⚠');
      const label = r.level === 'error' ? chalk.red.bold('ERROR') : chalk.yellow.bold(' WARN');
      const rootTag = isRootCause ? chalk.red(' ← root cause') : '';
      const secondaryTag = !isRootCause && displayResults.indexOf(r) > 0 ? chalk.dim(' (secondary)') : '';

      console.log(`  ${icon}  ${label}  ${chalk.bold(r.title)}${rootTag}${secondaryTag}  ${chalk.dim(`[${r.id}]`)}`);
      console.log(`     ${CONF_LABEL[r.confidence]} ${CONF_TEXT[r.confidence]}`);

      // Context window
      console.log('');
      console.log(chalk.dim('     ┌─ log context:'));
      for (let ci = 0; ci < r.context.length; ci++) {
        const lineNum = r.lineNumber - r.contextHighlight + ci;
        const lineStr = String(lineNum).padStart(5);
        const content = r.context[ci].substring(0, 120);
        if (ci === r.contextHighlight) {
          console.log(chalk.red(`     │ ${lineStr} │ ▶ ${content}`));
        } else {
          console.log(chalk.dim(`     │ ${lineStr} │   ${content}`));
        }
      }
      console.log(chalk.dim('     └──'));

      console.log('');
      console.log(`     ${chalk.white(r.explanation)}`);
      console.log('');
      console.log(`     ${chalk.green('↳ Fix:')}`);
      for (const line of r.fix.split('\n')) {
        console.log(`     ${chalk.green('  ' + line)}`);
      }
      console.log('');

      if (idx < items.length - 1) {
        console.log(chalk.dim('     ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─'));
        console.log('');
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const errors   = displayResults.filter((r) => r.level === 'error').length;
  const warnings = displayResults.filter((r) => r.level === 'warn').length;
  const highConf = displayResults.filter((r) => r.confidence === 'high').length;

  const parts: string[] = [];
  if (errors)   parts.push(chalk.red(`${errors} error${errors > 1 ? 's' : ''}`));
  if (warnings) parts.push(chalk.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`));

  console.log(chalk.dim('  ───────────────────────────────────'));
  console.log(`  ${parts.join(chalk.dim(' · '))}  ${chalk.dim('found in log')}`);
  if (highConf > 0) {
    console.log(`  ${chalk.red('●')} ${highConf} high-confidence match${highConf > 1 ? 'es' : ''} — ${chalk.dim('fix these first')}`);
  }
  console.log('');

  // ── Exit ─────────────────────────────────────────────────────────────
  if (errors > 0) process.exit(2);
  if (warnings > 0) process.exit(1);
  process.exit(0);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
