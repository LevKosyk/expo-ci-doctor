import type { SignalSummary } from '../analyzers/signals.js';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface ReadinessScore {
  score: number;      // 0–100
  risk: RiskLevel;
  summary: string;
  breakdown: ReadinessBreakdown[];
}

export interface ReadinessBreakdown {
  category: string;
  penalty: number;
  reason: string;
}

/**
 * Compute a deterministic Build Readiness Score from aggregated signals.
 *
 * Scoring model:
 *   Start at 100.
 *   Each triggered signal deducts its weight, capped at the category max.
 *   Category caps prevent one bad config from wiping out a perfect score unfairly.
 *
 * Category caps:
 *   config     → max penalty 35
 *   dependency → max penalty 25
 *   env        → max penalty 20
 *   ci         → max penalty 20
 *   pattern    → max penalty 30
 */
const CATEGORY_CAPS: Record<string, number> = {
  config:     35,
  dependency: 25,
  env:        20,
  ci:         20,
  pattern:    30,
};

export function computeReadinessScore(summary: SignalSummary): ReadinessScore {
  // Group penalty by category
  const penaltyByCategory = new Map<string, { total: number; reasons: string[] }>();

  for (const sig of summary.triggered) {
    const cat = sig.category;
    const entry = penaltyByCategory.get(cat) ?? { total: 0, reasons: [] };
    entry.total += sig.weight;
    entry.reasons.push(sig.label);
    penaltyByCategory.set(cat, entry);
  }

  const breakdown: ReadinessBreakdown[] = [];
  let totalDeduction = 0;

  for (const [cat, data] of penaltyByCategory.entries()) {
    const cap = CATEGORY_CAPS[cat] ?? 20;
    const capped = Math.min(data.total, cap);
    totalDeduction += capped;

    breakdown.push({
      category: cat,
      penalty: capped,
      reason: data.reasons.slice(0, 3).join('; '),
    });
  }

  const score = Math.max(0, 100 - totalDeduction);
  const risk: RiskLevel = score >= 80 ? 'Low' : score >= 50 ? 'Medium' : 'High';

  const summary_str = buildSummary(score, risk, breakdown);

  return { score, risk, summary: summary_str, breakdown };
}

function buildSummary(score: number, risk: RiskLevel, breakdown: ReadinessBreakdown[]): string {
  if (breakdown.length === 0) {
    return 'No issues detected. Build is ready.';
  }
  const top = breakdown.sort((a, b) => b.penalty - a.penalty)[0];
  const riskNote = risk === 'High'
    ? 'Multiple critical issues will likely fail the build.'
    : risk === 'Medium'
    ? 'Some issues detected that may cause intermittent failures.'
    : 'Minor issues detected. Build should succeed with caution.';

  return `${riskNote} Highest impact area: ${top.category} (${top.reason.split(';')[0]}).`;
}
