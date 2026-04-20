import type { RuleLevel } from './types.js';
import type { DoctorConfig } from './config-loader.js';

export type SeverityThreshold = RuleLevel;
export type CommandThresholds = Partial<Record<string, SeverityThreshold>>;

const LEVEL_ORDER: Record<RuleLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
};

export function normalizeSeverity(value: unknown, fallback: SeverityThreshold = 'error'): SeverityThreshold {
  return value === 'info' || value === 'warn' || value === 'error' ? value : fallback;
}

export function resolveCommandThreshold(
  config: DoctorConfig,
  commandName: string,
  override?: string,
): SeverityThreshold {
  if (override) {
    return normalizeSeverity(override);
  }

  const thresholds = config.severityThresholds ?? {};
  return normalizeSeverity(thresholds[commandName] ?? thresholds.default ?? 'error');
}

export function exitCodeForThreshold(results: Array<{ level: RuleLevel }>, threshold: SeverityThreshold = 'error'): number {
  const thresholdRank = LEVEL_ORDER[threshold];
  const highest = results.reduce((max, item) => Math.max(max, LEVEL_ORDER[item.level]), 0);
  return highest >= thresholdRank ? 2 : 0;
}

export function maxSeverity(results: Array<{ level: RuleLevel }>): SeverityThreshold {
  let current: SeverityThreshold = 'info';
  for (const result of results) {
    if (LEVEL_ORDER[result.level] > LEVEL_ORDER[current]) {
      current = result.level;
    }
  }
  return current;
}
