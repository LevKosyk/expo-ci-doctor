import chalk from 'chalk';
import type { RuleResult, RuleCategory } from '../utils/types.js';
import { CATEGORY_ORDER } from '../utils/types.js';
import { ruleCategory } from '../analyzers/index.js';

const ICON = {
  error: chalk.red('✖'),
  warn:  chalk.yellow('⚠'),
  info:  chalk.blue('ℹ'),
} as const;

const LABEL = {
  error: chalk.red.bold('ERROR'),
  warn:  chalk.yellow.bold(' WARN'),
  info:  chalk.blue.bold(' INFO'),
} as const;

const CATEGORY_ICON: Record<string, string> = {
  Expo:         '📱',
  EAS:          '🏗️',
  Config:       '📋',
  Node:         '🟢',
  Dependencies: '📦',
  CI:           '⚙️',
  Other:        '❓',
};

/**
 * Print a human-readable report to stdout, grouped by category.
 */
export function printReport(results: RuleResult[]): void {
  if (results.length === 0) {
    console.log(chalk.green('\n  ✔  No issues found. Project looks good!\n'));
    return;
  }

  // Sort: errors → warns → info within each group
  const sorted = [...results].sort((a, b) => {
    const order = { error: 0, warn: 1, info: 2 };
    return order[a.level] - order[b.level];
  });

  // Group by rule category
  const groups = new Map<string, RuleResult[]>();
  for (const r of sorted) {
    const cat = ruleCategory(r.id);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(r);
  }

  // Print in category order
  const orderedCats = (CATEGORY_ORDER as string[]).filter((c) => groups.has(c));
  const otherCats = [...groups.keys()].filter((c) => !(CATEGORY_ORDER as string[]).includes(c));
  const allCats = [...orderedCats, ...otherCats];

  console.log('');

  for (const cat of allCats) {
    const items = groups.get(cat)!;
    const icon = CATEGORY_ICON[cat] ?? '📋';
    console.log(chalk.dim(`  ${icon} ${cat}`));
    console.log('');

    for (const r of items) {
      console.log(`  ${ICON[r.level]}  ${LABEL[r.level]}  ${chalk.bold(r.title)}  ${chalk.dim(`[${r.id}]`)}`);
      if (r.filePointer) {
        console.log(`     ${chalk.cyan('→')} ${chalk.dim(r.filePointer)}`);
      }
      console.log(`     ${chalk.dim(r.details)}`);
      if (r.fix) {
        // Render fix with proper indentation for multi-line fixes
        const fixLines = r.fix.split('\n');
        console.log(`     ${chalk.green('↳ ' + fixLines[0])}`);
        for (let i = 1; i < fixLines.length; i++) {
          console.log(`     ${chalk.green('  ' + fixLines[i])}`);
        }
      }
      console.log('');
    }
  }

  // ── Summary ───────────────────────────────────────────────────────
  const errors   = results.filter((r) => r.level === 'error').length;
  const warnings = results.filter((r) => r.level === 'warn').length;
  const infos    = results.filter((r) => r.level === 'info').length;

  const parts: string[] = [];
  if (errors)   parts.push(chalk.red(`${errors} error${errors > 1 ? 's' : ''}`));
  if (warnings) parts.push(chalk.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`));
  if (infos)    parts.push(chalk.blue(`${infos} info`));

  console.log(chalk.dim('  ───────────────────────────────────'));
  console.log(`  ${parts.join(chalk.dim(' · '))}  ${chalk.dim(`(${results.length} total)`)}`);

  // ── Top blockers summary ──────────────────────────────────────────
  if (errors > 0) {
    const blockers = sorted
      .filter((r) => r.level === 'error')
      .slice(0, 3);

    console.log('');
    console.log(chalk.dim('  Top blockers:'));
    for (const b of blockers) {
      console.log(chalk.red(`    → ${b.title}`));
    }
  }

  if (errors > 0) {
    console.log('');
    console.log(chalk.red.dim('  ⚠ High risk of CI failure'));
  } else if (warnings > 0) {
    console.log('');
    console.log(chalk.yellow.dim('  ◐ Moderate risk — review warnings'));
  }

  console.log('');
}
