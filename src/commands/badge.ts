import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCwd } from '../utils/context.js';
import { loadConfig } from '../utils/config-loader.js';
import { detectProject } from '../detectors/project.js';
import { runRules } from '../analyzers/index.js';
import { computeSignalsFromRules, aggregateSignals } from '../analyzers/signals.js';
import { computeReadinessScore } from '../utils/score-calculator.js';
import { drawBox, colors } from '../utils/logger.js';
import { generateBadgeColor, generateBadgeMarkdown } from '../utils/badge.js';

export async function badgeCommand(options: { markdown?: boolean } = {}): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);

  const info = detectProject(cwd);

  if (!info.hasPackageJson) {
    if (!options.markdown) {
      console.log(colors.error('✖ No package.json found.'));
    }
    process.exit(2);
  }

  const { results } = runRules(info, { config });
  
  const signals = computeSignalsFromRules(results);
  const signalSummary = aggregateSignals(signals);
  const readiness = computeReadinessScore(signalSummary);

  const score = readiness.score;
  const risk = readiness.risk;
  const color = generateBadgeColor(score);
  const markdownBadge = generateBadgeMarkdown(score, color);

  // 1) Save metadata to .expo-ci-doctor/health.json
  const metadataDir = path.join(cwd, '.expo-ci-doctor');
  const metadataFile = path.join(metadataDir, 'health.json');

  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  const badgeMetadata = {
    score,
    risk: risk.toLowerCase(),
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(metadataFile, JSON.stringify(badgeMetadata, null, 2), 'utf-8');

  // 2) Output logic
  if (options.markdown) {
    console.log(markdownBadge);
    return;
  }

  console.log('');
  console.log(drawBox(
    'Expo CI Doctor Badge Generated',
    `Health Score: ${score} / 100\n` +
    `Risk Level: ${risk}\n\n` +
    `Add this badge to your README:\n\n` +
    markdownBadge
  ));
  console.log('');
}
