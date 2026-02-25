import type { MatchResult } from '../analyzers/matcher.js';

export type NoiseMode = 'full' | 'medium' | 'low';

/**
 * CI Noise Filter.
 *
 * Cascading errors in CI logs are common: a single root cause
 * (e.g., missing EXPO_TOKEN) triggers 10–20 downstream failures.
 * This filter extracts the primary root causes and suppresses noise.
 *
 * Algorithm:
 *   'low'    → only the top root-cause error (priority = lowest number, highest confidence)
 *   'medium' → top 3 unique-stage results
 *   'full'   → all matches (default)
 *
 * Rationale: lower priority number = earlier in the build pipeline = more likely root cause.
 */
export function filterByNoise(matches: MatchResult[], mode: NoiseMode): MatchResult[] {
  if (mode === 'full') return matches;

  if (mode === 'low') {
    // Return only the single highest-confidence error
    const errors = matches.filter(m => m.level === 'error');
    if (errors.length > 0) return [errors[0]];
    // Fallback: single warning
    return matches.slice(0, 1);
  }

  // medium: one result per stage, prefer highest-confidence
  if (mode === 'medium') {
    const seenStages = new Set<string>();
    const filtered: MatchResult[] = [];
    for (const m of matches) {
      if (!seenStages.has(m.stage)) {
        seenStages.add(m.stage);
        filtered.push(m);
        if (filtered.length >= 3) break;
      }
    }
    return filtered;
  }

  return matches;
}

export function noiseFilterNote(mode: NoiseMode, total: number, shown: number): string {
  if (mode === 'full' || total === shown) return '';
  return `Showing ${shown} of ${total} matches (noise filter: ${mode}). Use --noise=full to see all.`;
}
