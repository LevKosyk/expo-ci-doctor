import chalk from 'chalk';
import type { RuleResult, RuleLevel } from '../core/types.js';

export type OutputMode = 'default' | 'ci' | 'ci-summary' | 'json' | 'json-full';

export interface FormatOptions {
  mode: OutputMode;
  severity?: RuleLevel;
  skippedPro?: number;
}

const SEVERITY_WEIGHT: Record<RuleLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
};

export function filterBySeverity(results: RuleResult[], minSeverity?: RuleLevel): RuleResult[] {
  if (!minSeverity) return results;
  const minWeight = SEVERITY_WEIGHT[minSeverity];
  return results.filter(r => SEVERITY_WEIGHT[r.level] >= minWeight);
}

function getLevelIconColor(level: RuleLevel) {
  switch (level) {
    case 'error': return chalk.red('✖');
    case 'warn': return chalk.yellow('⚠');
    case 'info': return chalk.blue('ℹ');
  }
}

function formatResultDefault(result: RuleResult) {
  const icon = getLevelIconColor(result.level);
  console.log(`\n${icon} ${chalk.bold(result.title)} ${chalk.dim(`[${result.id}]`)}`);
  
  // Contextual Hints
  if (result.hints) {
    if (result.hints.what) console.log(`   ${chalk.cyan('What:')}  ${result.hints.what}`);
    if (result.hints.why) console.log(`   ${chalk.cyan('Why:')}   ${result.hints.why}`);
    if (result.hints.where || result.filePointer) console.log(`   ${chalk.cyan('Where:')} ${result.hints.where || result.filePointer}`);
    if (result.hints.when) console.log(`   ${chalk.cyan('When:')}  ${result.hints.when}`);
  } else {
    // Fallback to legacy structure, but formatted as what/why/where
    console.log(`   ${chalk.cyan('Why:')}   ${result.details}`);
    if (result.filePointer) {
      console.log(`   ${chalk.cyan('Where:')} ${result.filePointer}`);
    }
  }

  if (result.fix) {
    console.log(`   ${chalk.green('Fix:')}   ${result.fix.split('\n').join('\n          ')}`);
  }
}

function formatResultCI(result: RuleResult) {
  const levelText = result.level.toUpperCase();
  const location = result.hints?.where || result.filePointer || 'unknown';
  console.log(`[${levelText}] ${result.id} @ ${location}: ${result.title}`);
}

export function printResults(results: RuleResult[], options: FormatOptions) {
  const filtered = filterBySeverity(results, options.severity);
  
  if (options.mode === 'json' || options.mode === 'json-full') {
    const out = options.mode === 'json-full' 
      ? { results: filtered, skippedPro: options.skippedPro, total: filtered.length }
      : filtered.map(r => ({ id: r.id, level: r.level, title: r.title }));
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (filtered.length === 0) {
    if (options.mode !== 'ci') {
      console.log(chalk.green('\n✔ No issues found! Your project looks good.'));
    }
    return;
  }

  if (options.mode === 'ci-summary') {
    const errors = filtered.filter(r => r.level === 'error').length;
    const warns = filtered.filter(r => r.level === 'warn').length;
    console.log(`\nCI Summary: ${errors} errors, ${warns} warnings detected.`);
    return;
  }

  if (options.mode === 'default') {
    console.log(chalk.underline(`\nFound ${filtered.length} issue(s):`));
    for (const r of filtered) {
      formatResultDefault(r);
    }
    if (options.skippedPro && options.skippedPro > 0) {
      console.log(chalk.dim(`\n...and ${options.skippedPro} Pro-only checks were skipped.`));
    }
  } else if (options.mode === 'ci') {
    for (const r of filtered) {
      formatResultCI(r);
    }
  }
}
