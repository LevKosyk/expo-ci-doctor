import { describe, it, expect } from '@jest/globals';
import {
  computeSignalsFromRules,
  computeSignalsFromMatches,
  aggregateSignals,
} from '../src/analysis/signals.js';
import { computeReadinessScore } from '../src/analysis/readiness.js';
import { predictFailure } from '../src/analysis/prediction.js';
import { filterByNoise, noiseFilterNote } from '../src/analysis/noise.js';
import { parseUpgradeTarget, generateUpgradeSafetyReport } from '../src/analysis/upgrade.js';
import { renderMarkdown } from '../src/output/markdown.js';
import { isGitHubActions } from '../src/ci/github-actions.js';
import type { RuleResult } from '../src/core/types.js';
import type { MatchResult } from '../src/analyzers/matcher.js';

// ─── Test helpers ────────────────────────────────────────────────────

function makeError(id: string): RuleResult {
  return { id, level: 'error', title: `Error: ${id}`, details: 'test details' };
}

function makeWarn(id: string): RuleResult {
  return { id, level: 'warn', title: `Warn: ${id}`, details: 'test details' };
}

function makeMatch(id: string, confidence: 'high' | 'likely' | 'possible' = 'high'): MatchResult {
  return {
    id,
    level: 'error',
    confidence,
    stage: 'Auth',
    title: `Pattern: ${id}`,
    explanation: 'test',
    fix: 'fix it',
    matchedLine: 'error line',
    lineNumber: 1,
    context: ['error line'],
    contextHighlight: 0,
    priority: 10,
  };
}

// ─── Signal layer ────────────────────────────────────────────────────

describe('signals', () => {
  it('generates error signals from rule results', () => {
    const sigs = computeSignalsFromRules([makeError('missing-app-config')]);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].triggered).toBe(true);
    expect(sigs[0].weight).toBe(15);
  });

  it('generates warn signals with lower weight', () => {
    const sigs = computeSignalsFromRules([makeWarn('no-engines-node')]);
    expect(sigs[0].weight).toBe(7);
  });

  it('aggregates signals correctly', () => {
    const a = computeSignalsFromRules([makeError('e1')]);
    const b = computeSignalsFromRules([makeWarn('w1')]);
    const summary = aggregateSignals(a, b);
    expect(summary.triggered).toHaveLength(2);
    expect(summary.totalPenalty).toBe(22);
  });
});

// ─── Readiness score ────────────────────────────────────────────────

describe('computeReadinessScore', () => {
  it('returns 100 when no signals triggered', () => {
    const summary = aggregateSignals([]);
    const score = computeReadinessScore(summary);
    expect(score.score).toBe(100);
    expect(score.risk).toBe('Low');
  });

  it('deducts for errors, stays within 0–100', () => {
    const sigs = computeSignalsFromRules([makeError('e1'), makeError('e2'), makeError('e3')]);
    const score = computeReadinessScore(aggregateSignals(sigs));
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThan(100);
  });

  it('classifies risk correctly', () => {
    // many errors → low score → High risk
    const manySigs = Array.from({ length: 6 }, (_, i) => makeError(`e${i}`));
    const sigs = computeSignalsFromRules(manySigs);
    const score = computeReadinessScore(aggregateSignals(sigs));
    // 6 errors × 15 weight each = 90pts but config cap is 35, so score = 65
    expect(['Medium', 'High']).toContain(score.risk);
  });

  it('is deterministic', () => {
    const results = [makeError('e1'), makeWarn('w1')];
    const sigs = computeSignalsFromRules(results);
    const s1 = computeReadinessScore(aggregateSignals(sigs));
    const s2 = computeReadinessScore(aggregateSignals(computeSignalsFromRules(results)));
    expect(s1.score).toBe(s2.score);
  });
});

// ─── Failure prediction ──────────────────────────────────────────────

describe('predictFailure', () => {
  it('returns 0 confidence with no signals', () => {
    const pred = predictFailure(aggregateSignals([]));
    expect(pred.confidence).toBe(0);
    expect(pred.likelihood).toBe('Low');
  });

  it('returns higher confidence with high-weight matches', () => {
    const matches = [makeMatch('m1', 'high'), makeMatch('m2', 'high'), makeMatch('m3', 'high')];
    const sigs = computeSignalsFromMatches(matches);
    const pred = predictFailure(aggregateSignals(sigs));
    expect(pred.confidence).toBeGreaterThan(50);
    expect(pred.primarySignals.length).toBeGreaterThan(0);
  });

  it('never exceeds 97%', () => {
    const matches = Array.from({ length: 10 }, (_, i) => makeMatch(`p${i}`, 'high'));
    const sigs = computeSignalsFromMatches(matches);
    const pred = predictFailure(aggregateSignals(sigs));
    expect(pred.confidence).toBeLessThanOrEqual(97);
  });
});

// ─── Noise filter ────────────────────────────────────────────────────

describe('filterByNoise', () => {
  const matches = [
    makeMatch('auth-error'),
    makeMatch('install-error'),
    makeMatch('build-error'),
    makeMatch('metro-error'),
  ];

  it('full mode returns all', () => {
    expect(filterByNoise(matches, 'full')).toHaveLength(4);
  });

  it('low mode returns at most 1', () => {
    const filtered = filterByNoise(matches, 'low');
    expect(filtered.length).toBeLessThanOrEqual(1);
  });

  it('medium mode returns at most 3', () => {
    const multi = [
      { ...makeMatch('a'), stage: 'Auth' },
      { ...makeMatch('b'), stage: 'Install' },
      { ...makeMatch('c'), stage: 'iOS' },
      { ...makeMatch('d'), stage: 'Android' },
    ];
    const filtered = filterByNoise(multi as MatchResult[], 'medium');
    expect(filtered.length).toBeLessThanOrEqual(3);
  });

  it('noiseFilterNote shows note when filtered', () => {
    const note = noiseFilterNote('low', 10, 1);
    expect(note).toContain('noise filter');
  });
});

// ─── Upgrade safety ──────────────────────────────────────────────────

describe('generateUpgradeSafetyReport', () => {
  it('parses expo@51 correctly', () => {
    const target = parseUpgradeTarget('expo@51', { expo: '^50.0.0' });
    expect(target.package).toBe('expo');
    expect(target.toVersion).toBe('51');
    expect(target.fromVersion).toBeDefined();
  });

  it('classifies RN mismatch as risky', () => {
    const target = parseUpgradeTarget('expo@51', { expo: '^50.0.0' });
    const report = generateUpgradeSafetyReport(target, { expo: '^50.0.0', 'react-native': '0.73.0' }, '>=18.0.0');
    const rnItem = report.items.find(i => i.item.includes('React Native'));
    expect(rnItem).toBeDefined();
    // RN 0.73 ≠ SDK51's required 0.74 → risky
    expect(rnItem?.risk).toBe('risky');
  });

  it('flags multi-version jump as breaking', () => {
    const target = parseUpgradeTarget('expo@52', { expo: '^49.0.0' });
    const report = generateUpgradeSafetyReport(target, { expo: '^49.0.0' });
    const jumpItem = report.items.find(i => i.item.includes('Major version jump'));
    expect(jumpItem?.risk).toBe('breaking');
  });
});

// ─── Markdown output ─────────────────────────────────────────────────

describe('renderMarkdown', () => {
  it('produces valid GFM with summary table', () => {
    const results = [makeError('missing-app-config')];
    const sigs = computeSignalsFromRules(results);
    const readiness = computeReadinessScore(aggregateSignals(sigs));
    const md = renderMarkdown({ results, readiness, isPro: false });
    expect(md).toContain('## expo-ci-doctor Report');
    expect(md).toContain('| Errors | 1 |');
    expect(md).toContain('Build Readiness Score');
  });

  it('includes prediction block for Pro', () => {
    const results = [makeError('e1')];
    const sigs = computeSignalsFromRules(results);
    const readiness = computeReadinessScore(aggregateSignals(sigs));
    const pred = predictFailure(aggregateSignals(sigs));
    const md = renderMarkdown({ results, readiness, prediction: pred, isPro: true });
    // Only included if confidence > 0
    if (pred.confidence > 0) {
      expect(md).toContain('Failure Prediction');
    }
  });

  it('does not include prediction for Starter', () => {
    const md = renderMarkdown({ results: [], isPro: false });
    expect(md).not.toContain('Failure Prediction');
  });
});

// ─── GitHub Actions detection ─────────────────────────────────────────

describe('isGitHubActions', () => {
  it('returns false when env not set', () => {
    const orig = process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_ACTIONS;
    expect(isGitHubActions()).toBe(false);
    if (orig !== undefined) process.env.GITHUB_ACTIONS = orig;
  });

  it('returns true when GITHUB_ACTIONS=true', () => {
    process.env.GITHUB_ACTIONS = 'true';
    expect(isGitHubActions()).toBe(true);
    delete process.env.GITHUB_ACTIONS;
  });
});
