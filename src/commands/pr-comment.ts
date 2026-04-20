import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCwd } from '../utils/context.js';
import { loadConfig } from '../utils/config-loader.js';
import { detectProject } from '../detectors/project.js';
import { runRules } from '../analyzers/index.js';
import { renderMarkdown } from '../reporters/markdown-reporter.js';
import { computeSignalsFromRules, aggregateSignals } from '../analyzers/signals.js';
import { computeReadinessScore } from '../utils/score-calculator.js';
import { computeTrend } from '../analyzers/history.js';

export async function prCommentCommand(options: { out?: string } = {}): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);
  const info = detectProject(cwd);

  if (!info.hasPackageJson) {
    process.exit(2);
  }

  const { results } = runRules(info, { ciStrict: true, config });
  const signals = computeSignalsFromRules(results);
  const readiness = computeReadinessScore(aggregateSignals(signals));
  const trend = computeTrend();

  const md = renderMarkdown({
    results,
    readiness,
    trend,
    projectPath: cwd,
  });

  const output = options.out ? path.resolve(cwd, options.out) : path.join(cwd, 'expo-ci-pr-comment.md');
  fs.writeFileSync(output, md, 'utf-8');
  process.stdout.write(`${output}\n`);

  const hasError = results.some((r) => r.level === 'error');
  process.exit(hasError ? 2 : 0);
}
