import type { RuleResult } from '../core/types.js';

/**
 * GitHub Actions annotation output.
 *
 * When GITHUB_ACTIONS=true, GitHub parses workflow log lines in the format:
 *   ::error file=<file>,line=<line>::<message>
 *   ::warning file=<file>,line=<line>::<message>
 *   ::notice file=<file>,line=<line>::<message>
 *
 * These render as inline annotations on the PR diff and in the Actions summary.
 *
 * Docs: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
 */

export function isGitHubActions(): boolean {
  return process.env.GITHUB_ACTIONS === 'true';
}

/**
 * Emit a GitHub Actions annotation for a rule result.
 * Falls back gracefully when not running in GitHub Actions.
 */
export function emitGitHubAnnotation(result: RuleResult): void {
  if (!isGitHubActions()) return;

  const level = result.level === 'error' ? 'error'
    : result.level === 'warn' ? 'warning'
    : 'notice';

  // Extract file and line from filePointer or hints.where
  // filePointer format: "path/to/file > field"
  const raw = result.hints?.where || result.filePointer || '';
  const filePart = raw.split('>')[0].trim() || 'unknown';
  // Extract line number if available (e.g. "file.ts:42")
  const lineMatch = filePart.match(/:(\d+)/);
  const file = filePart.replace(/:\d+.*$/, '').trim();
  const line = lineMatch ? lineMatch[1] : '1';

  // Escape message: newlines become %0A in GH annotations
  const msg = [result.title, result.details].join(' — ').replace(/\n/g, '%0A');

  // Write annotation to stdout (GH Actions reads from stdout/stderr both)
  process.stdout.write(`::${level} file=${file},line=${line}::${msg}\n`);
}

/**
 * Emit annotations for all results.
 * Only active when GITHUB_ACTIONS=true.
 */
export function emitGitHubAnnotations(results: RuleResult[]): void {
  if (!isGitHubActions()) return;
  for (const r of results) {
    emitGitHubAnnotation(r);
  }
}
