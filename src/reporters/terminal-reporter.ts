import chalk from 'chalk';
import type { RuleResult, RuleLevel } from '../utils/types.js';

export type OutputMode = 'default' | 'ci' | 'ci-summary' | 'json' | 'json-full';

export interface FormatOptions {
  mode: OutputMode;
  severity?: RuleLevel;
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

import { icons } from '../utils/logger.js';

function getLevelIconColor(level: RuleLevel) {
  switch (level) {
    case 'error': return icons.error;
    case 'warn': return icons.warning;
    case 'info': return icons.info;
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
    const nextStep = result.fix.split('\n').find((line) => /^(npx|npm|pnpm|yarn)\s+/i.test(line.trim()));
    if (nextStep) {
      console.log(`   ${chalk.magenta('Next step:')} Run ${nextStep.trim()}`);
    }
  } else if (result.level !== 'info') {
    console.log(`   ${chalk.magenta('Next step:')} Run expo-ci-doctor explain ${result.id}`);
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
      ? { results: filtered, total: filtered.length }
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
  } else if (options.mode === 'ci') {
    for (const r of filtered) {
      formatResultCI(r);
    }
  }
}
