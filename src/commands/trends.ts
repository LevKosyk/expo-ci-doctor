import chalk from 'chalk';
import { computeTrend, getHistoryEntries, isFlaky } from '../analyzers/history.js';
import { printTitle, icons } from '../utils/logger.js';
import { sendWebhookNotification } from '../utils/webhook.js';
import { getCwd } from '../utils/context.js';

export async function trendsCommand(options: { days?: string; webhook?: string } = {}): Promise<void> {
  const cwd = getCwd();
  const days = clampDays(Number(options.days ?? '14'));
  const all = getHistoryEntries(200, cwd);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const entries = all.filter((e) => new Date(e.timestamp).getTime() >= cutoff);

  printTitle('expo-ci-doctor trends');

  if (entries.length === 0) {
    console.log(chalk.dim(`  No run history in the last ${days} day(s).`));
    console.log(chalk.dim('  Run `expo-ci-doctor check` to start collecting trend data.'));
    console.log('');
    return;
  }

  const trend = computeTrend(cwd);
  const avgScore = Math.round(entries.reduce((sum, e) => sum + e.score, 0) / entries.length);
  const passCount = entries.filter((e) => e.outcome === 'pass').length;
  const failCount = entries.length - passCount;
  const recent = entries.slice(-7);
  const recentBar = recent.map((e) => e.outcome === 'pass' ? '✔' : '✖').join(' ');
  const scoreDelta = scoreDeltaText(entries);
  const flaky = isFlaky(entries.slice(-10));

  console.log(`  Window: ${days} day(s)`);
  console.log(`  Runs: ${entries.length}`);
  console.log(`  Pass: ${passCount}   Fail: ${failCount}`);
  console.log(`  Avg Health Score: ${avgScore}/100`);
  console.log(`  Direction: ${trend.direction}`);
  console.log(`  Score change: ${scoreDelta}`);
  console.log(`  Recent runs: ${recentBar}`);

  if (flaky) {
    console.log(chalk.yellow(`\n  ${icons.warning} Flaky build pattern detected (frequent pass/fail flips).`));
  }

  const topCategory = mostCommonFailureCategory(entries);
  if (topCategory) {
    console.log(chalk.dim(`  Most common failure category: ${topCategory}`));
  }

  if (options.webhook && (trend.direction === 'Degrading' || flaky)) {
    await sendWebhookNotification(options.webhook, {
      title: 'expo-ci-doctor trend alert',
      text: `Trend alert: ${trend.direction}. Window ${days} day(s), runs ${entries.length}, avg score ${avgScore}/100.${flaky ? ' Flaky behavior detected.' : ''}`,
      severity: 'warning',
      source: cwd,
      score: avgScore,
      trend: trend.direction,
    });
  }

  console.log('');
}

function clampDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 14;
  return Math.min(90, Math.max(1, Math.round(days)));
}

function scoreDeltaText(entries: Array<{ score: number }>): string {
  if (entries.length < 2) return 'n/a';
  const first = entries[0].score;
  const last = entries[entries.length - 1].score;
  const delta = last - first;
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function mostCommonFailureCategory(entries: Array<{ primaryFailureCategory?: string; outcome: 'pass' | 'fail' }>): string | null {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.outcome !== 'fail' || !entry.primaryFailureCategory) continue;
    counts.set(entry.primaryFailureCategory, (counts.get(entry.primaryFailureCategory) ?? 0) + 1);
  }
  let winner: string | null = null;
  let max = 0;
  for (const [category, count] of counts.entries()) {
    if (count > max) {
      max = count;
      winner = category;
    }
  }
  return winner;
}
