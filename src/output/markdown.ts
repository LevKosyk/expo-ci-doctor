import type { RuleResult } from '../core/types.js';
import type { ReadinessScore } from '../analysis/readiness.js';
import type { FailurePrediction } from '../analysis/prediction.js';
import type { StabilityTrend } from '../analysis/history.js';

export interface MarkdownReportOptions {
  results: RuleResult[];
  readiness?: ReadinessScore;
  prediction?: FailurePrediction;    // Pro-only
  trend?: StabilityTrend;            // Pro-only
  projectPath?: string;
  isPro?: boolean;
}

/**
 * Generates GitHub-Flavored Markdown output for `--format=md`.
 *
 * Starter: summary + readiness score + issues table
 * Pro: adds failure prediction, stability trend, file annotation links
 *
 * Designed to be pasted into GitHub Issues, PR comments, or piped
 * to a file for upload as a build artifact.
 */
export function renderMarkdown(opts: MarkdownReportOptions): string {
  const lines: string[] = [];
  const { results, readiness, prediction, trend, projectPath, isPro } = opts;

  const errors   = results.filter(r => r.level === 'error').length;
  const warnings = results.filter(r => r.level === 'warn').length;
  const infos    = results.filter(r => r.level === 'info').length;

  // ─── Header ───────────────────────────────────────────────────────
  lines.push('## expo-ci-doctor Report');
  lines.push('');
  if (projectPath) {
    lines.push(`**Project:** \`${projectPath}\``);
    lines.push('');
  }

  // ─── Summary ──────────────────────────────────────────────────────
  lines.push('### Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Errors | ${errors} |`);
  lines.push(`| Warnings | ${warnings} |`);
  lines.push(`| Info | ${infos} |`);
  if (readiness) {
    lines.push(`| Build Readiness | ${readiness.score}/100 |`);
    lines.push(`| Risk Level | ${readiness.risk} |`);
  }
  lines.push('');

  // ─── Readiness Score ──────────────────────────────────────────────
  if (readiness) {
    lines.push('### Build Readiness Score');
    lines.push('');
    const bar = buildScoreBar(readiness.score);
    lines.push(`**${readiness.score}/100** — Risk: **${readiness.risk}**`);
    lines.push('');
    lines.push(`\`${bar}\``);
    lines.push('');
    lines.push(`> ${readiness.summary}`);
    lines.push('');

    if (readiness.breakdown.length > 0) {
      lines.push('**Score breakdown:**');
      lines.push('');
      for (const b of readiness.breakdown) {
        lines.push(`- **${b.category}**: -${b.penalty} pts — ${b.reason}`);
      }
      lines.push('');
    }
  }

  // ─── Pro: Failure Prediction ──────────────────────────────────────
  if (isPro && prediction && prediction.confidence > 0) {
    lines.push('### Failure Prediction');
    lines.push('');
    lines.push(`> **Confidence: ${prediction.confidence}%** — Likelihood: **${prediction.likelihood}**`);
    lines.push('');
    lines.push(prediction.explanation);
    lines.push('');
    if (prediction.primarySignals.length > 0) {
      lines.push('**Primary signals:**');
      for (const sig of prediction.primarySignals) {
        lines.push(`- ${sig}`);
      }
      lines.push('');
    }
    lines.push('*Note: This is a heuristic estimate — not a guarantee.*');
    lines.push('');
  }

  // ─── Pro: Stability Trend ────────────────────────────────────────
  if (isPro && trend && trend.entries.length > 0) {
    lines.push('### CI Stability Trend');
    lines.push('');
    const arrow = trend.direction === 'Improving' ? '↑'
      : trend.direction === 'Degrading' ? '↓' : '→';
    lines.push(`**${trend.direction} ${arrow}**`);
    lines.push('');
    if (trend.recentSymbols.length > 0) {
      lines.push(`Last ${trend.recentSymbols.length} runs: \`${trend.recentSymbols.join(' ')}\``);
    }
    lines.push('');
  }

  // ─── Issues ──────────────────────────────────────────────────────
  if (results.length > 0) {
    lines.push('### Detected Issues');
    lines.push('');
    lines.push('| Level | Rule | Title | Location |');
    lines.push('|-------|------|-------|----------|');

    for (const r of results) {
      const levelBadge = r.level === 'error' ? '🔴 Error'
        : r.level === 'warn' ? '🟡 Warning' : '🔵 Info';
      const location = r.hints?.where || r.filePointer || '—';
      lines.push(`| ${levelBadge} | \`${r.id}\` | ${r.title} | \`${location}\` |`);
    }
    lines.push('');

    // Detail blocks for errors only
    const errorResults = results.filter(r => r.level === 'error');
    if (errorResults.length > 0) {
      lines.push('<details>');
      lines.push('<summary>Error details</summary>');
      lines.push('');
      for (const r of errorResults) {
        lines.push(`#### ${r.title}`);
        lines.push('');
        lines.push(r.details);
        if (r.fix) {
          lines.push('');
          lines.push('**Fix:**');
          lines.push('');
          lines.push('```');
          lines.push(r.fix);
          lines.push('```');
        }
        lines.push('');
      }
      lines.push('</details>');
      lines.push('');
    }
  } else {
    lines.push('### No Issues Detected');
    lines.push('');
    lines.push('All checks passed.');
    lines.push('');
  }

  // ─── Footer ──────────────────────────────────────────────────────
  lines.push('---');
  lines.push(`*Generated by expo-ci-doctor${isPro ? ' (Pro)' : ''} — [expo-ci-doctor.com](https://expo-ci-doctor.com)*`);

  return lines.join('\n');
}

function buildScoreBar(score: number): string {
  const filled = Math.round(score / 5);   // 20-block bar
  const empty  = 20 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${score}%`;
}
