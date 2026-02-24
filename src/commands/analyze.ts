import * as fs from 'node:fs';
import chalk from 'chalk';
import ora from 'ora';
import { getLicenseState } from '../core/license.js';
import { matchPatterns, type MatchResult } from '../analyzers/matcher.js';

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
 */
export async function analyzeCommand(logFile: string): Promise<void> {
  const license = getLicenseState();

  // ── Pro gate ──────────────────────────────────────────────────────
  if (license.mode !== 'pro') {
    console.log('');
    console.log(chalk.yellow('  🔒  Log analysis is a Pro feature.'));
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

  console.log('');
  console.log(chalk.bold('  expo-ci-doctor analyze') + chalk.dim(' · Build failure analysis') + chalk.green(' PRO'));
  console.log(chalk.dim(`  Log: ${logFile}`));

  const spinner = ora({ text: 'Scanning log…', color: 'cyan', indent: 2 }).start();
  await delay(300);

  const raw = fs.readFileSync(logFile, 'utf-8');
  const lineCount = raw.split('\n').length;

  spinner.text = `Matching ${lineCount} lines against 18 patterns…`;
  await delay(200);

  const results = matchPatterns(raw);

  spinner.stop();

  console.log(chalk.dim(`  ${lineCount} lines · ${results.length} pattern${results.length !== 1 ? 's' : ''} matched`));

  // ── No matches ────────────────────────────────────────────────────
  if (results.length === 0) {
    console.log(chalk.green('\n  ✔  No known Expo/EAS failure patterns detected.'));
    console.log(chalk.dim('     If the build still fails, the error may be project-specific.'));
    console.log('');
    process.exit(0);
  }

  // ── Root-cause indicator ──────────────────────────────────────────
  const rootCause = results[0]; // Already sorted by priority
  console.log('');
  console.log(chalk.red.bold('  🎯 Most likely root cause:'));
  console.log(chalk.red(`     ${rootCause.title}`));
  console.log('');

  // ── Group by stage ────────────────────────────────────────────────
  const groups = new Map<string, MatchResult[]>();
  for (const r of results) {
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
      const secondaryTag = !isRootCause && results.indexOf(r) > 0 ? chalk.dim(' (secondary)') : '';

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
          // Highlighted match line
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

  // ── Summary ───────────────────────────────────────────────────────
  const errors = results.filter((r) => r.level === 'error').length;
  const warnings = results.filter((r) => r.level === 'warn').length;
  const highConf = results.filter((r) => r.confidence === 'high').length;

  const parts: string[] = [];
  if (errors) parts.push(chalk.red(`${errors} error${errors > 1 ? 's' : ''}`));
  if (warnings) parts.push(chalk.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`));

  console.log(chalk.dim('  ───────────────────────────────────'));
  console.log(`  ${parts.join(chalk.dim(' · '))}  ${chalk.dim('found in log')}`);
  if (highConf > 0) {
    console.log(`  ${chalk.red('●')} ${highConf} high-confidence match${highConf > 1 ? 'es' : ''} — ${chalk.dim('fix these first')}`);
  }
  console.log('');

  // ── Exit code ─────────────────────────────────────────────────────
  if (errors > 0) process.exit(2);
  if (warnings > 0) process.exit(1);
  process.exit(0);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
