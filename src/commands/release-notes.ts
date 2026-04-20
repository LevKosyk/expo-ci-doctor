import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { detectProject } from '../detectors/project.js';
import { loadProjectTargets } from '../utils/project-scan.js';
import { getCwd } from '../utils/context.js';
import { loadConfig } from '../utils/config-loader.js';
import { runRules } from '../analyzers/index.js';
import { computeSignalsFromRules, aggregateSignals } from '../analyzers/signals.js';
import { computeReadinessScore } from '../utils/score-calculator.js';
import { printTitle, icons } from '../utils/logger.js';
import { resolveCommandThreshold, exitCodeForThreshold } from '../utils/severity.js';

interface ReleaseNoteItem {
  kind: 'breaking' | 'change' | 'fix' | 'dependency' | 'ci' | 'info';
  project: string;
  title: string;
  details: string;
  fix?: string;
}

export async function releaseNotesCommand(options: { out?: string; allWorkspaces?: boolean; failOn?: string } = {}): Promise<void> {
  const cwd = getCwd();
  const targets = loadProjectTargets(cwd, Boolean(options.allWorkspaces));
  const projectNotes: ReleaseNoteItem[] = [];
  let worstExit = 0;

  for (const target of targets) {
    const config = loadConfig(target.cwd);
    const threshold = resolveCommandThreshold(config, 'release-notes', options.failOn);
    const { results } = runRules(target.info, { config });
    const signals = computeSignalsFromRules(results);
    const readiness = computeReadinessScore(aggregateSignals(signals));
    const code = exitCodeForThreshold(results, threshold);
    worstExit = Math.max(worstExit, code);

    for (const result of results) {
      projectNotes.push(mapResultToReleaseNote(result, target.label, readiness.score));
    }
  }

  const output = renderReleaseNotes(projectNotes, targets.length > 1 ? 'multi-project' : 'single-project');
  const outputPath = options.out ? path.resolve(cwd, options.out) : path.join(cwd, 'release-notes-from-findings.md');
  fs.writeFileSync(outputPath, output, 'utf-8');

  printTitle('expo-ci-doctor release-notes');
  if (targets.length > 1) {
    console.log(chalk.dim(`  Scanned ${targets.length} workspace app(s).`));
  }
  console.log(`  Wrote ${chalk.bold(outputPath)}`);
  console.log('');

  process.exit(worstExit);
}

function mapResultToReleaseNote(result: { id: string; level: 'info' | 'warn' | 'error'; title: string; details: string; fix?: string }, project: string, score: number): ReleaseNoteItem {
  const kind = result.level === 'error'
    ? 'breaking'
    : result.id.includes('dependency')
      ? 'dependency'
      : result.id.includes('ci')
        ? 'ci'
        : result.level === 'warn'
          ? 'change'
          : 'info';

  return {
    kind,
    project,
    title: result.title,
    details: `${result.details} (health ${score}/100)`,
    fix: result.fix,
  };
}

function renderReleaseNotes(items: ReleaseNoteItem[], mode: 'single-project' | 'multi-project'): string {
  const lines: string[] = [];
  const grouped: Record<ReleaseNoteItem['kind'], ReleaseNoteItem[]> = {
    breaking: [],
    change: [],
    fix: [],
    dependency: [],
    ci: [],
    info: [],
  };

  for (const item of items) {
    grouped[item.kind].push(item);
  }

  lines.push('# Release Notes From Findings');
  lines.push('');
  lines.push(`Generated from ${mode === 'multi-project' ? 'all workspace apps' : 'the current project'}.`);
  lines.push('');

  appendSection(lines, 'Breaking Changes', grouped.breaking);
  appendSection(lines, 'Dependency Risks', grouped.dependency);
  appendSection(lines, 'CI Changes', grouped.ci);
  appendSection(lines, 'General Changes', grouped.change);
  appendSection(lines, 'Fixes Applied or Suggested', grouped.fix);
  appendSection(lines, 'Notes', grouped.info);

  return lines.join('\n');
}

function appendSection(lines: string[], title: string, items: ReleaseNoteItem[]): void {
  if (items.length === 0) return;
  lines.push(`## ${title}`);
  lines.push('');
  for (const item of items) {
    lines.push(`- **${item.project}**: ${item.title}`);
    lines.push(`  - ${item.details}`);
    if (item.fix) {
      lines.push(`  - Fix: ${item.fix.split('\n')[0]}`);
    }
  }
  lines.push('');
}
