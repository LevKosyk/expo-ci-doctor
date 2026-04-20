import chalk from 'chalk';
import { printTitle } from '../utils/logger.js';
import { getRuntime } from '../utils/runtime.js';

export async function tipsCommand(): Promise<void> {
  const runtime = getRuntime();
  if (!runtime.silent) {
    printTitle('expo-ci-doctor tips');
  }

  const tips = [
    'Pin Node with engines.node and align CI setup-node to the same major.',
    'Commit exactly one lockfile and use matching package manager in CI.',
    'Store EXPO_TOKEN in CI secrets and reference it explicitly in workflow env.',
    'Run `expo-ci-doctor check --summary` before pushing to catch top blockers early.',
    'Generate PR comments with `expo-ci-doctor pr-comment` for team-visible diagnostics.',
  ];

  if (runtime.silent) {
    process.stdout.write(`${tips.join(' | ')}\n`);
    return;
  }

  console.log(chalk.bold('  5 Best-Practice Tips for Expo CI'));
  console.log(chalk.dim('  ─────────────────────────────────'));
  for (let i = 0; i < tips.length; i++) {
    console.log(`  ${i + 1}. ${tips[i]}`);
  }
  console.log('');
}
