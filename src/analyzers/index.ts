import type { Rule, RuleResult, ProjectInfo, RulePack } from '../utils/types.js';
import { applyConfigOverride, type DoctorConfig } from '../utils/config-loader.js';

import { sdkRules } from './sdk-analyzer.js';
import { ciRules } from './ci-analyzer.js';
import { dependencyRules } from './dependency-analyzer.js';
import { pluginRules } from './plugin-analyzer.js';

export const allRules: Rule[] = [
  ...sdkRules,
  ...ciRules,
  ...dependencyRules,
  ...pluginRules
];

export interface RunOptions {
  pack?: RulePack;
  ciStrict?: boolean;
  config?: DoctorConfig;
}

export function runRules(info: ProjectInfo, opts: RunOptions = {}): { results: RuleResult[] } {
  const results: RuleResult[] = [];
  const config = opts.config ?? { rules: {}, ignore: [] };

  for (const rule of allRules) {
    if (config.rules[rule.id] === 'off') continue;
    if (opts.pack && rule.pack !== opts.pack) continue;

    try {
      const ruleResults = rule.run(info);

      for (const r of ruleResults) {
        const overridden = applyConfigOverride(config, r.id, r.level);
        if (overridden === null) continue;
        r.level = overridden;

        if (opts.ciStrict && r.level === 'warn') {
          r.level = 'error';
        }

        results.push(r);
      }
    } catch (err) {
      results.push({
        id: rule.id,
        level: 'warn',
        title: `Rule "${rule.id}" threw an error`,
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { results };
}

export function exitCode(results: RuleResult[]): number {
  if (results.some((r) => r.level === 'error')) return 2;
  if (results.some((r) => r.level === 'warn')) return 1;
  return 0;
}

export function findRule(id: string): Rule | undefined {
  return allRules.find((r) => r.id === id);
}

export function ruleCategory(ruleId: string): string {
  const rule = findRule(ruleId);
  return rule?.category ?? 'Other';
}
