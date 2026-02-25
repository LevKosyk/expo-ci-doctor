import type { RuleResult } from '../core/types.js';
import type { MatchResult } from '../analyzers/matcher.js';

/**
 * A single analysis signal — a boolean indicator with an associated weight.
 * Signals are the fundamental unit of the scoring and prediction systems.
 */
export interface Signal {
  id: string;
  label: string;
  weight: number;       // 0–100, how much this signal impacts the score
  triggered: boolean;   // true = bad, false = good
  reason: string;       // human explanation of why this signal was triggered
  category: 'config' | 'dependency' | 'env' | 'ci' | 'pattern';
}

export interface SignalSummary {
  signals: Signal[];
  /** All triggered (bad) signals */
  triggered: Signal[];
  /** Total negative weight applied */
  totalPenalty: number;
}

// ─── Compute signals from rule results ─────────────────────────────

export function computeSignalsFromRules(results: RuleResult[]): Signal[] {
  const signals: Signal[] = [];

  const errors = results.filter(r => r.level === 'error');
  const warns  = results.filter(r => r.level === 'warn');

  for (const err of errors) {
    signals.push({
      id: `rule-error:${err.id}`,
      label: err.title,
      weight: 15,
      triggered: true,
      reason: err.details,
      category: ruleCategoryToSignalCategory(err.id),
    });
  }

  for (const warn of warns) {
    signals.push({
      id: `rule-warn:${warn.id}`,
      label: warn.title,
      weight: 7,
      triggered: true,
      reason: warn.details,
      category: ruleCategoryToSignalCategory(warn.id),
    });
  }

  return signals;
}

// ─── Compute signals from log pattern matches ───────────────────────

export function computeSignalsFromMatches(matches: MatchResult[]): Signal[] {
  const signals: Signal[] = [];

  for (const m of matches) {
    const weight = m.confidence === 'high' ? 20
      : m.confidence === 'likely' ? 12
      : 6;

    signals.push({
      id: `pattern:${m.id}`,
      label: m.title,
      weight,
      triggered: true,
      reason: m.explanation,
      category: 'pattern',
    });
  }

  return signals;
}

// ─── Aggregate signals ──────────────────────────────────────────────

export function aggregateSignals(...signalGroups: Signal[][]): SignalSummary {
  const all = signalGroups.flat();
  const triggered = all.filter(s => s.triggered);
  const totalPenalty = triggered.reduce((sum, s) => sum + s.weight, 0);
  return { signals: all, triggered, totalPenalty };
}

// ─── Helpers ─────────────────────────────────────────────────────

function ruleCategoryToSignalCategory(ruleId: string): Signal['category'] {
  if (ruleId.includes('env') || ruleId.includes('token')) return 'env';
  if (ruleId.includes('lockfile') || ruleId.includes('dep') || ruleId.includes('node')) return 'dependency';
  if (ruleId.includes('ci') || ruleId.includes('workflow') || ruleId.includes('cache')) return 'ci';
  if (ruleId.includes('eas') || ruleId.includes('app') || ruleId.includes('sdk') || ruleId.includes('expo')) return 'config';
  return 'config';
}
