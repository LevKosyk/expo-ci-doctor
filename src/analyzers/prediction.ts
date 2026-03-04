import type { SignalSummary } from './signals.js';

export interface FailurePrediction {
  confidence: number;   // 0–100
  likelihood: 'Low' | 'Medium' | 'High';
  primarySignals: string[];
  explanation: string;
}

/**
 * Heuristic-based failure prediction.
 *
 * Confidence is computed from the ratio of triggered high-weight signals
 * to the total possible weight, scaled and clamped to 0–100.
 *
 * This is NOT machine learning; it's a calibrated weighted heuristic
 * that conservatively estimates failure probability.
 *
 * Design principle: better to understate confidence than overstate it.
 */
export function predictFailure(summary: SignalSummary): FailurePrediction {
  const triggered = summary.triggered;

  if (triggered.length === 0) {
    return {
      confidence: 0,
      likelihood: 'Low',
      primarySignals: [],
      explanation: 'No failure signals detected in the current analysis.',
    };
  }

  // Sort by weight descending — highest impact signals drive the prediction
  const sorted = [...triggered].sort((a, b) => b.weight - a.weight);
  const top3 = sorted.slice(0, 3);

  // Confidence formula: sum of top signal weights, capped and scaled.
  // Intentionally conservative: 3 max-weight signals (20ea) = 60 raw points → ~84% after scaling.
  const rawWeight = top3.reduce((sum, s) => sum + s.weight, 0);
  const maxPossible = 60; // 3 signals × 20 max weight each
  const confidence = Math.min(97, Math.round((rawWeight / maxPossible) * 100));

  const likelihood: FailurePrediction['likelihood'] =
    confidence >= 70 ? 'High' : confidence >= 40 ? 'Medium' : 'Low';

  const primarySignals = top3.map(s => s.label);

  const explanation = buildExplanation(likelihood, top3);

  return { confidence, likelihood, primarySignals, explanation };
}

function buildExplanation(
  likelihood: FailurePrediction['likelihood'],
  topSignals: Array<{ label: string; reason: string; category: string }>,
): string {
  const intro = likelihood === 'High'
    ? 'Multiple high-confidence failure signals were detected.'
    : likelihood === 'Medium'
    ? 'Several risk signals were detected that commonly precede build failures.'
    : 'Low-weight risk signals detected; failure is possible but not likely.';

  const dominant = topSignals[0];
  const detail = dominant
    ? ` The dominant signal is: "${dominant.label}" (${dominant.category}).`
    : '';

  return intro + detail + ' This is a heuristic estimate, not a guarantee.';
}
